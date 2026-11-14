const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { config } = require('./config');
const db = require('./db');

const TRIGGER_CHANNEL_ID = config.voiceHubTriggerChannelId;
const CONTROL_CHANNEL_ID = TRIGGER_CHANNEL_ID;
const PREFIX = 'voicehub:';
const creating = new Set();

function panelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('VoiceHub Panel')
    .setDescription([
      '> 🔊 \`Lock\` - Deny members from joining',
      '> 🔉 \`Unlock\` - Allow members to join',
      '> #️⃣ \`Hide\` - Hide from channel list',
      '> #️⃣ \`Reveal\` - Show in channel list',
      '> 📞 \`Disconnect\` - Remove members',
      '> 👑 \`Claim\` - Take ownership',
      '> ✏️ \`Rename\` - Change channel name',
      '> 👤 \`Update Limit\` - Set user limit',
      '> 📋 \`Information\` - View details',
      '> 🗑️ \`Delete\` - Remove channel',
    ].join('\\n'));
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PREFIX + 'lock').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'unlock').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'hide').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'reveal').setEmoji('＃').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'disconnect').setEmoji('📞').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PREFIX + 'claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'limit').setEmoji('👤').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'info').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PREFIX + 'delete').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embeds: [embed], components: rows };
}

async function ensurePanel(client) {
  const channel = await client.channels.fetch(CONTROL_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function' || !channel.messages) {
    console.error('[VoiceHub] VoiceHub trigger channel is unavailable or does not support channel messages.');
    return;
  }
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const exists = recent?.some(message =>
    message.author.id === client.user.id &&
    message.components.some(row => row.components.some(component => component.customId?.startsWith(PREFIX)))
  );
  if (!exists) {
    await channel.send(panelPayload());
    console.log('[VoiceHub] Control panel posted.');
  } else {
    console.log('[VoiceHub] Existing control panel found.');
  }
}

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS voicehub_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_voicehub_owner ON voicehub_channels(guild_id, owner_id);
  `);
}

async function cleanupStaleChannels(client) {
  const result = await db.query('SELECT guild_id, channel_id FROM voicehub_channels');
  for (const row of result.rows) {
    const guild = client.guilds.cache.get(row.guild_id);
    const channel = guild ? await guild.channels.fetch(row.channel_id).catch(() => null) : null;
    if (!channel || channel.type !== ChannelType.GuildVoice || channel.members.size === 0) {
      if (channel) await channel.delete('VoiceHub startup cleanup: empty temporary channel').catch(() => {});
      await db.query('DELETE FROM voicehub_channels WHERE channel_id = $1', [row.channel_id]);
    }
  }
}

async function createTemporaryChannel(member) {
  if (creating.has(member.id)) return;
  creating.add(member.id);
  let createdChannel = null;
  try {
    const existing = await db.query(
      'SELECT channel_id FROM voicehub_channels WHERE guild_id = $1 AND owner_id = $2 LIMIT 1',
      [member.guild.id, member.id]
    );
    if (existing.rows[0]) {
      const previous = await member.guild.channels.fetch(existing.rows[0].channel_id).catch(() => null);
      if (previous?.type === ChannelType.GuildVoice) {
        if (previous.members.size === 0) {
          await previous.delete('VoiceHub replaced an empty channel').catch(() => {});
          await db.query('DELETE FROM voicehub_channels WHERE channel_id = $1', [previous.id]);
        } else {
          await member.voice.setChannel(previous, 'Returning to existing VoiceHub channel').catch(() => {});
          return;
        }
      } else {
        await db.query('DELETE FROM voicehub_channels WHERE channel_id = $1', [existing.rows[0].channel_id]);
      }
    }

    const trigger = await member.guild.channels.fetch(TRIGGER_CHANNEL_ID).catch(() => null);
    if (!trigger || trigger.type !== ChannelType.GuildVoice) {
      console.error('[VoiceHub] Configured trigger channel is missing or is not a voice channel.');
      return;
    }

    const parent = trigger.parentId || undefined;
    const channel = await member.guild.channels.create({
      name: `${member.displayName}'s channel`.slice(0, 100),
      type: ChannelType.GuildVoice,
      parent,
      userLimit: 0,
      permissionOverwrites: [
        {
          id: member.guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
          id: member.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
      ],
      reason: `VoiceHub temporary channel for ${member.user.tag}`,
    });
    createdChannel = channel;

    await db.query(
      'INSERT INTO voicehub_channels (guild_id, channel_id, owner_id) VALUES ($1, $2, $3)',
      [member.guild.id, channel.id, member.id]
    );

    await member.voice.setChannel(channel, 'VoiceHub created a personal temporary channel');
  } catch (error) {
    console.error('[VoiceHub] Channel creation failed:', error);
    if (createdChannel) {
      await db.query('DELETE FROM voicehub_channels WHERE channel_id = $1', [createdChannel.id]).catch(() => {});
      await createdChannel.delete('VoiceHub rollback after failed channel setup').catch(() => {});
    }
  } finally {
    creating.delete(member.id);
  }
}

