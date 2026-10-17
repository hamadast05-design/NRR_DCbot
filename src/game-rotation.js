const wordkillSystem = require('./wordkill');
const politicalTriviaSystem = require('./political-trivia');
const chatRevivalSystem = require('./chat-revival');
const automationControl = require('./automation-control');
const dailyPings = require('./daily-ping-scheduler');
const flagRushSystem = require('./flagrush');
const guessPoliticianSystem = require('./guess-the-politician');

const CHANNEL_ID = process.env.GENERAL_CHAT_CHANNEL_ID || '1487521278591111399';
const GAME_PING_ROLE_ID = process.env.GAME_PING_ROLE_ID || '1487521278591111399';
const REACTION_WINDOW_MS = 120 * 1000;
const REQUIRED_REACTIONS = 4;
const CHECK_INTERVAL_MS = 10 * 1000;

let clientRef = null;
let activeInvite = null;
let activeGame = null;
const SCHEDULE_KEY = 'game-invitations';
const GAME_KINDS = ['wordkill', 'political-trivia', 'flagrush', 'gtp'];
let nextKindIndex = 0;
let started = false;
let creatingInvite = false;

function getSystem(kind) {
  if (kind === 'wordkill') return wordkillSystem;
  if (kind === 'political-trivia') return politicalTriviaSystem;
  if (kind === 'flagrush') return flagRushSystem;
  return guessPoliticianSystem;
}

function isGameActive(kind, channelId) {
  return Boolean(getSystem(kind).getGame(channelId));
}

async function getChannel() {
  if (!clientRef) return null;
  const channel = await clientRef.channels.fetch(CHANNEL_ID).catch(() => null);
  return channel?.isTextBased() && channel.guild && channel.send ? channel : null;
}

async function countLegitimateReactions(reaction) {
  let users;
  try {
    // Four reactions is a tiny threshold, so fetching up to 100 users is ample.
    users = await reaction.users.fetch({ limit: 100 });
  } catch (error) {
    console.error('Could not fetch users for automatic game invitation reaction:', error);
    return null;
  }

  const legitimateUserIds = new Set(
    [...users.values()]
      .filter(user => !user.bot || user.id === clientRef?.user?.id)
      .map(user => user.id)
  );

  // Discord's reaction-user fetch can briefly lag behind the reaction event.
  // If this bot added the emoji, count its own reaction even if that user
  // was not included in the fetched collection.
  if (reaction.me && clientRef?.user?.id) {
    legitimateUserIds.add(clientRef.user.id);
  }

  return legitimateUserIds.size;
}

async function evaluateInviteReactions(invite, reaction) {
  if (!activeInvite || activeInvite.message.id !== invite.message.id || !invite.ready) return;

  const count = await countLegitimateReactions(reaction);
  if (count === null) {
    console.warn('Automatic game invite reaction count could not be verified; waiting for the next reaction event.');
    return;
  }

  console.log(`Automatic ${invite.kind} invite has ${count}/${REQUIRED_REACTIONS} legitimate ✅ reactions.`);

  // Re-check after the asynchronous fetch so a timed-out/replaced invite
  // cannot start a game from a stale reaction event.
  if (count >= REQUIRED_REACTIONS && activeInvite?.message.id === invite.message.id) {
    await startInvitedGame(invite);
  }
}

async function cancelInvite(reason) {
  if (!activeInvite) return;
  clearTimeout(activeInvite.timeout);
  const invite = activeInvite;
  activeInvite = null;
  console.log('Automatic game invite cancelled. Reason: ' + reason);
}

async function startInvitedGame(invite) {
  if (!activeInvite || activeInvite.message.id !== invite.message.id) return;
  clearTimeout(activeInvite.timeout);
  activeInvite = null;
  const system = getSystem(invite.kind);
  try {
    const result = await system.start(invite.channel);
    if (!result?.ok) {
      await invite.channel.send('❌ The automatic game could not start.').catch(() => {});
      console.error('Automatic game start declined:', result?.message || invite.kind);
      return;
    }
    activeGame = { kind: invite.kind, channelId: invite.channel.id };
    console.log('Automatic ' + invite.kind + ' game started from reaction invitation.');
  } catch (error) {
    console.error('Automatic game start failed:', error);
    await invite.channel.send('❌ The automatic game failed to start.').catch(() => {});
  }
}

