const db = require('./db');

const TIME_ZONE = 'Asia/Riyadh';
const ACTIVE_START_HOUR = 14;
const MIN_GAP_MS = 60 * 60 * 1000;
let schemaReady = false;

function getLocalDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

function localTime(dateString, hour, minute = 0) {
  return new Date(dateString + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+03:00');
}

function createRandomTimes(dateString, now = new Date()) {
  const dayStart = localTime(dateString, ACTIVE_START_HOUR);
  const dayEnd = localTime(dateString, 23, 59);
  const earliest = new Date(Math.max(dayStart.getTime(), now.getTime() + 1000));
  if (earliest >= dayEnd) return [];

  // Randomly distribute three posts across the remaining active day, rejecting
  // schedules that place any two posts less than one hour apart.
  for (let attempt = 0; attempt < 12000; attempt++) {
    const times = Array.from({ length: 3 }, () =>
      new Date(earliest.getTime() + Math.random() * (dayEnd.getTime() - earliest.getTime()))
    ).sort((a, b) => a - b);
    if (times.every((time, index) => index === 0 || time - times[index - 1] >= MIN_GAP_MS)) {
      return times.map(time => time.toISOString());
    }
  }

  // Late-day fallback: schedule as many posts as can still fit, keeping the
  // one-hour minimum rather than bunching missed posts together.
  const times = [];
  let cursor = earliest.getTime() + Math.random() * Math.min(30 * 60 * 1000, dayEnd.getTime() - earliest.getTime());
  while (times.length < 3 && cursor <= dayEnd.getTime()) {
    times.push(new Date(cursor).toISOString());
    cursor += MIN_GAP_MS + Math.random() * 90 * 60 * 1000;
  }
  return times;
}

async function ensureSchema() {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS daily_ping_schedule (
      schedule_key TEXT PRIMARY KEY,
      local_date TEXT NOT NULL,
      scheduled_times JSONB NOT NULL DEFAULT '[]'::jsonb,
      posts_sent INTEGER NOT NULL DEFAULT 0,
      last_post_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
}

async function ensureSchedule(scheduleKey, now = new Date()) {
  await ensureSchema();
  const localDate = getLocalDate(now);
  const scheduledTimes = createRandomTimes(localDate, now);
  await db.query(`
    INSERT INTO daily_ping_schedule (schedule_key, local_date, scheduled_times, posts_sent)
    VALUES ($1, $2, $3::jsonb, 0)
    ON CONFLICT (schedule_key) DO UPDATE
      SET local_date = EXCLUDED.local_date,
          scheduled_times = EXCLUDED.scheduled_times,
          posts_sent = 0,
          last_post_at = NULL,
          updated_at = NOW()
      WHERE daily_ping_schedule.local_date IS DISTINCT FROM EXCLUDED.local_date
  `, [scheduleKey, localDate, JSON.stringify(scheduledTimes)]);
  const result = await db.query(
    'SELECT local_date, scheduled_times, posts_sent, last_post_at FROM daily_ping_schedule WHERE schedule_key = $1',
    [scheduleKey]
  );
  return result.rows[0] || null;
}

async function isDue(scheduleKey, now = new Date()) {
  const row = await ensureSchedule(scheduleKey, now);
  if (!row || row.local_date !== getLocalDate(now)) return false;
  const times = Array.isArray(row.scheduled_times) ? row.scheduled_times : [];
  const next = times[Number(row.posts_sent || 0)];
  if (!next || new Date(next).getTime() > now.getTime()) return false;
  if (row.last_post_at && now.getTime() - new Date(row.last_post_at).getTime() < MIN_GAP_MS) return false;
  return true;
}

async function claimDue(scheduleKey, now = new Date()) {
  const localDate = getLocalDate(now);
  const result = await db.query(`
    UPDATE daily_ping_schedule
    SET posts_sent = posts_sent + 1, last_post_at = $3, updated_at = NOW()
    WHERE schedule_key = $1
      AND local_date = $2
      AND posts_sent < jsonb_array_length(scheduled_times)
      AND (scheduled_times ->> posts_sent)::timestamptz <= $3
      AND (last_post_at IS NULL OR last_post_at <= $3 - INTERVAL '60 minutes')
    RETURNING posts_sent
  `, [scheduleKey, localDate, now]);
  return result.rowCount > 0;
}

module.exports = { ensureSchedule, isDue, claimDue, getLocalDate };
