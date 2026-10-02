const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { config } = require('./config');

const CLAIM_CHANNEL_ID = config.claimChannelId;
const DEFAULT_DURATION_MS = config.claimDurationMs;
const OWNER_COOLDOWN_MS = config.claimOwnerCooldownMs;

let ready = false;
let ticking = false;

function parseDuration(input) {
  const text = String(input || '').trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[unit];
  const duration = amount * multiplier;
  if (!Number.isFinite(duration) || duration < 1000 || duration > 7 * 24 * 60 * 60 * 1000) return null;
  return Math.round(duration);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || !parts.length) parts.push(`${seconds}s`);
  return parts.join(' ');
}

async function ensureSchema() {
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
    );
    CREATE TABLE IF NOT EXISTS channel_claim_cooldowns (
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      blocked_until TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (channel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_channel_claim_cooldowns_until
      ON channel_claim_cooldowns(channel_id, blocked_until);
    INSERT INTO channel_claim_state (channel_id, guild_id)
      SELECT $1, $2
      WHERE NOT EXISTS (SELECT 1 FROM channel_claim_state WHERE channel_id = $1);
  `, [CLAIM_CHANNEL_ID, config.claimGuildId || 'unknown']);
  ready = true;
}

function isClaimChannel(message) {
  return Boolean(message.guild && message.channelId === CLAIM_CHANNEL_ID && !message.author.bot);
}

function botCanManage(channel) {
  const me = channel.guild.members.me;
  if (!me) return false;
  const permissions = channel.permissionsFor(me);
  return Boolean(permissions?.has(PermissionFlagsBits.ManageChannels) && permissions?.has(PermissionFlagsBits.ManageRoles));
}

function ownerPermissions() {
  return {
    ManageChannels: true,
    UseApplicationCommands: true,
    ManageThreads: true,
    ManageMessages: true,
    PinMessages: true,
    UseEmbeddedActivities: true,
    ManageRoles: false,
    ManageWebhooks: false,
    ManageGuildExpressions: false,
  };
}

async function getState() {
  const result = await db.query('SELECT * FROM channel_claim_state WHERE channel_id = $1 LIMIT 1', [CLAIM_CHANNEL_ID]);
  return result.rows[0] || null;
}

async function getCooldown(userId) {
  const result = await db.query(`
    SELECT blocked_until FROM channel_claim_cooldowns
    WHERE channel_id = $1 AND user_id = $2
      AND blocked_until > NOW()
    LIMIT 1
  `, [CLAIM_CHANNEL_ID, userId]);
  return result.rows[0]?.blocked_until || null;
}

async function setOwnerPermissions(channel, userId) {
  if (!botCanManage(channel)) throw new Error('Bot needs Manage Channels and Manage Roles in the claim channel.');
  const member = await channel.guild.members.fetch(userId);
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Administrators cannot claim this channel because Administrator bypasses channel overwrites.');
  }
  await channel.permissionOverwrites.edit(member, ownerPermissions(), 'Temporary free-channel ownership');
}

async function removeOwnerPermissions(channel, userId) {
  if (!userId) return;
  await channel.permissionOverwrites.delete(userId, 'Free-channel ownership expired');
}

async function claim(message) {
  if (!ready || !isClaimChannel(message)) return;
  const channel = message.channel;
  if (!channel.isTextBased() || !channel.permissionOverwrites) return;
  if (!botCanManage(channel)) {
    console.error(`Free channel ${CLAIM_CHANNEL_ID}: bot lacks Manage Channels and/or Manage Roles.`);
    return;
  }

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || member.user.bot) return;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply('❌ Administrators cannot claim this channel because their Administrator permission bypasses channel restrictions.').catch(() => {});
    return;
  }

  const cooldown = await getCooldown(member.id);
  if (cooldown) {
    const remaining = new Date(cooldown).getTime() - Date.now();
    await message.reply(`⏳ You cannot claim this channel again for **${formatDuration(remaining)}**.`).catch(() => {});
    return;
  }

  const durationMs = DEFAULT_DURATION_MS;
  let claimed = false;
  let previousOwner = null;
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const stateResult = await client.query('SELECT * FROM channel_claim_state WHERE channel_id = $1 FOR UPDATE', [CLAIM_CHANNEL_ID]);
      const state = stateResult.rows[0];
      if (!state) throw new Error('Claim channel state is missing.');
      if (state.owner_id && state.expires_at && new Date(state.expires_at).getTime() > Date.now()) {
        await client.query('ROLLBACK');
        return;
      }
      if (state.owner_id) previousOwner = state.owner_id;

      const blocked = await client.query(`
        SELECT blocked_until FROM channel_claim_cooldowns
        WHERE channel_id = $1 AND user_id = $2 AND blocked_until > NOW()
        FOR UPDATE
      `, [CLAIM_CHANNEL_ID, member.id]);
      if (blocked.rows[0]) {
        await client.query('ROLLBACK');
        const remaining = new Date(blocked.rows[0].blocked_until).getTime() - Date.now();
        await message.reply(`⏳ You cannot claim this channel again for **${formatDuration(remaining)}**.`).catch(() => {});
        return;
      }

      const now = new Date();
      const expires = new Date(now.getTime() + durationMs);
      await client.query(`
        INSERT INTO channel_claim_state
          (channel_id, guild_id, owner_id, claimed_at, expires_at, reminder_45_sent, reminder_5_sent, reminder_1_sent, countdown_started, countdown_value, updated_at)
        VALUES ($1,$2,$3,$4,$5,FALSE,FALSE,FALSE,FALSE,NULL,NOW())
        ON CONFLICT (channel_id) DO UPDATE SET
          guild_id = EXCLUDED.guild_id,
          owner_id = EXCLUDED.owner_id,
          claimed_at = EXCLUDED.claimed_at,
          expires_at = EXCLUDED.expires_at,
          reminder_45_sent = FALSE,
          reminder_5_sent = FALSE,
          reminder_1_sent = FALSE,
          countdown_started = FALSE,
          countdown_value = NULL,
          updated_at = NOW()
      `, [CLAIM_CHANNEL_ID, message.guild.id, member.id, now, expires]);
      await client.query('COMMIT');
      claimed = true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    try {
      await setOwnerPermissions(channel, member.id);
    } catch (error) {
      await db.query(`
        UPDATE channel_claim_state
        SET owner_id = NULL, claimed_at = NULL, expires_at = NULL, updated_at = NOW()
        WHERE channel_id = $1 AND owner_id = $2
      `, [CLAIM_CHANNEL_ID, member.id]);
      throw error;
    }

    if (previousOwner && previousOwner !== member.id) {
      await removeOwnerPermissions(channel, previousOwner).catch(error => console.error('Previous free-channel permission cleanup failed:', error));
      await db.query(`
        INSERT INTO channel_claim_cooldowns (channel_id, user_id, blocked_until)
        VALUES ($1,$2,NOW() + INTERVAL '24 hours')
        ON CONFLICT (channel_id,user_id) DO UPDATE SET blocked_until = GREATEST(channel_claim_cooldowns.blocked_until, EXCLUDED.blocked_until)
      `, [CLAIM_CHANNEL_ID, previousOwner]);
    }

    const expires = new Date(Date.now() + durationMs);
    await message.channel.send(`🏆 **Channel claimed!**\n\nCongratulations <@${member.id}>! You are now the temporary manager of this channel for **${formatDuration(durationMs)}**.\n\nYou have been given only the configured channel-management permissions for this channel.`).catch(() => {});
    console.log(`Free channel claimed by ${member.id}; expires ${expires.toISOString()}.`);
  } catch (error) {
    console.error('Free channel claim error:', error);
    if (claimed) {
      await db.query('UPDATE channel_claim_state SET owner_id = NULL, claimed_at = NULL, expires_at = NULL, updated_at = NOW() WHERE channel_id = $1', [CLAIM_CHANNEL_ID]).catch(() => {});
    }
  }
}

async function expire(client, state) {
  if (!state?.owner_id) return;
  const channel = await client.channels.fetch(CLAIM_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;

  await removeOwnerPermissions(channel, state.owner_id).catch(error => console.error('Free channel permission cleanup failed:', error));
  await db.query(`
    UPDATE channel_claim_cooldowns (channel_id, user_id, blocked_until)
    VALUES ($1,$2,NOW() + INTERVAL '24 hours')
  `, [CLAIM_CHANNEL_ID, state.owner_id]).catch(async () => {
    await db.query(`
      INSERT INTO channel_claim_cooldowns (channel_id, user_id, blocked_until)
      VALUES ($1,$2,NOW() + INTERVAL '24 hours')
      ON CONFLICT (channel_id,user_id) DO UPDATE SET blocked_until = GREATEST(channel_claim_cooldowns.blocked_until, EXCLUDED.blocked_until)
    `, [CLAIM_CHANNEL_ID, state.owner_id]).catch(error => console.error('Cooldown save failed:', error));
  });

  await db.query(`
    UPDATE channel_claim_state
    SET owner_id = NULL, claimed_at = NULL, expires_at = NULL,
        reminder_45_sent = FALSE, reminder_5_sent = FALSE, reminder_1_sent = FALSE,
        countdown_started = FALSE, countdown_value = NULL, updated_at = NOW()
    WHERE channel_id = $1 AND owner_id = $2
  `, [CLAIM_CHANNEL_ID, state.owner_id]);
  await channel.send(`⏰ <@${state.owner_id}>'s **1.5-hour channel ownership has ended.** The channel is now open for the next person to claim.`).catch(() => {});
}

async function tick(client) {
  if (!ready || ticking) return;
  ticking = true;
  try {
    const state = await getState();
    if (!state?.owner_id || !state.expires_at) return;
    const remaining = new Date(state.expires_at).getTime() - Date.now();
    const channel = await client.channels.fetch(CLAIM_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;

    if (remaining <= 0) {
      await expire(client, state);
      return;
    }

    if (remaining <= 45 * 60 * 1000 && !state.reminder_45_sent) {
      await channel.send(`⏰ <@${state.owner_id}> **45 minutes remain.** Half of your channel-management time has been used.`).catch(() => {});
      await db.query('UPDATE channel_claim_state SET reminder_45_sent = TRUE, updated_at = NOW() WHERE channel_id = $1 AND owner_id = $2', [CLAIM_CHANNEL_ID, state.owner_id]);
      state.reminder_45_sent = true;
    }
    if (remaining <= 5 * 60 * 1000 && !state.reminder_5_sent) {
      await channel.send(`⚠️ <@${state.owner_id}> **5 minutes remain** on your channel ownership.`).catch(() => {});
      await db.query('UPDATE channel_claim_state SET reminder_5_sent = TRUE, updated_at = NOW() WHERE channel_id = $1 AND owner_id = $2', [CLAIM_CHANNEL_ID, state.owner_id]);
      state.reminder_5_sent = true;
    }
    if (remaining <= 60 * 1000 && !state.reminder_1_sent) {
      await channel.send(`⚠️ <@${state.owner_id}> **1 minute remains** on your channel ownership.`).catch(() => {});
      await db.query('UPDATE channel_claim_state SET reminder_1_sent = TRUE, updated_at = NOW() WHERE channel_id = $1 AND owner_id = $2', [CLAIM_CHANNEL_ID, state.owner_id]);
      state.reminder_1_sent = true;
    }

    if (remaining <= 10 * 1000) {
      const current = Math.min(10, Math.max(1, Math.ceil(remaining / 1000)));
      const last = Number(state.countdown_value || 11);
      if (!state.countdown_started || current < last) {
        await channel.send(`**${current}**`).catch(() => {});
        await db.query(`
          UPDATE channel_claim_state
          SET countdown_started = TRUE, countdown_value = $2, updated_at = NOW()
          WHERE channel_id = $1 AND owner_id = $3
        `, [CLAIM_CHANNEL_ID, current, state.owner_id]);
      }
    }
  } catch (error) {
    console.error('Free channel scheduler error:', error);
  } finally {
    ticking = false;
  }
}

async function revoke(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ You do not have permission to revoke channel ownership.', ephemeral: true });
  }
  const state = await getState();
  if (!state?.owner_id) return interaction.reply({ content: 'ℹ️ The channel is currently open for anyone to claim.', ephemeral: true });
  const ownerId = state.owner_id;
  const channel = await interaction.client.channels.fetch(CLAIM_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return interaction.reply({ content: '❌ The claim channel could not be found.', ephemeral: true });

  try {
    await removeOwnerPermissions(channel, ownerId);
    await db.query(`
      INSERT INTO channel_claim_cooldowns (channel_id, user_id, blocked_until)
      VALUES ($1,$2,NOW() + INTERVAL '24 hours')
      ON CONFLICT (channel_id,user_id) DO UPDATE SET blocked_until = GREATEST(channel_claim_cooldowns.blocked_until, EXCLUDED.blocked_until)
    `, [CLAIM_CHANNEL_ID, ownerId]);
    await db.query(`
      UPDATE channel_claim_state
      SET owner_id = NULL, claimed_at = NULL, expires_at = NULL,
          reminder_45_sent = FALSE, reminder_5_sent = FALSE, reminder_1_sent = FALSE,
          countdown_started = FALSE, countdown_value = NULL, updated_at = NOW()
      WHERE channel_id = $1 AND owner_id = $2
    `, [CLAIM_CHANNEL_ID, ownerId]);
    await channel.send(`🔓 **Ownership revoked.** <@${ownerId}> no longer manages this channel. The spot is now open to claim.`).catch(() => {});
    return interaction.reply({ content: `✅ Revoked <@${ownerId}>'s channel ownership.`, ephemeral: true });
  } catch (error) {
    console.error('Free channel revoke error:', error);
    return interaction.reply({ content: '❌ I could not safely revoke the current ownership.', ephemeral: true });
  }
}

async function editCountdown(interaction) {
  const state = await getState();
  if (!state?.owner_id) return interaction.reply({ content: '❌ There is no current channel owner.', ephemeral: true });
  if (state.owner_id !== interaction.user.id) return interaction.reply({ content: '❌ Only the current channel owner can edit the countdown.', ephemeral: true });

  const duration = parseDuration(interaction.options.getString('time', true));
  if (!duration) return interaction.reply({ content: '❌ Invalid time. Use values such as `30s`, `5m`, `1h`, or `1d` (maximum 7 days).', ephemeral: true });
  const newExpiry = new Date(Date.now() + duration);
  await db.query(`
    UPDATE channel_claim_state
    SET expires_at = $2, reminder_45_sent = FALSE, reminder_5_sent = FALSE, reminder_1_sent = FALSE,
        countdown_started = FALSE, countdown_value = NULL, updated_at = NOW()
    WHERE channel_id = $1 AND owner_id = $3
  `, [CLAIM_CHANNEL_ID, newExpiry, interaction.user.id]);
  return interaction.reply({ content: `⏱️ Countdown updated. You now have **${formatDuration(duration)}** remaining.`, ephemeral: false });
}

async function onMessage(message) {
  if (isClaimChannel(message)) await claim(message);
}

module.exports = { ensureSchema, onMessage, tick, revoke, editCountdown };