async function createInvite() {
  if (creatingInvite || activeInvite || activeGame || automationControl.isStopped()) return;
  if (chatRevivalSystem.isQuietHours()) return;
  if (!(await dailyPings.isDue(SCHEDULE_KEY))) return;
  creatingInvite = true;
  try {
    const channel = await getChannel();
    if (!channel) {
      console.error('Automatic games cannot access the configured general chat channel:', CHANNEL_ID);
      return;
    }
    const role = await channel.guild.roles.fetch(GAME_PING_ROLE_ID).catch(() => null);
    if (!role) {
      console.error('Automatic games cannot ping Game Ping role; configure a valid GAME_PING_ROLE_ID:', GAME_PING_ROLE_ID);
      return;
    }
    const kind = GAME_KINDS[nextKindIndex % GAME_KINDS.length];
    const phrase = {
      'wordkill': '4 Reactions to start WordKill, React with ✅️ if you will participate.',
      'political-trivia': '4 Reactions to start Political Trivia, React with ✅️ if you will participate.',
      'flagrush': '4 Reactions to start FlagRush, React with ✅️ if you will participate.',
      'gtp': '4 Reactions to start Guess The Politician, React with ✅️ if you will participate.'
    }[kind];
    const claimed = await dailyPings.claimDue(SCHEDULE_KEY);
    if (!claimed) return;
    const message = await channel.send({
      content: '<@&' + role.id + '> ' + phrase,
      allowedMentions: { parse: [], roles: [role.id] }
    });
    nextKindIndex = (nextKindIndex + 1) % GAME_KINDS.length;
    const invite = { kind, channel, message, timeout: null, ready: false, reaction: null };
    activeInvite = invite;
    invite.reaction = await message.react('✅');
    invite.ready = true;
    invite.timeout = setTimeout(() => {
      if (activeInvite?.message.id === message.id) cancelInvite('fewer than four legitimate reactions were received within 120 seconds.');
    }, REACTION_WINDOW_MS);
    console.log('Automatic ' + kind + ' invitation posted in #' + (channel.name || channel.id) + '.');
    await evaluateInviteReactions(invite, invite.reaction);
  } catch (error) {
    if (activeInvite) {
      clearTimeout(activeInvite.timeout);
      activeInvite = null;
    }
    console.error('Automatic game invitation failed:', error);
  } finally {
    creatingInvite = false;
  }
}

async function checkActiveGame() {
  if (!activeGame) return;
  if (isGameActive(activeGame.kind, activeGame.channelId)) return;
  activeGame = null;
  console.log('Automatic game ended.');
}

async function onReactionAdd(reaction, user) {
  if (!activeInvite || !user || (user.bot && user.id !== clientRef?.user?.id)) return;

  if (reaction.partial) {
    const fetchedReaction = await reaction.fetch().catch(error => {
      console.error('Could not fetch partial automatic game invite reaction:', error);
      return null;
    });
    if (!fetchedReaction) return;
    reaction = fetchedReaction;
  }

  const invite = activeInvite;
  if (!reaction.message || reaction.message.id !== invite.message.id) return;
  if (reaction.emoji.name !== '✅') return;
  if (!invite.ready) return;

  await evaluateInviteReactions(invite, reaction);
}

function pauseInvitations() {
  if (!activeInvite) return;
  clearTimeout(activeInvite.timeout);
  activeInvite = null;
  console.log('Pending automatic game invitation cleared while invitations are paused.');
}

function start(client) {
  if (started) return;
  started = true;
  clientRef = client;
  createInvite().catch(error => console.error('Automatic game invitation check failed:', error));
  setInterval(async () => {
    try {
      await checkActiveGame();
      await createInvite();
    } catch (error) {
      console.error('Automatic game rotation check failed:', error);
    }
  }, CHECK_INTERVAL_MS);
  dailyPings.ensureSchedule(SCHEDULE_KEY).catch(error => console.error('Game invitation schedule initialization failed:', error));
  console.log('Automatic game invitations enabled: up to 3 randomized posts per Saudi day, at least 60 minutes apart; 120-second reaction window; four legitimate reactions including the bot.');
}

module.exports = { start, onReactionAdd, pauseInvitations };
