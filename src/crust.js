const { createHmac } = require('node:crypto');
const db = require('./db');

const BASE_URL = (process.env.CRUST_INTEGRATION_URL || 'https://crust.wispbyte.app').replace(/\/+$/, '');
const SECRET = process.env.STAFF_POINTS_API_SECRET || '';
const ENDPOINT = '/api/staff-points/award';
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 12;
const BATCH_SIZE = 10;
const RETRY_INTERVAL_MS = 30_000;

let retryTimer = null;
let workerRunning = false;

function validatePayload({ discordUserId, amount, reason, referenceId }) {
  if (typeof discordUserId !== 'string' || !/^\d{17,21}$/.test(discordUserId)) throw new TypeError('discordUserId must be a 17–21 digit Discord ID string.');
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) throw new TypeError('amount must be an integer from 1 to 100000.');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new TypeError('reason must be a nonempty string of at most 500 characters.');
  if (typeof referenceId !== 'string' || referenceId.length < 1 || referenceId.length > 120 || !/^[A-Za-z0-9:._-]+$/.test(referenceId)) {
    throw new TypeError('referenceId must be 1–120 characters using letters, digits, colons, periods, underscores, or hyphens.');
  }
}

function assertConfiguration() {
  if (!SECRET) throw new Error('STAFF_POINTS_API_SECRET is not configured.');
  let url;
  try { url = new URL(BASE_URL); } catch { throw new Error('CRUST_INTEGRATION_URL is not a valid URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('CRUST_INTEGRATION_URL must be a clean HTTPS base URL.');
  return url;
}

function signRequest(timestamp, rawBody) {
  return 'sha256=' + createHmac('sha256', SECRET).update(timestamp + '.' + rawBody, 'utf8').digest('hex');
}

function safeResponseBody(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed };
  } catch { return { raw: text.slice(0, 2000) }; }
}

function retryDelayMs(attemptCount) {
  return Math.min(6 * 60 * 60 * 1000, 60_000 * (2 ** Math.max(0, Math.min(attemptCount - 1, 8))));
}

async function updateAward(referenceId, fields) {
  const assignments = [];
  const values = [referenceId];
  for (const [column, value] of Object.entries(fields)) {
    values.push(value);
    assignments.push(column + ' = $' + values.length);
  }
  assignments.push('updated_at = NOW()');
  await db.query('UPDATE crust_staff_point_awards SET ' + assignments.join(', ') + ' WHERE reference_id = $1', values);
}

async function scheduleRetry(row, message, httpStatus = null, body = null) {
  if (Number(row.attempt_count) >= MAX_ATTEMPTS) {
    await updateAward(row.reference_id, {
      status: 'failed', last_http_status: httpStatus,
      last_response: body ? JSON.stringify(body) : null,
      last_error: message + ' (retry limit reached)', next_attempt_at: null,
    });
    return { status: 'failed', reason: 'retry_limit' };
  }
  await updateAward(row.reference_id, {
    status: 'retry', last_http_status: httpStatus,
    last_response: body ? JSON.stringify(body) : null,
    last_error: message.slice(0, 2000),
    next_attempt_at: new Date(Date.now() + retryDelayMs(Number(row.attempt_count))),
  });
  return { status: 'retry_scheduled' };
}

async function sendAward(row) {
  const url = assertConfiguration();
  const timestamp = String(Date.now());
  const signature = signRequest(timestamp, row.raw_body);
  let response;
  let responseText = '';
  try {
    response = await fetch(url.origin + url.pathname.replace(/\/+$/, '') + ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'X-Crust-Timestamp': timestamp,
        'X-Crust-Signature': signature,
      },
      body: row.raw_body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    responseText = await response.text();
  } catch (error) {
    return scheduleRetry(row, 'Network error: ' + (error?.message || 'request failed'));
  }

  const body = safeResponseBody(responseText);
  if (response.status === 201 || (response.status === 200 && body.duplicate === true)) {
    await updateAward(row.reference_id, {
      status: 'awarded', last_http_status: response.status,
      last_response: JSON.stringify(body), last_error: null,
      next_attempt_at: null, awarded_at: new Date(),
    });
    return { status: 'awarded', duplicate: response.status === 200 };
  }
  if (response.status === 409) {
    await updateAward(row.reference_id, {
      status: 'conflict', last_http_status: response.status,
      last_response: JSON.stringify(body),
      last_error: 'Crust rejected this reference_id because it was previously used with different data.',
      next_attempt_at: null,
    });
    return { status: 'conflict', httpStatus: response.status };
  }

  const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
  const message = 'Crust returned HTTP ' + response.status + ': ' + JSON.stringify(body).slice(0, 1500);
  if (retryable) return scheduleRetry(row, message, response.status, body);

  await updateAward(row.reference_id, {
    status: 'failed', last_http_status: response.status,
    last_response: JSON.stringify(body), last_error: message, next_attempt_at: null,
  });
  return { status: 'failed', httpStatus: response.status };
}

