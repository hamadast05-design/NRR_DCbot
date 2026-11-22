#!/usr/bin/env node
'use strict';

// One-time, HR-approved, 1-point live test for the Crust Staff Points integration.
// This script intentionally never accepts a Discord ID or API secret as a CLI argument.

const { randomUUID } = require('node:crypto');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const db = require('../src/db');
const crust = require('../src/crust');

const REASON = 'HR-approved Crust API integration test';
const rl = readline.createInterface({ input: stdin, output: stdout });

function assertConfig() {
  if (!process.env.STAFF_POINTS_API_SECRET) {
    throw new Error('STAFF_POINTS_API_SECRET is not configured on this service.');
  }
  const base = process.env.CRUST_INTEGRATION_URL || 'https://crust.wispbyte.app';
  let url;
  try { url = new URL(base); } catch { throw new Error('CRUST_INTEGRATION_URL is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('CRUST_INTEGRATION_URL must be a clean HTTPS base URL.');
  }
}

function validateDiscordId(value) {
  const id = String(value || '').trim();
  if (!/^\d{17,21}$/.test(id)) throw new Error('That does not look like a valid Discord user ID.');
  return id;
}

async function printStatus(referenceId) {
  const row = await crust.getAwardStatus(referenceId);
  if (!row) {
    console.log('No local award record found for that reference.');
    return null;
  }
  console.log(JSON.stringify({
    reference_id: row.reference_id,
    discord_user_id: row.discord_user_id,
    amount: row.amount,
    status: row.status,
    attempt_count: row.attempt_count,
    last_http_status: row.last_http_status,
    last_error: row.last_error,
    created_at: row.created_at,
    awarded_at: row.awarded_at,
  }, null, 2));
  return row;
}

async function main() {
  const [mode, referenceArg] = process.argv.slice(2);

  if (!mode || !['preflight', 'award', 'repeat', 'status'].includes(mode)) {
    throw new Error(
      'Usage:\n' +
      '  node scripts/crust-integration-test.js preflight\n' +
      '  node scripts/crust-integration-test.js award\n' +
      '  node scripts/crust-integration-test.js status <reference-id>\n' +
      '  node scripts/crust-integration-test.js repeat <reference-id>'
    );
  }

  assertConfig();
  const dbCheck = await db.query(
    "SELECT to_regclass('crust_staff_point_awards') IS NOT NULL AS table_exists"
  );
  if (!dbCheck.rows[0]?.table_exists) {
    throw new Error('Crust award table is missing. Stop here; do not run migrations from this test script.');
  }

  if (mode === 'preflight') {
    await db.query('SELECT 1');
    console.log('PRECHECK PASSED: database reachable, Crust award table exists, and required Crust configuration is present.');
    console.log('No Staff Points were awarded.');
    return;
  }

  if (mode === 'status') {
    if (!referenceArg) throw new Error('Provide the reference ID printed by the award test.');
    await printStatus(referenceArg);
    return;
  }

  if (mode === 'award') {
    const discordUserId = validateDiscordId(await rl.question('Enter HR portfolio Discord user ID (input stays in this terminal): '));
    const approval = (await rl.question('Confirm HR explicitly approved this 1-point test by typing HR APPROVED: ')).trim();
    if (approval !== 'HR APPROVED') throw new Error('HR approval was not confirmed. No reward was sent.');
    const confirmation = (await rl.question('Final confirmation — type AWARD 1 POINT to send the live test reward: ')).trim();
    if (confirmation !== 'AWARD 1 POINT') throw new Error('Final confirmation did not match. No reward was sent.');

    const referenceId = 'crust-test-' + Date.now() + '-' + randomUUID();
    console.log('Test reference ID: ' + referenceId);
    console.log('Sending exactly 1 Staff Point to the approved portfolio...');

    const result = await crust.awardStaffPoints({
      discordUserId,
      amount: 1,
      reason: REASON,
      referenceId,
    });
    console.log('Crust client result: ' + JSON.stringify(result));
    await printStatus(referenceId);
    console.log('Save the reference ID above; it is needed for the idempotency check.');
    return;
  }

  if (mode === 'repeat') {
    if (!referenceArg) throw new Error('Provide the reference ID printed by the award test.');
    const existing = await crust.getAwardStatus(referenceArg);
    if (!existing || existing.status !== 'awarded') {
      throw new Error('Repeat check is allowed only after this reference is already marked awarded. No request was sent.');
    }
    const discordUserId = validateDiscordId(await rl.question('Re-enter the same HR portfolio Discord user ID: '));
    if (discordUserId !== existing.discord_user_id) {
      throw new Error('The ID does not match the original recipient. No request was sent.');
    }
    const result = await crust.awardStaffPoints({
      discordUserId,
      amount: 1,
      reason: REASON,
      referenceId: referenceArg,
    });
    console.log('Same-reference result: ' + JSON.stringify(result));
    console.log('This verifies NRR-side duplicate protection. It does not send a second HTTP award to Crust.');
    await printStatus(referenceArg);
  }
}

main()
  .catch(error => {
    console.error('Crust test stopped:', error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    try { await db.close(); }
    catch (error) {
      console.error('Database pool shutdown warning:', error?.message || String(error));
      process.exitCode = 1;
    }
  });
