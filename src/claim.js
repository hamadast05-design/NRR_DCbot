const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { config } = require('./config');

const CHANNEL_ID = config.claimChannelId;
const DURATION_MS = config.claimDurationMs;
const OWNER_COOLDOWN_MS = config.claimOwnerCooldownMs;
let ready = false;
let ticking = false;
let working = false;

function formatDuration(ms) {
  let seconds = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(seconds / 86400); seconds %= 86400;
  const h = Math.floor(seconds / 3600); seconds %= 3600;
  const m = Math.floor(seconds / 60); seconds %= 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (seconds || !parts.length) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function parseDuration(input) {
  const text = String(input || '').trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/);
  if (!match) return null;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = Number(match[1]) * multipliers[match[2]];
  if (!Number.isFinite(ms) || ms < 1000 || ms > 7 * 86400000) return null;
  return Math.round(ms);
}

async function ensureSchema() {
  // PostgreSQL prepared statements accept one SQL command at a time.
  // Keep schema creation sequential so node-postgres does not try to prepare
  // the entire migration block as a single multi-command statement.
  await db.query(`
    CREATE TABLE IF NOT EXISTS channel_claim_state (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      owner_id TEXT,
      claimed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      reminder_45_sent BOOLEAN NOT NULL DEFAULT FALSE,
      reminder_5_sent BOOLEAN NOT NULL DEFAULT FALSE,
      reminder_1_sent BOOLEAN NOT NULL DEFAULT FALSE,
      countdown_started BOOLEAN NOT NULL DEFAULT FALSE,
      countdown_value INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS channel_claim_cooldowns (
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      blocked_until TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (channel_id, user_id)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_claim_cooldowns_until
      ON channel_claim_cooldowns(channel_id, blocked_until)
  `);

  await db.query(`
    INSERT INTO channel_claim_state (channel_id, guild_id)
    VALUES ($1, $2)
    ON CONFLICT (channel_id) DO NOTHING
  `, [CHANNEL_ID, config.claimGuildId || 'unknown']);

  ready = true;
}

function isClaimMessage(message) {
  return Boolean(message.guild && message.channelId === CHANNEL_ID && !message.author.bot);
}

function botChannelPermissions(channel) {
  const me = channel.guild.members.me;
  if (!me) return null;
  return channel.permissionsFor(me);
}

function botCanManage(channel) {
  const perms = botChannelPermissions(channel);
  return Boolean(perms?.has(PermissionFlagsBits.ViewChannel) &&
    perms?.has(PermissionFlagsBits.SendMessages) &&
    perms?.has(PermissionFlagsBits.ManageChannels));
}

function missingBotPermissions(channel) {
  const perms = botChannelPermissions(channel);
  if (!perms) return ['Bot member is not available in this guild.'];
  const required = [
    [PermissionFlagsBits.ViewChannel, 'View Channel'],
    [PermissionFlagsBits.SendMessages, 'Send Messages'],
    [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
  ];
  return required.filter(([flag]) => !perms.has(flag)).map(([, name]) => name);
}

const ownerAllow = {
  ManageChannels: true,
  UseApplicationCommands: true,
  ManageThreads: true,
  ManageMessages: true,
  PinMessages: true,
  UseEmbeddedActivities: true,
};

const ownerDeny = {
  ManageRoles: false,
  ManageWebhooks: false,
  ManageGuildExpressions: false,
  ManageEvents: false,
};

async function grantOwner(channel, userId) {
  const missing = missingBotPermissions(channel);
  if (missing.length) throw new Error(`Bot is missing channel permissions: ${missing.join(', ')}.`);
  const member = await channel.guild.members.fetch(userId);
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Administrator members cannot claim this channel because Administrator bypasses channel restrictions.');
  }

  // Editing a member overwrite is controlled by the bot's channel permissions,
  // not by whether the claimant's role is above or below the bot.
  await channel.permissionOverwrites.edit(
    userId,
    { ...ownerAllow, ...ownerDeny },
    'Temporary free-channel ownership'
  );
}

async function removeOwner(channel, userId) {
  if (userId) await channel.permissionOverwrites.delete(userId, 'Free-channel ownership ended').catch(() => {});
}

async function getState() {
  const r = await db.query('SELECT * FROM channel_claim_state WHERE channel_id = $1 LIMIT 1', [CHANNEL_ID]);
  return r.rows[0] || null;
}

async function cooldownUntil(userId) {
  const r = await db.query('SELECT blocked_until FROM channel_claim_cooldowns WHERE channel_id=$1 AND user_id=$2 AND blocked_until > NOW() LIMIT 1', [CHANNEL_ID, userId]);
  return r.rows[0]?.blocked_until || null;
}