async function claimAward(referenceId) {
  const result = await db.query(
    "UPDATE crust_staff_point_awards SET status = 'processing', attempt_count = attempt_count + 1, updated_at = NOW() WHERE reference_id = $1 AND status IN ('pending', 'retry') AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()) RETURNING *",
    [referenceId]
  );
  return result.rows[0] || null;
}

async function processAward(referenceId) {
  const row = await claimAward(referenceId);
  if (!row) {
    const existing = await db.query('SELECT status FROM crust_staff_point_awards WHERE reference_id = $1', [referenceId]);
    return { status: existing.rows[0]?.status || 'not_found' };
  }
  try { return await sendAward(row); }
  catch (error) {
    console.error('[Crust] Award processing failed:', { referenceId, message: error?.message || String(error) });
    return scheduleRetry(row, 'Internal integration error: ' + (error?.message || 'unknown error'));
  }
}

async function awardStaffPoints({ discordUserId, amount, reason, referenceId }) {
  validatePayload({ discordUserId, amount, reason, referenceId });
  assertConfiguration();
  const payload = { discord_user_id: discordUserId, amount, reason: reason.trim(), reference_id: referenceId };
  const rawBody = JSON.stringify(payload);
  const inserted = await db.query(
    "INSERT INTO crust_staff_point_awards (reference_id, discord_user_id, amount, reason, raw_body, status) VALUES ($1, $2, $3, $4, $5, 'pending') ON CONFLICT (reference_id) DO NOTHING RETURNING reference_id",
    [referenceId, discordUserId, amount, payload.reason, rawBody]
  );

  if (!inserted.rowCount) {
    const existing = await db.query(
      'SELECT discord_user_id, amount, reason, raw_body, status FROM crust_staff_point_awards WHERE reference_id = $1',
      [referenceId]
    );
    const row = existing.rows[0];
    if (!row) throw new Error('Could not verify the existing Crust reward record.');
    if (row.discord_user_id !== discordUserId || Number(row.amount) !== amount || row.reason !== payload.reason || row.raw_body !== rawBody) {
      throw new Error('referenceId has already been used with different reward data. A new referenceId is required.');
    }
    if (row.status === 'awarded') return { status: 'awarded', duplicate: true };
    if (row.status === 'conflict' || row.status === 'failed') return { status: row.status };
  }
  return processAward(referenceId);
}

async function retryPendingAwards() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const due = await db.query(
      "SELECT reference_id FROM crust_staff_point_awards WHERE status IN ('pending', 'retry') AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()) ORDER BY created_at ASC LIMIT $1",
      [BATCH_SIZE]
    );
    for (const row of due.rows) await processAward(row.reference_id);
  } catch (error) {
    console.error('[Crust] Retry worker failed:', error?.message || error);
  } finally { workerRunning = false; }
}

async function migrate() {
  await db.query(\`
    CREATE TABLE IF NOT EXISTS crust_staff_point_awards (
      reference_id TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 100000),
      reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
      raw_body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'retry', 'awarded', 'failed', 'conflict')),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      next_attempt_at TIMESTAMPTZ,
      last_http_status INTEGER,
      last_response JSONB,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      awarded_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_crust_staff_point_awards_retry
      ON crust_staff_point_awards(status, next_attempt_at, created_at)
      WHERE status IN ('pending', 'retry');
    UPDATE crust_staff_point_awards
    SET status = 'retry', next_attempt_at = NOW(), updated_at = NOW(),
        last_error = COALESCE(last_error, 'Recovered after an interrupted bot process.')
    WHERE status = 'processing';
  \`);
}

function startRetryWorker() {
  if (retryTimer) return;
  if (!SECRET) {
    console.warn('[Crust] Staff Points integration is disabled: STAFF_POINTS_API_SECRET is missing.');
    return;
  }
  try { assertConfiguration(); }
  catch (error) {
    console.error('[Crust] Staff Points integration is disabled:', error.message);
    return;
  }
  retryPendingAwards();
  retryTimer = setInterval(retryPendingAwards, RETRY_INTERVAL_MS);
  retryTimer.unref?.();
  console.log('[Crust] Staff Points retry worker started.');
}

function stopRetryWorker() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
}

async function getAwardStatus(referenceId) {
  const result = await db.query(
    'SELECT reference_id, discord_user_id, amount, reason, status, attempt_count, last_http_status, last_error, created_at, updated_at, awarded_at FROM crust_staff_point_awards WHERE reference_id = $1',
    [referenceId]
  );
  return result.rows[0] || null;
}

module.exports = { migrate, awardStaffPoints, getAwardStatus, retryPendingAwards, startRetryWorker, stopRetryWorker };
