const { PermissionFlagsBits } = require('discord.js');
const { config } = require('./config');
const db = require('./db');
const { hasPermission } = require('./access');

const CHANNEL_ID = '1570764802651983962';
const TIME_ZONE = 'Asia/Riyadh';
const MINUTE = 60 * 1000;

const ANNOUNCEMENT = `Hello everyone, concerned General Manager here. Recently I've noticed that the NR3 staff team has developed some serious behavioural problems. Usually I wouldn't mind since most of them can operate a paint bucket without adult supervision, but lately I've started questioning whether recruiting people directly from a kindergarten was a good idea.

Yesterday I asked a moderator why he'd banned someone. He told me the player had painted France yellow without permission and was clearly planning a coup. When I asked for evidence, he sent me a screenshot of a yellow pixel and said "look closely."

Whenever I post an announcement, 20 moderators instantly react with a checkmark. However, when I ask what it says, they suddenly develop severe reading disabilities. One moderator asked me what NR3 stood for. He's been working here for eight months.

At 3 AM, a Junior Moderator sent me 27 DMs asking whether painting Austria was considered reviving the Third Reich. When I told him no, he accused me of supporting war crimes and threatened to report the entire management team to the United Nations.

Yesterday I caught a Trial Moderator screaming "STOP RESISTING" at a player who was painting Luxembourg.

Another moderator has started introducing himself at school as "Supreme manager of  NR3." Apparently, he threatened to permanently ban his geography teacher for drawing the borders of Germany incorrectly.

Please help. 17 moderators have declared independence from NR3 and established the People's Republic of Staff General. They're demanding full control over the paint bucket and my immediate resignation. Their president is a Trial Moderator who joined yesterday and still doesn't know how to select a colour.`;

function riyadhDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function localDateKey(date = new Date()) {
  const p = riyadhDateParts(date);
  return p.year + '-' + p.month + '-' + p.day;
}

function localTimeToUtc(dateKey, minutesAfterMidnight) {
  const [year, month, day] = dateKey.split('-').map(Number);
  // Riyadh is UTC+3 year-round.
  return new Date(Date.UTC(year, month - 1, day, Math.floor(minutesAfterMidnight / 60) - 3, minutesAfterMidnight % 60));
}

function randomDailyTimes() {
  const start = 8 * 60;
  const end = 23 * 60;
  let first, second;
  do {
    first = start + Math.floor(Math.random() * (end - start));
    second = start + Math.floor(Math.random() * (end - start));
  } while (Math.abs(first - second) < 180);
  return [first, second].sort((a, b) => a - b);
}

async function ensureDailySchedule() {
  const dateKey = localDateKey();
  const existing = await db.query(
    'SELECT COUNT(*)::int AS count FROM nrr_nr3_broadcast_schedule WHERE schedule_date = $1',
    [dateKey]
  );
  if (Number(existing.rows[0]?.count || 0) >= 2) return;

  const times = randomDailyTimes();
  for (let slot = 1; slot <= 2; slot++) {
    await db.query(`
      INSERT INTO nrr_nr3_broadcast_schedule (schedule_date, slot, scheduled_at)
      VALUES ($1::date, $2, $3)
      ON CONFLICT (schedule_date, slot) DO NOTHING
    `, [dateKey, slot, localTimeToUtc(dateKey, times[slot - 1])]);
  }
}

async function sendAnnouncement(client) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel?.isTextBased() || typeof channel.send !== 'function') {
    throw new Error('NR3 broadcast destination is unavailable or is not a text channel.');
  }
  return channel.send({ content: ANNOUNCEMENT, allowedMentions: { parse: [] } });
}

async function claimDueBroadcast() {
  const result = await db.query(`
    WITH due AS (
      SELECT schedule_date, slot
      FROM nrr_nr3_broadcast_schedule
      WHERE scheduled_at <= NOW() AND claimed_at IS NULL
      ORDER BY scheduled_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE nrr_nr3_broadcast_schedule AS schedule
    SET claimed_at = NOW()
    FROM due
    WHERE schedule.schedule_date = due.schedule_date
      AND schedule.slot = due.slot
    RETURNING schedule.schedule_date, schedule.slot
  `);
  return result.rows[0] || null;
}

async function pollSchedule(client) {
  await ensureDailySchedule();
  // Drain any overdue slots one at a time. The database claim prevents duplicate
  // sends if multiple bot processes briefly overlap.
  while (true) {
    const claimed = await claimDueBroadcast();
    if (!claimed) break;
    try {
      await sendAnnouncement(client);
      console.log(`[NR3 Broadcast] Sent scheduled slot ${claimed.slot} for ${claimed.schedule_date}.`);
    } catch (error) {
      console.error('[NR3 Broadcast] Scheduled send failed after claiming its slot:', error);
    }
  }
}

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_nr3_broadcast_schedule (
      schedule_date DATE NOT NULL,
      slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
      scheduled_at TIMESTAMPTZ NOT NULL,
      claimed_at TIMESTAMPTZ,
      PRIMARY KEY (schedule_date, slot)
    );
    CREATE INDEX IF NOT EXISTS idx_nrr_nr3_broadcast_due
      ON nrr_nr3_broadcast_schedule (scheduled_at)
      WHERE claimed_at IS NULL;
  `);
}

async function startScheduler(client) {
  await migrate();
  await pollSchedule(client);
  setInterval(() => {
    pollSchedule(client).catch(error => console.error('[NR3 Broadcast] Scheduler poll failed:', error));
  }, 30 * 1000);
  console.log('[NR3 Broadcast] Two randomized daily broadcasts scheduled for Asia/Riyadh.');
}

async function handlePrefixMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return false;
  if (message.channelId !== CHANNEL_ID || !/^!sendnr3$/i.test(message.content.trim())) return false;

  if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageGuild, message.member)) {
    await message.delete().catch(() => {});
    await message.channel.send({
      content: '❌ You need Manage Server permission to send the NR3 broadcast.',
      allowedMentions: { parse: [] }
    });
    return true;
  }

  await message.delete().catch(error => console.warn('[NR3 Broadcast] Could not delete manual command:', error.message));
  try {
    await sendAnnouncement(message.client);
  } catch (error) {
    console.error('[NR3 Broadcast] Manual send failed:', error);
    await message.channel.send({
      content: '❌ I could not send the NR3 broadcast. Please check the bot permissions.',
      allowedMentions: { parse: [] }
    }).catch(() => {});
  }
  return true;
}

module.exports = { migrate, startScheduler, handlePrefixMessage, sendAnnouncement };