async function onVoiceStateUpdate(oldState, newState) {
  if (newState.channelId === TRIGGER_CHANNEL_ID && oldState.channelId !== TRIGGER_CHANNEL_ID) {
    await createTemporaryChannel(newState.member);
  }

  const previous = oldState.channel;
  if (previous && previous.id !== TRIGGER_CHANNEL_ID && previous.members.size === 0) {
    const result = await db.query(
      'DELETE FROM voicehub_channels WHERE channel_id = $1 RETURNING channel_id',
      [previous.id]
    ).catch(error => {
      console.error('[VoiceHub] Empty-channel database cleanup failed:', error);
      return { rows: [] };
    });
    if (result.rows.length) {
      await previous.delete('VoiceHub temporary channel became empty').catch(error => {
        console.error('[VoiceHub] Empty-channel deletion failed:', error);
      });
    }
  }
}

async function getCurrentManagedChannel(interaction) {
  const channel = interaction.guild?.voiceStates?.cache?.get(interaction.user.id)?.channel || null;
  if (!channel || channel.type !== ChannelType.GuildVoice) return { error: 'Join your VoiceHub channel first.' };
  const result = await db.query(
    'SELECT owner_id FROM voicehub_channels WHERE guild_id = $1 AND channel_id = $2',
    [interaction.guildId, channel.id]
  );
  if (!result.rows[0]) return { error: 'This is not a VoiceHub temporary channel.' };
  return { channel, ownerId: result.rows[0].owner_id };
}

async function requireOwner(interaction) {
  const current = await getCurrentManagedChannel(interaction);
  if (current.error) return current;
  if (current.ownerId !== interaction.user.id) return { error: 'Only this channel’s owner can use that control.' };
  return current;
}

async function replyError(interaction, message) {
  const payload = { content: `❌ ${message}`, ephemeral: true };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

function makeModal(kind, title, label, value, placeholder) {
  const modal = new ModalBuilder().setCustomId(PREFIX + 'modal:' + kind).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(kind === 'rename' ? 100 : 2)
    .setPlaceholder(placeholder);
  if (value !== undefined && value !== null && String(value).length) input.setValue(String(value).slice(0, 100));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function onButton(interaction) {
  const action = interaction.customId.slice(PREFIX.length);
  if (action === 'claim') {
    const current = await getCurrentManagedChannel(interaction);
    if (current.error) return replyError(interaction, current.error);
    if (current.ownerId === interaction.user.id) return interaction.reply({ content: '👑 You already own this channel.', ephemeral: true });
    if (current.channel.members.some(member => member.id === current.ownerId)) {
      return replyError(interaction, 'The current owner is still in the channel.');
    }
    await db.query('UPDATE voicehub_channels SET owner_id = $1 WHERE channel_id = $2', [interaction.user.id, current.channel.id]);
    await current.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true, Connect: true,
    }).catch(() => {});
    return interaction.reply({ content: '👑 You are now the owner of this VoiceHub channel.', ephemeral: true });
  }

  if (action === 'rename' || action === 'limit') {
    const current = await requireOwner(interaction);
    if (current.error) return replyError(interaction, current.error);
    if (action === 'rename') {
      return interaction.showModal(makeModal('rename', 'Rename your channel', 'New channel name', current.channel.name, 'My voice channel'));
    }
    return interaction.showModal(makeModal('limit', 'Update user limit', 'Maximum members (0 = unlimited)', current.channel.userLimit, '0–99'));
  }

  if (action === 'disconnect') {
    const current = await requireOwner(interaction);
    if (current.error) return replyError(interaction, current.error);
    const members = current.channel.members.filter(member => member.id !== interaction.user.id);
    if (!members.size) return interaction.reply({ content: 'There are no other members to disconnect.', ephemeral: true });
    const menu = new UserSelectMenuBuilder()
      .setCustomId(PREFIX + 'disconnect-select')
      .setPlaceholder('Select a member to disconnect')
      .setMinValues(1)
      .setMaxValues(1);
    return interaction.reply({
      content: 'Choose the member you want to disconnect from your channel.',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  }

  const current = await requireOwner(interaction);
  if (current.error) return replyError(interaction, current.error);
  const { channel } = current;

  if (action === 'lock' || action === 'unlock') {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      Connect: action === 'lock' ? false : true,
    });
    return interaction.reply({ content: action === 'lock' ? '🔒 Your channel is now locked.' : '🔓 Your channel is now unlocked.', ephemeral: true });
  }
  if (action === 'hide' || action === 'reveal') {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      ViewChannel: action === 'hide' ? false : true,
    });
    return interaction.reply({ content: action === 'hide' ? '🙈 Your channel is now hidden.' : '👁️ Your channel is now visible.', ephemeral: true });
  }
  if (action === 'info') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('VoiceHub Channel Information')
      .addFields(
        { name: 'Owner', value: `<@${current.ownerId}>`, inline: true },
        { name: 'Members', value: String(channel.members.size), inline: true },
        { name: 'User Limit', value: channel.userLimit ? String(channel.userLimit) : 'Unlimited', inline: true },
        { name: 'Channel', value: `<#${channel.id}>`, inline: false },
      );
    return interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
  }
  if (action === 'delete') {
    await db.query('DELETE FROM voicehub_channels WHERE channel_id = $1', [channel.id]);
    await interaction.reply({ content: '🗑️ Your VoiceHub channel has been deleted.', ephemeral: true });
    await channel.delete('Deleted by its VoiceHub owner');
  }
}

