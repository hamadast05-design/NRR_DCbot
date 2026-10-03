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
  const me = channel.guild.members.me;
  const perms = botChannelPermissions(channel);
  const member = await channel.guild.members.fetch(userId);

  const diagnostics = {
    channelId: channel.id,
    channelType: channel.type,
    parentId: channel.parentId || 'none',
    viewable: channel.viewable,
    manageable: channel.manageable,
    botMember: me ? me.id : 'missing',
    botTopRole: me?.roles?.highest ? `${me.roles.highest.id}:${me.roles.highest.name}:position=${me.roles.highest.position}` : 'missing',
    targetTopRole: member?.roles?.highest ? `${member.roles.highest.id}:${member.roles.highest.name}:position=${member.roles.highest.position}` : 'missing',
    targetIsGuildOwner: member?.id === channel.guild.ownerId,
    botGuildManageRoles: me?.permissions?.has(PermissionFlagsBits.ManageRoles) || false,
    botGuildManageChannels: me?.permissions?.has(PermissionFlagsBits.ManageChannels) || false,
    effectivePermissions: perms ? perms.toArray().join(',') : 'missing',
    manageChannels: perms?.has(PermissionFlagsBits.ManageChannels) || false,
    manageRoles: perms?.has(PermissionFlagsBits.ManageRoles) || false,
    viewChannel: perms?.has(PermissionFlagsBits.ViewChannel) || false,
    sendMessages: perms?.has(PermissionFlagsBits.SendMessages) || false,
  };
  console.log('[CLAIM DEBUG] permission preflight', JSON.stringify(diagnostics));

  if (!me) throw new Error('Bot member is not available in this guild.');
  if (!perms) throw new Error("Could not resolve the bot's channel permissions.");

  const missing = [
    !perms.has(PermissionFlagsBits.ViewChannel) ? 'View Channel' : null,
    !perms.has(PermissionFlagsBits.SendMessages) ? 'Send Messages' : null,
    !perms.has(PermissionFlagsBits.ManageChannels) ? 'Manage Channels' : null,
    !perms.has(PermissionFlagsBits.ManageRoles) ? 'Manage Roles' : null,
  ].filter(Boolean);
  if (missing.length) throw new Error(`Bot is missing channel permissions: ${missing.join(', ')}.`);

  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Administrator members cannot claim this channel because Administrator bypasses channel restrictions.');
  }

  const existing = channel.permissionOverwrites.cache.get(userId);
  console.log('[CLAIM DEBUG] target overwrite before edit', JSON.stringify({
    userId,
    exists: Boolean(existing),
    type: existing?.type ?? null,
    allow: existing?.allow?.toArray?.() || [],
    deny: existing?.deny?.toArray?.() || [],
  }));

  // Build only the permissions the claimant actually needs. In particular, do
  // not send explicit false values for unrelated permissions; Discord treats
  // the overwrite as a concrete allow/deny bitfield.
  const ownerPermissions = {
    ViewChannel: true,
    ManageChannels: true,
    UseApplicationCommands: true,
    ManageMessages: true,
  };

  const allow = Object.entries(ownerPermissions)
    .filter(([, enabled]) => enabled)
    .reduce((bits, [name]) => bits | PermissionFlagsBits[name], 0n)
    .toString();
  const deny = '0';

  try {
    // Use the channel-permission endpoint explicitly with a MEMBER overwrite
    // type. This removes any ambiguity around overwrite resolution in the
    // manager while preserving the same Discord API endpoint.
    await channel.guild.client.rest.put(
      `/channels/${channel.id}/permissions/${userId}`,
      {
        body: {
          id: userId,
          type: 1,
          allow,
          deny,
        },
        reason: 'Temporary free-channel ownership',
      }
    );
  } catch (error) {
    console.error('[CLAIM DEBUG] permission overwrite failed', JSON.stringify({
      ...diagnostics,
      userId,
      overwritePayload: { id: userId, type: 1, allow, deny },
      errorCode: error?.code || null,
      httpStatus: error?.status || null,
      errorName: error?.name || null,
      errorMessage: error?.message || null,
    }));
    throw error;
  }

  console.log(`[CLAIM DEBUG] permission overwrite granted user=${userId} allow=${allow}`);
}
async function removeOwner(channel, userId) {
  if (!userId) return;
  // Keep the claimant able to see the channel after ownership ends, while
  // removing the temporary management permissions. Deleting the overwrite
  // would expose the channel's underlying No Access deny and lock them out.
  try {
    await channel.guild.client.rest.put(
      `/channels/${channel.id}/permissions/${userId}`,
      {
        body: {
          id: userId,
          type: 1,
          allow: PermissionFlagsBits.ViewChannel.toString(),
          deny: '0',
        },
        reason: 'Free-channel ownership ended',
      }
    );
  } catch (error) {
    console.error('[CLAIM DEBUG] failed to remove owner permissions', JSON.stringify({
      channelId: channel.id,
      userId,
      errorCode: error?.code || null,
      httpStatus: error?.status || null,
      errorMessage: error?.message || null,
    }));
  }
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
  console.log(`[CLAIM DEBUG] message received channel=${message.channelId} user=${message.author.id} ready=${ready} working=${working}`);
  if (!ready) {
    console.error(`[CLAIM DEBUG] ignored: schema is not ready (channel=${message.channelId})`);
    return;
  }
  if (!isClaimMessage(message)) {
    console.log(`[CLAIM DEBUG] ignored: not a claim message channel=${message.channelId} expected=${CHANNEL_ID} bot=${message.author.bot}`);
    return;
  }
  if (working) {
    console.log(`[CLAIM DEBUG] ignored: another claim operation is currently running`);
    return;
  }

  const channel = message.channel;
  if (!channel.isTextBased() || !channel.permissionOverwrites) {
    console.error(`[CLAIM DEBUG] ignored: channel is not a supported text channel or has no permission overwrites`);
    return;
  }
  const missing = missingBotPermissions(channel);
  if (missing.length) {
    console.error(`[CLAIM DEBUG] ignored: missing bot permissions: ${missing.join(', ')}`);
    return;
  }

  const member = await message.guild.members.fetch(message.author.id).catch((error) => {
    console.error(`[CLAIM DEBUG] ignored: could not fetch member ${message.author.id}:`, error);
    return null;
  });
  if (!member) return;

  console.log(`[CLAIM DEBUG] claimant fetched user=${member.id} roles=${member.roles.cache.map(r => `${r.id}:${r.name}`).join(',')} admin=${member.permissions.has(PermissionFlagsBits.Administrator)}`);

  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    console.log(`[CLAIM DEBUG] rejected: claimant is Administrator user=${member.id}`);
    await message.reply('❌ Administrators cannot claim this channel because Administrator bypasses channel restrictions.').catch(() => {});
    return;
  }

  const blocked = await cooldownUntil(member.id);
  if (blocked) {
    console.log(`[CLAIM DEBUG] rejected: claimant cooldown until=${blocked}`);
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
      console.log(`[CLAIM DEBUG] state owner=${state.owner_id || 'none'} expires=${state.expires_at || 'none'}`);
      if (state.owner_id && state.expires_at && new Date(state.expires_at).getTime() > Date.now()) {
        console.log(`[CLAIM DEBUG] ignored: channel already claimed by ${state.owner_id}`);
        await client.query('ROLLBACK');
        return;
      }
      previousOwner = state.owner_id || null;
      const blockedAgain = await client.query('SELECT blocked_until FROM channel_claim_cooldowns WHERE channel_id=$1 AND user_id=$2 AND blocked_until > NOW() FOR UPDATE', [CHANNEL_ID, member.id]);
      if (blockedAgain.rows[0]) {
        console.log(`[CLAIM DEBUG] rejected inside transaction: cooldown until=${blockedAgain.rows[0].blocked_until}`);
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

    console.log(`[CLAIM DEBUG] database claim saved user=${member.id} expires=${expires.toISOString()}`);
    try {
      await grantOwner(channel, member.id);
      console.log(`[CLAIM DEBUG] permission overwrite granted user=${member.id}`);
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
    }).catch((error) => console.error('[CLAIM DEBUG] claim succeeded but announcement failed:', error));
    console.log(`[CLAIM DEBUG] SUCCESS user=${member.id}`);
  } catch (error) {
    console.error('Free-channel claim error:', error);
    console.error(`[CLAIM DEBUG] FAILED user=${member.id} code=${error?.code || 'none'} message=${error?.message || 'unknown'}`);
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
    if (!state?.owner_id || !state?.expires_at) return;
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
  if (isClaimMessage(message)) {
    console.log(`[CLAIM DEBUG] onMessage matched channel=${message.channelId} user=${message.author.id}`);
    await claim(message);
  } else if (message.guild && message.channelId === CHANNEL_ID) {
    console.log(`[CLAIM DEBUG] onMessage ignored bot=${message.author.bot} channel=${message.channelId} expected=${CHANNEL_ID}`);
  }
}

module.exports = { ensureSchema, onMessage, tick, revoke, editCountdown };