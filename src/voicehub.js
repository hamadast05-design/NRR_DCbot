const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
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
const CONTROL_CHANNEL_ID = config.voiceHubControlChannelId;
const PREFIX = 'voicehub:';
const creating = new Set();

function panelPayload() {
  const container = new ContainerBuilder()
    .setAccentColor(0x2B2D31)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### 🎙️ VoiceHub")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Create your own temporary voice channel by joining <#"+TRIGGER_CHANNEL_ID+">.\n\n" +
        "Once inside your channel, open your personal controls to manage its privacy, members, and settings."
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(PREFIX + 'open')
          .setLabel('Open My Controls')
          .setEmoji('🎛️')
          .setStyle(ButtonStyle.Primary)
      )
    );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function channelPrivacy(channel) {
  const everyone = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  return {
    locked: Boolean(everyone?.deny.has(PermissionFlagsBits.Connect)),
    hidden: Boolean(everyone?.deny.has(PermissionFlagsBits.ViewChannel)),
  };
}

function privatePanelPayload(channel, ownerId) {
  const privacy = channelPrivacy(channel);
  const container = new ContainerBuilder()
    .setAccentColor(0x2B2D31)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "### 🎙️ VoiceHub Control Panel\n" +
        "**Channel:** <#"+channel.id+">\n" +
        "**Owner:** <@"+ownerId+">\n" +
        "**Members:** "+channel.members.size+"\n" +
        "**User Limit:** "+(channel.userLimit || "Unlimited")+"\n" +
        "**Join Access:** "+(privacy.locked ? "🔒 Locked" : "🔓 Open")+"\n" +
        "**Visibility:** "+(privacy.hidden ? "🙈 Hidden" : "👁️ Visible")
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Privacy & Access**"))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(PREFIX + 'toggle-lock')
          .setLabel(privacy.locked ? 'Unlock' : 'Lock')
          .setEmoji(privacy.locked ? '🔓' : '🔒')
          .setStyle(privacy.locked ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(PREFIX + 'toggle-hide')
          .setLabel(privacy.hidden ? 'Reveal' : 'Hide')
          .setEmoji(privacy.hidden ? '👁️' : '🙈')
          .setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Channel Customization**"))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(PREFIX + 'rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(PREFIX + 'limit').setLabel('Set Limit').setEmoji('👥').setStyle(ButtonStyle.Primary)
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Access & Ownership**"))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(PREFIX + 'transfer').setLabel('Transfer Ownership').setEmoji('👑').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(PREFIX + 'permit').setLabel('Manage Permits').setEmoji('✅').setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Moderation**"))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(PREFIX + 'claim').setLabel('Claim').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(PREFIX + 'disconnect').setLabel('Disconnect User').setEmoji('🔇').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(PREFIX + 'delete').setLabel('Delete Channel').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      )
    );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function sendPanel(client) {
  const channel = await client.channels.fetch(CONTROL_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error('[VoiceHub] Configured VoiceHub channel is unavailable or does not support sending messages.');
  }
  return channel.send(panelPayload());
}

