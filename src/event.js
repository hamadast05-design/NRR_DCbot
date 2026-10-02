const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, LabelBuilder, FileUploadBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { config } = require('./config');

const SUBMIT = 'event_submit:';
const REVIEW = 'event_review:';

function channelPermissionIssues(channel, includeManageMessages = false) {
  const me = channel.guild.members.me;
  if (!me) return ['Bot member is not available in this guild.'];
  const perms = channel.permissionsFor(me);
  const required = [
    [PermissionFlagsBits.ViewChannel, 'View Channel'],
    [PermissionFlagsBits.SendMessages, 'Send Messages'],
    [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
  ];
  if (includeManageMessages) required.push([PermissionFlagsBits.ManageMessages, 'Manage Messages']);
  return required.filter(([flag]) => !perms?.has(flag)).map(([, name]) => name);
}

function isManager(i) {
  if (config.eventManagerRoleIds.length) return config.eventManagerRoleIds.some(id => i.member?.roles?.cache?.has(id));
  return i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

async function requireManager(i) {
  if (!isManager(i)) {
    await i.reply({ content: '❌ You do not have permission to manage event submissions.', ephemeral: true });
    return false;
  }
  return true;
}

function interfacePayload(eventId) {
  return {
    embeds: [new EmbedBuilder().setTitle('📤 Event Submissions').setDescription('Click the button below to submit your entry for the ongoing contest.').setColor(0x5865f2).setFooter({ text: 'Entries are reviewed before publication.' })],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(SUBMIT + eventId).setLabel('Submit Entry').setEmoji('📤').setStyle(ButtonStyle.Primary))],
  };
}

function reviewEmbed(s, status) {
  return new EmbedBuilder()
    .setTitle(status === 'pending' ? '📥 Submission Pending Review' : `📥 Submission — ${status}`)
    .setDescription(`**Submitter:** <@${s.submitter_id}>\n**Event:** #${s.event_id}\n**Submitted:** <t:${Math.floor(new Date(s.submitted_at).getTime() / 1000)}:F>\n**Status:** ${status}`)
    .setImage(s.image_url)
    .setColor(status === 'pending' ? 0x5865f2 : status === 'rejected' ? 0xe74c3c : 0x57f287);
}

function reviewRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(REVIEW + 'approve:' + id).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(REVIEW + 'reject:' + id).setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
}

async function createEvent(i) {
  if (!(await requireManager(i))) return;
  const id = i.options.getString('channel_id', true).trim();
  const ch = await i.guild.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) return i.reply({ content: '❌ That channel could not be found or is not a text channel.', ephemeral: true });
  const e = await db.createEvent({ guildId: i.guildId, destinationChannelId: ch.id, creatorId: i.user.id });
  await i.reply({ content: `✅ Event created successfully.\n\nSubmissions will be posted in <#${ch.id}>.\nEvent ID: **${e.id}**`, ephemeral: true });
}

async function send(i) {
  if (!(await requireManager(i))) return;
  const id = i.options.getString('channel_id', true).trim();
  const ch = await i.guild.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) return i.reply({ content: '❌ That channel could not be found or is not a text channel.', ephemeral: true });

  const issues = channelPermissionIssues(ch);
  if (issues.length) {
    return i.reply({
      content: `❌ I cannot send the submission interface there. Missing: **${issues.join(', ')}**.`,
      ephemeral: true,
    });
  }

  const e = await db.getActiveEvent(i.guildId);
  if (!e) return i.reply({ content: '❌ There is no active event. Use /createevent first.', ephemeral: true });

  try {
    const m = await ch.send(interfacePayload(e.id));
    await db.recordEventInterface(e.id, ch.id, m.id);
    await i.reply({ content: `✅ Submission message sent in <#${ch.id}>.`, ephemeral: true });
  } catch (error) {
    console.error('Event interface send error:', error);
    await i.reply({
      content: `❌ I could not send the submission interface there. Discord returned **${error?.code || 'an unknown error'}**. Check that I can view and send messages in that channel.`,
      ephemeral: true,
    });
  }
}