async function saveCooldown(userId) {
  const blocked = new Date(Date.now() + OWNER_COOLDOWN_MS);
  await db.query(`
    INSERT INTO channel_claim_cooldowns (channel_id,user_id,blocked_until)
    VALUES ($1,$2,$3)
    ON CONFLICT (channel_id,user_id)
    DO UPDATE SET blocked_until = GREATEST(channel_claim_cooldowns.blocked_until, EXCLUDED.blocked_until)
  `, [CHANNEL_ID, userId, blocked]);
}

async function claim(message) {
  if (!ready || !isClaimMessage(message) || working) return;
  const channel = message.channel;
  if (!channel.isTextBased() || !channel.permissionOverwrites) return;
  const missing = missingBotPermissions(channel);
  if (missing.length) {
    console.error(`Free-channel claim unavailable in #${channel.id}: missing ${missing.join(', ')}`);
    return;
  }
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply('❌ Administrators cannot claim this channel because Administrator bypasses channel restrictions.').catch(() => {});
    return;
  }
  const blocked = await cooldownUntil(member.id);
  if (blocked) {
    await message.reply(`⏳ You cannot claim this channel again for **${formatDuration(new Date(blocked).getTime() - Date.now())}**.`).catch(() => {});
    return;
  }

  working = true;
  let previousOwner = null;
  try {
    const client = await db.pool.connect();
    let expires;
    try {
      await client.query('BEGIN');
      const r = await client.query('SELECT * FROM channel_claim_state WHERE channel_id=$1 FOR UPDATE', [CHANNEL_ID]);
      const state = r.rows[0];
      if (!state) throw new Error('Claim state row missing.');
      if (state.owner_id && state.expires_at && new Date(state.expires_at).getTime() > Date.now()) {
        await client.query('ROLLBACK');
        return;
      }
      previousOwner = state.owner_id || null;
      const blockedAgain = await client.query('SELECT blocked_until FROM channel_claim_cooldowns WHERE channel_id=$1 AND user_id=$2 AND blocked_until > NOW() FOR UPDATE', [CHANNEL_ID, member.id]);
      if (blockedAgain.rows[0]) {
        await client.query('ROLLBACK');
        await message.reply(`⏳ You cannot claim this channel again for **${formatDuration(new Date(blockedAgain.rows[0].blocked_until).getTime() - Date.now())}**.`).catch(() => {});
        return;
      }
      const now = new Date();
      expires = new Date(now.getTime() + DURATION_MS);
      await client.query(`
        UPDATE channel_claim_state
        SET guild_id=$2, owner_id=$3, claimed_at=$4, expires_at=$5,
            reminder_45_sent=FALSE, reminder_5_sent=FALSE, reminder_1_sent=FALSE,
            countdown_started=FALSE, countdown_value=NULL, updated_at=NOW()
        WHERE channel_id=$1
      `, [CHANNEL_ID, message.guild.id, member.id, now, expires]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    try {
      await grantOwner(channel, member.id);
    } catch (error) {
      await db.query('UPDATE channel_claim_state SET owner_id=NULL, claimed_at=NULL, expires_at=NULL, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$2', [CHANNEL_ID, member.id]);
      throw error;
    }

    if (previousOwner && previousOwner !== member.id) {
      await removeOwner(channel, previousOwner);
      await saveCooldown(previousOwner);
    }

    await channel.send({
      content: `🏆 **Channel claimed!**\n\nCongratulations <@${member.id}>! You are now the temporary manager of this channel for **${formatDuration(DURATION_MS)}**.`,
      allowedMentions: { users: [member.id] },
    }).catch(() => {});
  } catch (error) {
    console.error('Free-channel claim error:', error);
  } finally {
    working = false;
  }
}

async function expire(client, state) {
  if (!state?.owner_id) return;
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const ownerId = state.owner_id;
  await removeOwner(channel, ownerId);
  await saveCooldown(ownerId);
  await db.query(`
    UPDATE channel_claim_state
    SET owner_id=NULL, claimed_at=NULL, expires_at=NULL,
        reminder_45_sent=FALSE, reminder_5_sent=FALSE, reminder_1_sent=FALSE,
        countdown_started=FALSE, countdown_value=NULL, updated_at=NOW()
    WHERE channel_id=$1 AND owner_id=$2
  `, [CHANNEL_ID, ownerId]);
  await channel.send({ content: `⏰ <@${ownerId}>'s **channel ownership has ended.** The channel is now open for the next person to claim.`, allowedMentions: { users: [ownerId] } }).catch(() => {});
}

async function tick(client) {
  if (!ready || ticking) return;
  ticking = true;
  try {
    const state = await getState();
    if (!state?.owner_id || !state.expires_at) return;
    const remaining = new Date(state.expires_at).getTime() - Date.now();
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;
    if (remaining <= 0) return expire(client, state);

    if (remaining <= 45 * 60000 && !state.reminder_45_sent) {
      await channel.send({ content: `⏰ <@${state.owner_id}> **45 minutes remain.** Half of your ownership time has been spent.`, allowedMentions: { users: [state.owner_id] } }).catch(() => {});
      await db.query('UPDATE channel_claim_state SET reminder_45_sent=TRUE, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$2', [CHANNEL_ID, state.owner_id]);
    }
    if (remaining <= 5 * 60000 && !state.reminder_5_sent) {
      await channel.send({ content: `⚠️ <@${state.owner_id}> **5 minutes remain** on your channel ownership.`, allowedMentions: { users: [state.owner_id] } }).catch(() => {});
      await db.query('UPDATE channel_claim_state SET reminder_5_sent=TRUE, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$2', [CHANNEL_ID, state.owner_id]);
    }
    if (remaining <= 60000 && !state.reminder_1_sent) {
      await channel.send({ content: `⚠️ <@${state.owner_id}> **1 minute remains** on your channel ownership.`, allowedMentions: { users: [state.owner_id] } }).catch(() => {});
      await db.query('UPDATE channel_claim_state SET reminder_1_sent=TRUE, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$2', [CHANNEL_ID, state.owner_id]);
    }

    if (remaining <= 10000) {
      const current = Math.min(10, Math.max(1, Math.ceil(remaining / 1000)));
      const last = Number(state.countdown_value || 11);
      if (!state.countdown_started) {
        await channel.send(`**${current}**`).catch(() => {});
        await db.query('UPDATE channel_claim_state SET countdown_started=TRUE, countdown_value=$2, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$3', [CHANNEL_ID, current, state.owner_id]);
      } else if (current < last) {
        for (let n = last - 1; n >= current; n--) await channel.send(`**${n}**`).catch(() => {});
        await db.query('UPDATE channel_claim_state SET countdown_value=$2, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$3', [CHANNEL_ID, current, state.owner_id]);
      }
    }
  } catch (error) {
    console.error('Free-channel scheduler error:', error);
  } finally {
    ticking = false;
  }
}

async function revoke(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You do not have permission to revoke channel ownership.', ephemeral: true });
  const state = await getState();
  if (!state?.owner_id) return interaction.reply({ content: 'ℹ️ The channel is already open for anyone to claim.', ephemeral: true });
  const ownerId = state.owner_id;
  const channel = await interaction.client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return interaction.reply({ content: '❌ The claim channel could not be found.', ephemeral: true });
  working = true;
  try {
    await removeOwner(channel, ownerId);
    await saveCooldown(ownerId);
    await db.query('UPDATE channel_claim_state SET owner_id=NULL, claimed_at=NULL, expires_at=NULL, reminder_45_sent=FALSE, reminder_5_sent=FALSE, reminder_1_sent=FALSE, countdown_started=FALSE, countdown_value=NULL, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$2', [CHANNEL_ID, ownerId]);
    await channel.send({ content: `🔓 **Ownership revoked.** <@${ownerId}> no longer manages this channel. The spot is now open to claim.`, allowedMentions: { users: [ownerId] } }).catch(() => {});
    return interaction.reply({ content: `✅ Revoked <@${ownerId}>'s channel ownership.`, ephemeral: true });
  } catch (error) {
    console.error('Free-channel revoke error:', error);
    return interaction.reply({ content: '❌ I could not safely revoke the current ownership.', ephemeral: true });
  } finally {
    working = false;
  }
}

async function editCountdown(interaction) {
  const state = await getState();
  if (!state?.owner_id) return interaction.reply({ content: '❌ There is no current channel owner.', ephemeral: true });
  if (state.owner_id !== interaction.user.id) return interaction.reply({ content: '❌ Only the current channel owner can edit the countdown.', ephemeral: true });
  const duration = parseDuration(interaction.options.getString('time', true));
  if (!duration) return interaction.reply({ content: '❌ Invalid time. Use `30s`, `5m`, `1h`, or `1d` (maximum 7 days).', ephemeral: true });
  const expires = new Date(Date.now() + duration);
  await db.query('UPDATE channel_claim_state SET expires_at=$2, reminder_45_sent=FALSE, reminder_5_sent=FALSE, reminder_1_sent=FALSE, countdown_started=FALSE, countdown_value=NULL, updated_at=NOW() WHERE channel_id=$1 AND owner_id=$3', [CHANNEL_ID, expires, interaction.user.id]);
  return interaction.reply({ content: `⏱️ Countdown updated. **${formatDuration(duration)}** remains.`, ephemeral: false });
}

async function onMessage(message) {
  if (isClaimMessage(message)) await claim(message);
}

module.exports = { ensureSchema, onMessage, tick, revoke, editCountdown };
