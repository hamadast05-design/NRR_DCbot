const db = require('./db');
const questions = require('./chat-revival-questions');

const CHANNEL_ID = process.env.CHAT_REVIVAL_CHANNEL_ID || '1487521278591111399';
const ROLE_ID = '1559660468480512111';
const WINDOW_MINUTES = 45;
const MESSAGE_THRESHOLD = 20;
const QUIET_END_HOUR = 14; // Quiet hours are 00:00–13:59 in Asia/Riyadh.
const CHECK_INTERVAL_MS = 60 * 1000;

let clientRef = null;
let checking = false;
let initializing = false;
let initialized = false;

function isQuietHours(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(date));
  return hour < QUIET_END_HOUR;
}

function isHumanMessage(message) {
  return Boolean(message && message.guild && message.author && !message.author.bot && !message.webhookId);
}

async function saveMessage(message) {
  await db.query(
    'INSERT INTO chat_revival_messages (channel_id, message_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (channel_id, message_id) DO NOTHING',
    [CHANNEL_ID, message.id, message.createdAt]
  );
}

async function onMessage(message) {
  if (!message || message.channelId !== CHANNEL_ID || !isHumanMessage(message)) return;
  try {
    await saveMessage(message);
  } catch (error) {
    console.error('Chat Revival message tracking failed:', error);
  }
}

async function onMessageDelete(message) {
  if (!message || message.channelId !== CHANNEL_ID || !message.id) return;
  try {
    await db.query('DELETE FROM chat_revival_messages WHERE channel_id = $1 AND message_id = $2', [CHANNEL_ID, message.id]);
  } catch (error) {
    console.error('Chat Revival delete tracking failed:', error);
  }
}

// Seed recent history after deploy/restart to avoid treating a busy channel as quiet.
async function hydrateRecentMessages(channel) {
  const cutoff = Date.now() - WINDOW_MINUTES * 60 * 1000;
  let before;
  let humansSaved = 0;

  while (humansSaved < MESSAGE_THRESHOLD) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;

    const messages = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const message of messages) {
      if (message.createdTimestamp < cutoff || !isHumanMessage(message)) continue;
      await saveMessage(message);
      humansSaved++;
    }

    const oldest = messages[0];
    if (!oldest || oldest.createdTimestamp < cutoff || batch.size < 100) break;
    before = oldest.id;
  }

  console.log('Chat Revival seeded recent history (' + humansSaved + ' human messages).');
}

async function evaluate() {
  if (checking || !clientRef || !initialized) return;
  checking = true;

  try {
    const channel = await clientRef.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased() || !channel.guild || !channel.messages?.fetch) {
      console.error('Chat Revival cannot access its configured text channel/history:', CHANNEL_ID);
      return;
    }

    await db.query(
      "DELETE FROM chat_revival_messages WHERE channel_id = $1 AND created_at < NOW() - ($2::int * INTERVAL '1 minute')",
      [CHANNEL_ID, WINDOW_MINUTES]
    );

    const countResult = await db.query(
      "SELECT COUNT(*)::int AS count FROM chat_revival_messages WHERE channel_id = $1 AND created_at >= NOW() - ($2::int * INTERVAL '1 minute')",
      [CHANNEL_ID, WINDOW_MINUTES]
    );
    const count = Number(countResult.rows[0]?.count || 0);

    await db.query(
      'INSERT INTO chat_revival_state (channel_id) VALUES ($1) ON CONFLICT (channel_id) DO NOTHING',
      [CHANNEL_ID]
    );
    const stateResult = await db.query(
      'SELECT next_question_index, low_activity_active FROM chat_revival_state WHERE channel_id = $1',
      [CHANNEL_ID]
    );
    const state = stateResult.rows[0] || { next_question_index: 0, low_activity_active: false };
    const wasLow = Boolean(state.low_activity_active);

    if (count >= MESSAGE_THRESHOLD) {
      if (wasLow) {
        await db.query('UPDATE chat_revival_state SET low_activity_active = FALSE, updated_at = NOW() WHERE channel_id = $1', [CHANNEL_ID]);
      }
      return;
    }

    // Latch low activity during quiet hours too, preventing a catch-up ping at 14:00.
    if (wasLow) return;
    await db.query('UPDATE chat_revival_state SET low_activity_active = TRUE, updated_at = NOW() WHERE channel_id = $1', [CHANNEL_ID]);

    if (isQuietHours()) {
      console.log('Chat Revival: low activity during Saudi quiet hours; no message sent.');
      return;
    }

    const index = Number(state.next_question_index || 0) % questions.length;
    await channel.send({
      content: '<@&' + ROLE_ID + '> **NRR Chat Revival**\n\n' + questions[index],
      allowedMentions: { parse: [], roles: [ROLE_ID] }
    });

    const nextIndex = (index + 1) % questions.length;
    await db.query(
      'UPDATE chat_revival_state SET next_question_index = $2, last_triggered_at = NOW(), updated_at = NOW() WHERE channel_id = $1',
      [CHANNEL_ID, nextIndex]
    );
    console.log('Chat Revival posted question ' + (index + 1) + '/' + questions.length + ' with ' + count + ' human messages in the last ' + WINDOW_MINUTES + ' minutes.');
  } catch (error) {
    console.error('Chat Revival check failed:', error);
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
    if (!channel?.isTextBased() || !channel.guild || !channel.messages?.fetch) {
      console.error('Chat Revival initialization failed: configured channel is inaccessible.');
      return;
    }
    await hydrateRecentMessages(channel);
    initialized = true;
    await evaluate();
  } catch (error) {
    console.error('Chat Revival initialization failed:', error);
  } finally {
    initializing = false;
  }
}

function start(client) {
  clientRef = client;
  initialize(client).catch(error => console.error('Chat Revival initialization error:', error));
  setInterval(() => {
    if (initialized) evaluate();
    else initialize(client).catch(error => console.error('Chat Revival initialization retry failed:', error));
  }, CHECK_INTERVAL_MS);
  console.log('Chat Revival starting; threshold < ' + MESSAGE_THRESHOLD + ' human messages per ' + WINDOW_MINUTES + ' minutes; quiet hours 00:00–14:00 Asia/Riyadh.');
}

module.exports = { start, onMessage, onMessageDelete, isQuietHours };