async function stick(i) {
  if (!(await requireManager(i))) return;
  const id = i.options.getString('channel_id', true).trim();
  const ch = await i.guild.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) return i.reply({ content: '❌ That channel could not be found or is not a text channel.', ephemeral: true });

  const issues = channelPermissionIssues(ch, true);
  if (issues.length) {
    return i.reply({
      content: `❌ I cannot stick the submission interface there. Missing: **${issues.join(', ')}**.`,
      ephemeral: true,
    });
  }

  const e = await db.getActiveEvent(i.guildId);
  if (!e) return i.reply({ content: '❌ There is no active event.', ephemeral: true });

  try {
    const old = await db.getEventInterface(e.id);
    if (old) {
      const oc = await i.guild.channels.fetch(old.channel_id).catch(() => null);
      const om = await oc?.messages.fetch(old.message_id).catch(() => null);
      if (om) await om.delete().catch(() => {});
    }

    const m = await ch.send(interfacePayload(e.id));
    await db.setStickChannel(e.id, ch.id);
    await db.recordEventInterface(e.id, ch.id, m.id);
    await i.reply({ content: `📌 Submission message is now stuck in <#${ch.id}>.`, ephemeral: true });
  } catch (error) {
    console.error('Event stick error:', error);
    await i.reply({
      content: `❌ I could not stick the submission interface there. Discord returned **${error?.code || 'an unknown error'}**.`,
      ephemeral: true,
    });
  }
}

async function showModal(i, eventId) {
  const e = await db.getEvent(eventId, i.guildId);
  if (!e || !e.active) return i.reply({ content: '❌ This event is no longer active.', ephemeral: true });
  const modal = new ModalBuilder().setCustomId(SUBMIT + 'modal:' + eventId).setTitle('Submit Contest Entry');
  const upload = new FileUploadBuilder()
    .setCustomId('submission_image')
    .setMinValues(1)
    .setMaxValues(1)
    .setRequired(true);
  modal.addLabelComponents(new LabelBuilder().setLabel('Upload your contest image').setDescription('Submit one image. It will be reviewed before publication.').setFileUploadComponent(upload));
  try {
    await i.showModal(modal);
  } catch (error) {
    console.error('Event modal show error:', error);
    if (!i.replied && !i.deferred) {
      await i.reply({ content: '❌ I could not open the submission form. Please try again.', ephemeral: true }).catch(() => {});
    }
  }
}

async function submit(i, eventId) {
  if (i.replied || i.deferred) return;
  try {
    await i.deferReply({ ephemeral: true });
    const e = await db.getEvent(eventId, i.guildId);
    if (!e || !e.active) return i.editReply('❌ This event is no longer active.');

    const files = i.fields.getUploadedFiles('submission_image', true);
    const attachment = files?.first();
    if (!attachment) return i.editReply('❌ I could not read the uploaded image. Please try again.');
    if (!attachment.contentType?.startsWith('image/')) return i.editReply('❌ Please upload a valid image file.');

    const s = await db.createSubmission({
      eventId: e.id,
      guildId: i.guildId,
      submitterId: i.user.id,
      imageUrl: attachment.url,
      imageName: attachment.name,
      submittedAt: new Date(),
    });

    // Never fall back to the public submissions channel for review messages.
    // Without a configured review channel, the submission remains pending and the 3-hour auto-approval still applies.
    const reviewId = config.eventReviewChannelId;
    if (reviewId) {
      const rc = await i.guild.channels.fetch(reviewId).catch(() => null);
      if (rc?.isTextBased()) {
        const managerMentions = config.eventManagerRoleIds.map(x => `<@&${x}>`).join(' ');
        const msg = await rc.send({
          content: managerMentions || undefined,
          allowedMentions: { roles: config.eventManagerRoleIds },
          embeds: [reviewEmbed(s, 'pending')],
          components: [reviewRow(s.id)],
        }).catch(error => {
          console.error('Event review message error:', error);
          return null;
        });
        if (msg) {
          await db.setReviewMessage(s.id, rc.id, msg.id);
          await db.query(`
            INSERT INTO event_bot_messages (event_id, channel_id, message_id, message_type)
            VALUES ($1,$2,$3,'review')
            ON CONFLICT (event_id,message_id) DO NOTHING
          `, [e.id, rc.id, msg.id]);
        }
      }
    }

    const reviewNote = reviewId ? '' : '\n\n⚠️ Staff review channel is not configured, so the submission will use the automatic 3-hour approval unless staff configures review first.';
    await i.editReply(`✅ Your submission has been received and is now pending review. If no manager acts within 3 hours, it will be automatically approved.${reviewNote}`);
  } catch (error) {
    console.error('Event submission error:', error);
    if (i.deferred || i.replied) await i.editReply('❌ Something went wrong while saving your submission. Please try again.').catch(() => {});
    else await i.reply({ content: '❌ Something went wrong while saving your submission. Please try again.', ephemeral: true }).catch(() => {});
  }
}

