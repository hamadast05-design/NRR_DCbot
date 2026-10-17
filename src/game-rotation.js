const wordkillSystem = require('./wordkill');
const politicalTriviaSystem = require('./political-trivia');
const chatRevivalSystem = require('./chat-revival');
const automationControl = require('./automation-control');

const CHANNEL_ID = process.env.GENERAL_CHAT_CHANNEL_ID || '1487521278591111399';
const GAME_PING_ROLE_ID = process.env.GAME_PING_ROLE_ID || '1487521278591111399';
const INVITE_INTERVAL_MS = 90 * 60 * 1000;
const REACTION_WINDOW_MS = 120 * 1000;
const REQUIRED_REACTIONS = 4;
const CHECK_INTERVAL_MS = 10 * 1000;

let clientRef = null;
let activeInvite = null;
let activeGame = null;
let nextAllowedAt = 0;
let lastPromptKind = null;
let started = false;
let quietHoursSuppressed = false;

function getSystem(kind) {
  return kind === 'wordkill' ? wordkillSystem : politicalTriviaSystem;
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
  nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
  console.log('Automatic game invite cancelled; cooldown started. Reason: ' + reason);
}

async function startInvitedGame(invite) {
  if (!activeInvite || activeInvite.message.id !== invite.message.id) return;
  clearTimeout(activeInvite.timeout);
  activeInvite = null;
  const system = getSystem(invite.kind);
  try {
    const result = await system.start(invite.channel);
    if (!result?.ok) {
      nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
      await invite.channel.send('❌ The automatic game could not start. The 90-minute cooldown is now active.').catch(() => {});
      console.error('Automatic game start declined:', result?.message || invite.kind);
      return;
    }
    activeGame = { kind: invite.kind, channelId: invite.channel.id };
    console.log('Automatic ' + invite.kind + ' game started from reaction invitation.');
  } catch (error) {
    nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
    console.error('Automatic game start failed:', error);
    await invite.channel.send('❌ The automatic game failed to start. The 90-minute cooldown is now active.').catch(() => {});
  }
}

async function createInvite() {
  if (activeInvite || activeGame) return;
  if (chatRevivalSystem.isQuietHours()) {
    quietHoursSuppressed = true;
    return;
  }
  // Like Chat Revival, do not send a catch-up invitation immediately when quiet hours end.
  if (quietHoursSuppressed) {
    quietHoursSuppressed = false;
    nextAllowedAt = Math.max(nextAllowedAt, Date.now() + INVITE_INTERVAL_MS);
    console.log('Automatic game invitations resuming after Saudi quiet hours; waiting through the cooldown first.');
    return;
  }
  if (automationControl.isStopped()) return;
  if (Date.now() < nextAllowedAt) return;
  const channel = await getChannel();
  if (!channel) {
    console.error('Automatic games cannot access the configured general chat channel:', CHANNEL_ID);
    nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
    return;
  }
  const kind = lastPromptKind === 'wordkill' ? 'political-trivia' : 'wordkill';
  lastPromptKind = kind;
  const role = await channel.guild.roles.fetch(GAME_PING_ROLE_ID).catch(() => null);
  if (!role) {
    console.error('Automatic games cannot ping Game Ping role; configure a valid GAME_PING_ROLE_ID:', GAME_PING_ROLE_ID);
    nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
    return;
  }
  const phrase = kind === 'wordkill'
    ? '4 Reactions to start WordKill, React with ✅️ if you will participate.'
    : '4 Reactions to start Political Trivia, React with ✅️ if you will participate.';
  const content = '<@&' + role.id + '> ' + phrase;
  try {
    const message = await channel.send({
      content,
      allowedMentions: { parse: [], roles: [role.id] }
    });

    // Register the invite before adding the bot's own reaction. Discord can
    // emit MessageReactionAdd events while message.react() is still resolving.
    const invite = { kind, channel, message, timeout: null, ready: false, reaction: null };
    activeInvite = invite;

    invite.reaction = await message.react('✅');
    invite.ready = true;
    invite.timeout = setTimeout(() => {
      if (activeInvite?.message.id === message.id) {
        cancelInvite('fewer than four legitimate reactions were received within 120 seconds.');
      }
    }, REACTION_WINDOW_MS);

    console.log('Automatic ' + kind + ' invitation posted in #' + (channel.name || channel.id) + '.');
    // Count again after the bot reaction succeeds, in case members reacted
    // during setup and their reaction events arrived before the invite was ready.
    await evaluateInviteReactions(invite, invite.reaction);
  } catch (error) {
    if (activeInvite?.channel.id === channel.id) {
      clearTimeout(activeInvite.timeout);
      activeInvite = null;
    }
    console.error('Automatic game invitation failed:', error);
    nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
  }
}

async function checkActiveGame() {
  if (!activeGame) return;
  if (isGameActive(activeGame.kind, activeGame.channelId)) return;
  activeGame = null;
  nextAllowedAt = Date.now() + INVITE_INTERVAL_MS;
  console.log('Automatic game ended; 90-minute cooldown started.');
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
  nextAllowedAt = Math.max(nextAllowedAt, Date.now() + INVITE_INTERVAL_MS);
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
  console.log('Automatic game rotation enabled: 90-minute cooldown, 120-second reaction window, four legitimate reactions including the bot.');
}

module.exports = { start, onReactionAdd, pauseInvitations };