async function ensurePanel(client) {
  try {
    await sendPanel(client);
    console.log('[VoiceHub] Control panel posted.');
  } catch (error) {
    console.error('[VoiceHub] Could not post control panel:', error);
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
    CREATE TABLE IF NOT EXISTS voicehub_permits (
      channel_id TEXT NOT NULL REFERENCES voicehub_channels(channel_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (channel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_voicehub_permits_user ON voicehub_permits(user_id);
    CREATE TABLE IF NOT EXISTS voicehub_hidden_access (
      channel_id TEXT NOT NULL REFERENCES voicehub_channels(channel_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      PRIMARY KEY (channel_id, user_id)
    );
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
  if (previous && previous.id !== TRIGGER_CHANNEL_ID && previous.id !== newState.channelId) {
    const managed = await db.query(
      'SELECT owner_id FROM voicehub_channels WHERE channel_id = $1',
      [previous.id]
    ).catch(() => ({ rows: [] }));
    if (managed.rows[0] && channelPrivacy(previous).hidden) {
      const userId = oldState.id;
      const permitted = await db.query(
        'SELECT 1 FROM voicehub_permits WHERE channel_id = $1 AND user_id = $2',
        [previous.id, userId]
      ).catch(() => ({ rows: [] }));
      await db.query(
        'DELETE FROM voicehub_hidden_access WHERE channel_id = $1 AND user_id = $2',
        [previous.id, userId]
      ).catch(() => {});
      if (managed.rows[0].owner_id !== userId && !permitted.rows.length) {
        await previous.permissionOverwrites.delete(userId, 'VoiceHub hidden channel member left').catch(() => {});
      }
    }
  }
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
  const voiceState = interaction.guild?.voiceStates
    ? await interaction.guild.voiceStates.fetch(interaction.user.id).catch(() => null)
    : null;
  const channel = voiceState?.channel || interaction.guild?.voiceStates?.cache?.get(interaction.user.id)?.channel || null;
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
  if (action === 'open') {
    const current = await getCurrentManagedChannel(interaction);
    if (current.error) return replyError(interaction, current.error);
    return interaction.reply({
      ...privatePanelPayload(current.channel, current.ownerId),
      ephemeral: true,
    });
  }

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
    return interaction.update(privatePanelPayload(current.channel, interaction.user.id));
  }

  if (action === 'transfer' || action === 'permit') {
    const current = await requireOwner(interaction);
    if (current.error) return replyError(interaction, current.error);
    const menu = new UserSelectMenuBuilder()
      .setCustomId(PREFIX + (action === 'transfer' ? 'transfer-select' : 'permit-select'))
      .setPlaceholder(action === 'transfer' ? 'Choose the new channel owner' : 'Choose a member to permit')
      .setMinValues(1)
      .setMaxValues(1);
    return interaction.reply({
      content: action === 'transfer'
        ? 'Select the member who should become the new owner of this channel.'
        : 'Select a member to add to or remove from this channel’s permit list. Permitted members can see and join it even when it is hidden or locked.',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
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

  if (action === 'toggle-lock') {
    const locked = channelPrivacy(channel).locked;
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      Connect: locked ? null : false,
    });
    return interaction.update(privatePanelPayload(channel, current.ownerId));
  }
  if (action === 'toggle-hide') {
    const hidden = channelPrivacy(channel).hidden;
    if (!hidden) {
      // Grant existing members and permitted users access before hiding the
      // channel from @everyone, so current occupants are not displaced.
      for (const member of channel.members.values()) {
        await db.query(
          'INSERT INTO voicehub_hidden_access (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [channel.id, member.id]
        );
        await channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          Connect: true,
        });
      }
      const permits = await db.query(
        'SELECT user_id FROM voicehub_permits WHERE channel_id = $1',
        [channel.id]
      );
      for (const permit of permits.rows) {
        await channel.permissionOverwrites.edit(permit.user_id, {
          ViewChannel: true,
          Connect: true,
        });
      }
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
        ViewChannel: false,
      });
    } else {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
        ViewChannel: true,
      });
      const hiddenMembers = await db.query(
        'SELECT user_id FROM voicehub_hidden_access WHERE channel_id = $1',
        [channel.id]
      );
      for (const hiddenMember of hiddenMembers.rows) {
        const userId = hiddenMember.user_id;
        const isOwner = userId === current.ownerId;
        const permitted = await db.query(
          'SELECT 1 FROM voicehub_permits WHERE channel_id = $1 AND user_id = $2',
          [channel.id, userId]
        );
        if (!isOwner && !permitted.rows.length) {
          await channel.permissionOverwrites.delete(userId, 'VoiceHub channel revealed').catch(() => {});
        }
      }
      await db.query('DELETE FROM voicehub_hidden_access WHERE channel_id = $1', [channel.id]);
    }
    return interaction.update(privatePanelPayload(channel, current.ownerId));
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
  const selectAction = interaction.customId.slice(PREFIX.length);
  if (!['disconnect-select', 'transfer-select', 'permit-select'].includes(selectAction)) return false;
  const current = await requireOwner(interaction);
  if (current.error) {
    await replyError(interaction, current.error);
    return true;
  }
  const targetId = interaction.values[0];

  if (selectAction === 'transfer-select') {
    if (targetId === interaction.user.id) {
      await replyError(interaction, 'You already own this channel.');
      return true;
    }
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!targetMember || targetMember.user.bot) {
      await replyError(interaction, 'Choose a valid server member who is not a bot.');
      return true;
    }
    await db.query(
      'UPDATE voicehub_channels SET owner_id = $1 WHERE channel_id = $2',
      [targetId, current.channel.id]
    );
    await current.channel.permissionOverwrites.edit(targetId, {
      ViewChannel: true,
      Connect: true,
    });
    await interaction.update({
      content: `👑 Ownership of <#${current.channel.id}> has been transferred to <@!${targetId}>.`,
      components: [],
      allowedMentions: { parse: [] },
    });
    return true;
  }

  if (selectAction === 'permit-select') {
    if (targetId === current.ownerId) {
      await replyError(interaction, 'The channel owner already has access.');
      return true;
    }
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!targetMember || targetMember.user.bot) {
      await replyError(interaction, 'Choose a valid server member who is not a bot.');
      return true;
    }
    const existingPermit = await db.query(
      'SELECT 1 FROM voicehub_permits WHERE channel_id = $1 AND user_id = $2',
      [current.channel.id, targetId]
    );
    if (existingPermit.rows.length) {
      await db.query(
        'DELETE FROM voicehub_permits WHERE channel_id = $1 AND user_id = $2',
        [current.channel.id, targetId]
      );
      const stillInside = current.channel.members.has(targetId);
      if (!stillInside && targetId !== current.ownerId) {
        await current.channel.permissionOverwrites.delete(targetId, 'VoiceHub permit removed').catch(() => {});
      }
      await interaction.update({
        content: `➖ <@!${targetId}> has been removed from your channel’s permit list.`,
        components: [],
        allowedMentions: { parse: [] },
      });
      return true;
    }
    await db.query(
      'INSERT INTO voicehub_permits (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [current.channel.id, targetId]
    );
    await current.channel.permissionOverwrites.edit(targetId, {
      ViewChannel: true,
      Connect: true,
    });
    await interaction.update({
      content: `✅ <@!${targetId}> has been added to your channel’s permit list and can join even when it is locked or hidden.`,
      components: [],
      allowedMentions: { parse: [] },
    });
    return true;
  }

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
    await interaction.reply({ content: '✏️ Your channel name has been updated. Reopen your VoiceHub controls to see the refreshed status.', ephemeral: true });
    return true;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
    await replyError(interaction, 'Enter a whole number from 0 to 99. Use 0 for unlimited.');
    return true;
  }
  await current.channel.setUserLimit(limit);
  await interaction.reply({ content: `👤 Your channel limit is now ${limit === 0 ? 'unlimited' : limit}. Reopen your VoiceHub controls to see the refreshed status.`, ephemeral: true });
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

module.exports = { initialize, onVoiceStateUpdate, handleInteraction, sendPanel };