async function publish(client, s) {
  const e = await db.getEvent(s.event_id, s.guild_id);
  if (!e || !e.active) return false;
  const ch = await client.channels.fetch(e.destination_channel_id).catch(() => null);
  if (!ch?.isTextBased()) return false;
  try {
    const m = await ch.send({
      embeds: [new EmbedBuilder().setTitle('📸 Event Submission').setDescription(`**Submitted by:** <@${s.submitter_id}>`).setImage(s.image_url).setColor(0x5865f2).setTimestamp(new Date(s.submitted_at))],
    });
    await m.react('🌟').catch(() => {});
    await db.setPublishedMessage(s.id, m.id, ch.id);
    await db.query(`
      INSERT INTO event_bot_messages (event_id, channel_id, message_id, message_type)
      VALUES ($1,$2,$3,'published')
      ON CONFLICT (event_id,message_id) DO NOTHING
    `, [s.event_id, ch.id, m.id]);
    return true;
  } catch (error) {
    console.error('Event publish error:', error);
    return false;
  }
}

async function review(i, action, id) {
  if (!(await requireManager(i))) return;
  const s = await db.getSubmission(id);
  if (!s || s.guild_id !== i.guildId) return i.reply({ content: '❌ Submission not found.', ephemeral: true });
  if (s.status !== 'pending') return i.reply({ content: `ℹ️ This submission has already been ${s.status}.`, ephemeral: true });

  if (action === 'reject') {
    const ok = await db.rejectSubmission(id, i.user.id);
    if (!ok) return i.reply({ content: 'ℹ️ This submission was already processed.', ephemeral: true });
    await i.update({ embeds: [reviewEmbed(s, 'rejected')], components: [] });
    const u = await i.client.users.fetch(s.submitter_id).catch(() => null);
    await u?.send('❌ Your event submission was not approved by the event managers.').catch(() => {});
    return;
  }

  const ok = await db.claimSubmission(id, 'approved', i.user.id);
  if (!ok) return i.reply({ content: 'ℹ️ This submission was already processed.', ephemeral: true });
  await i.update({ embeds: [reviewEmbed(s, 'approved')], components: [] });
  const fresh = await db.getSubmission(id);
  const done = await publish(i.client, fresh);
  if (!done) await i.followUp({ content: '❌ The submission was approved but could not be published. It will not be published twice automatically.', ephemeral: true }).catch(() => {});
}

async function autoApprove(client) {
  const rows = await db.getDueSubmissions();
  for (const s of rows) {
    const ok = await db.claimSubmission(s.id, 'auto-approved', null);
    if (ok) await publish(client, s);
  }
}

async function end(i) {
  if (!(await requireManager(i))) return;
  const e = await db.getActiveEvent(i.guildId);
  if (!e) return i.reply({ content: '❌ There is no active event.', ephemeral: true });
  const rows = await db.getEventBotMessages(e.id);
  let n = 0;
  for (const r of rows) {
    const c = await i.guild.channels.fetch(r.channel_id).catch(() => null);
    const m = await c?.messages.fetch(r.message_id).catch(() => null);
    if (m?.author?.id === i.client.user.id) {
      await m.delete().then(() => n++).catch(() => {});
    }
  }
  await db.endEvent(e.id);
  await i.reply({ content: `✅ Event ended. Removed **${n}** bot messages associated with the event.`, ephemeral: true });
}

async function onMessage(message) {
  if (!config.eventStickEnabled || message.author.bot || !message.guild) return;
  const e = await db.getActiveEvent(message.guild.id);
  if (!e || e.stick_channel_id !== message.channel.id) return;
  const issues = channelPermissionIssues(message.channel, true);
  if (issues.length) {
    console.error(`Event stick unavailable in #${message.channel.id}: missing ${issues.join(', ')}`);
    return;
  }
  const old = await db.getEventInterface(e.id);
  if (!old || old.message_id === message.id) return;
  const om = await message.channel.messages.fetch(old.message_id).catch(() => null);
  if (om) await om.delete().catch(() => {});
  try {
    const m = await message.channel.send(interfacePayload(e.id));
    await db.recordEventInterface(e.id, message.channel.id, m.id);
  } catch (error) {
    console.error('Event stick repost error:', error);
  }
}

module.exports = { createEvent, send, stick, showModal, submit, review, autoApprove, end, onMessage };
