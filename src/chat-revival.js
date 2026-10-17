const db = require('./db');
const questions = require('./chat-revival-questions');
const automationControl = require('./automation-control');
const dailyPings = require('./daily-ping-scheduler');

const CHANNEL_ID = process.env.CHAT_REVIVAL_CHANNEL_ID || '1487521278591111399';
const ROLE_ID = '1559660468480512111';
const SCHEDULE_KEY = 'chat-revival';
const QUIET_END_HOUR = 14; // Quiet hours are 00:00–13:59 in Asia/Riyadh.
const CHECK_INTERVAL_MS = 60 * 1000;

let clientRef = null;
let checking = false;
let initializing = false;
let initialized = false;
let started = false;

function isQuietHours(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', hour: '2-digit', hourCycle: 'h23'
  }).format(date));
  return hour < QUIET_END_HOUR;
}

async function evaluate() {
  if (checking || !clientRef || !initialized || automationControl.isStopped() || isQuietHours()) return;
  checking = true;
  try {
    const channel = await clientRef.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased() || !channel.guild || !channel.send) {
      console.error('Chat Revival cannot access its configured text channel:', CHANNEL_ID);
      return;
    }

    if (!(await dailyPings.isDue(SCHEDULE_KEY))) return;
    const claimed = await dailyPings.claimDue(SCHEDULE_KEY);
    if (!claimed) return;

    await db.query(
      'INSERT INTO chat_revival_state (channel_id) VALUES ($1) ON CONFLICT (channel_id) DO NOTHING',
      [CHANNEL_ID]
    );
    const stateResult = await db.query(
      'SELECT next_question_index FROM chat_revival_state WHERE channel_id = $1',
      [CHANNEL_ID]
    );
    const index = Number(stateResult.rows[0]?.next_question_index || 0) % questions.length;
    await channel.send({
      content: '<@&' + ROLE_ID + '> ' + questions[index],
      allowedMentions: { parse: [], roles: [ROLE_ID] }
    });

    await db.query(
      'UPDATE chat_revival_state SET next_question_index = $2, last_triggered_at = NOW(), updated_at = NOW() WHERE channel_id = $1',
      [CHANNEL_ID, (index + 1) % questions.length]
    );
    console.log('Chat Revival posted scheduled debate ping ' + (index + 1) + '/' + questions.length + '.');
  } catch (error) {
    console.error('Chat Revival scheduled ping failed:', error);
  } finally {
    checking = false;
  }
}

async function initialize(client) {
  if (initialized || initializing) return;
  initializing = true;
  clientRef = client;
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased() || !channel.guild || !channel.send) {
      console.error('Chat Revival initialization failed: configured channel is inaccessible.');
      return;
    }
    await dailyPings.ensureSchedule(SCHEDULE_KEY);
    initialized = true;
    await evaluate();
  } catch (error) {
    console.error('Chat Revival initialization failed:', error);
  } finally {
    initializing = false;
  }
}

function start(client) {
  if (started) return;
  started = true;
  clientRef = client;
  initialize(client).catch(error => console.error('Chat Revival initialization error:', error));
  setInterval(() => {
    if (initialized) evaluate();
    else initialize(client).catch(error => console.error('Chat Revival initialization retry failed:', error));
  }, CHECK_INTERVAL_MS);
  console.log('Chat Revival enabled: up to 3 randomized debate pings per Saudi day, at least 60 minutes apart; quiet hours 00:00–14:00 Asia/Riyadh.');
}

// Message activity no longer controls Chat Revival; the daily randomized schedule does.
async function onMessage() {}
async function onMessageDelete() {}

module.exports = { start, onMessage, onMessageDelete, isQuietHours };