async function onUserSelect(interaction) {
  if (interaction.customId !== PREFIX + 'disconnect-select') return false;
  const current = await requireOwner(interaction);
  if (current.error) {
    await replyError(interaction, current.error);
    return true;
  }
  const targetId = interaction.values[0];
  const target = current.channel.members.get(targetId);
  if (!target || target.id === interaction.user.id) {
    await replyError(interaction, 'That member is no longer in your channel.');
    return true;
  }
  const trigger = await interaction.guild.channels.fetch(TRIGGER_CHANNEL_ID).catch(() => null);
  if (!trigger) {
    await replyError(interaction, 'The VoiceHub join channel is unavailable.');
    return true;
  }
  await target.voice.setChannel(trigger, 'Disconnected by the VoiceHub channel owner');
  await interaction.reply({ content: `📞 <@${target.id}> has been disconnected from your channel.`, ephemeral: true, allowedMentions: { parse: [] } });
  return true;
}

async function onModal(interaction) {
  const kind = interaction.customId.slice((PREFIX + 'modal:').length);
  if (kind !== 'rename' && kind !== 'limit') return false;
  const current = await requireOwner(interaction);
  if (current.error) {
    await replyError(interaction, current.error);
    return true;
  }
  const value = interaction.fields.getTextInputValue('value').trim();
  if (kind === 'rename') {
    if (!value) {
      await replyError(interaction, 'Channel name cannot be empty.');
      return true;
    }
    await current.channel.setName(value.slice(0, 100), 'Renamed by its VoiceHub owner');
    await interaction.reply({ content: '✏️ Your channel name has been updated.', ephemeral: true });
    return true;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
    await replyError(interaction, 'Enter a whole number from 0 to 99. Use 0 for unlimited.');
    return true;
  }
  await current.channel.setUserLimit(limit);
  await interaction.reply({ content: `👤 Your channel limit is now ${limit === 0 ? 'unlimited' : limit}.`, ephemeral: true });
  return true;
}

async function handleInteraction(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
    await onButton(interaction);
    return true;
  }
  if (interaction.isUserSelectMenu() && interaction.customId.startsWith(PREFIX)) {
    return onUserSelect(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(PREFIX)) {
    return onModal(interaction);
  }
  return false;
}

async function initialize(client) {
  if (!TRIGGER_CHANNEL_ID) {
    console.warn('[VoiceHub] Missing trigger channel configuration; feature disabled.');
    return;
  }
  await migrate();
  await cleanupStaleChannels(client);
  await ensurePanel(client);
  console.log('[VoiceHub] Ready.');
}

module.exports = { initialize, onVoiceStateUpdate, handleInteraction };
