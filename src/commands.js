const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('./db');
const { config } = require('./config');
const eventSystem = require('./event');

const COLORS = {
  fame: 0xf1c40f,
  humiliation: 0xe74c3c,
  reputation: 0x5865f2,
};

const commands = [
  new SlashCommandBuilder().setName('createevent').setDescription('Create an event submission configuration.').addStringOption(o=>o.setName('channel_id').setDescription('Destination channel ID.').setRequired(true)),
  new SlashCommandBuilder().setName('send').setDescription('Send the event submission interface.').addStringOption(o=>o.setName('channel_id').setDescription('Channel for the submission interface.').setRequired(true)),
  new SlashCommandBuilder().setName('stick').setDescription('Keep the submission interface at the top of a channel.').addStringOption(o=>o.setName('channel_id').setDescription('Channel to stick the interface in.').setRequired(true)),
  new SlashCommandBuilder().setName('end').setDescription('End the active event and remove its bot messages.'),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
    .addUserOption(o => o.setName('user').setDescription('Member to mute.').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('Duration, e.g. 10m, 2h, 1d, 1w.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the mute.').setRequired(false)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString())
    .addUserOption(o => o.setName('user').setDescription('Member to kick.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick.').setRequired(false)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString())
    .addUserOption(o => o.setName('user').setDescription('Member to ban.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban.').setRequired(false)),

  new SlashCommandBuilder()
    .setName('fame')
    .setDescription('Give another member +1 Fame.')
    .addUserOption(o => o.setName('member').setDescription('The member receiving Fame.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('humiliate')
    .setDescription('Give another member +1 Humiliation.')
    .addUserOption(o => o.setName('member').setDescription('The member receiving Humiliation.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('reputation')
    .setDescription('View Fame, Humiliation and Reputation Score.')
    .addUserOption(o => o.setName('member').setDescription('The member to inspect.').setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View NRR reputation leaderboards.')
    .addSubcommand(s => s.setName('fame').setDescription('View the Fame leaderboard.'))
    .addSubcommand(s => s.setName('humiliation').setDescription('View the Humiliation leaderboard.'))
    .addSubcommand(s => s.setName('reputation').setDescription('View the overall Reputation leaderboard.')),

  new SlashCommandBuilder()
    .setName('reputation-admin')
    .setDescription('Manage Fame & Reputation. Staff only.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand(s => s.setName('reset').setDescription('Reset a member\'s Fame and Humiliation.')
      .addUserOption(o => o.setName('member').setDescription('Member to reset.').setRequired(true)))
    .addSubcommand(s => s.setName('add-fame').setDescription('Add Fame to a member.')
      .addUserOption(o => o.setName('member').setDescription('Member.').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Positive amount to add.').setMinValue(1).setMaxValue(100000).setRequired(true)))
    .addSubcommand(s => s.setName('remove-fame').setDescription('Remove Fame from a member.')
      .addUserOption(o => o.setName('member').setDescription('Member.').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Positive amount to remove.').setMinValue(1).setMaxValue(100000).setRequired(true)))
    .addSubcommand(s => s.setName('add-humiliation').setDescription('Add Humiliation to a member.')
      .addUserOption(o => o.setName('member').setDescription('Member.').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Positive amount to add.').setMinValue(1).setMaxValue(100000).setRequired(true)))
    .addSubcommand(s => s.setName('remove-humiliation').setDescription('Remove Humiliation from a member.')
      .addUserOption(o => o.setName('member').setDescription('Member.').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Positive amount to remove.').setMinValue(1).setMaxValue(100000).setRequired(true))),
];

function mention(id) {
  return `<@${id}>`;
}

function formatRemaining(ms) {
  const minutes = Math.ceil(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${Math.max(1, mins)}m`;
}

async function sendLog(interaction, title, description, color) {
  if (!config.publicEvents || !config.logChannelId) return;
  const channel = await interaction.client.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp()] }).catch(() => {});
}

async function handleVote(interaction, type) {
  const target = interaction.options.getUser('member', true);
  const actor = interaction.user;

  if (target.id === actor.id) {
    return interaction.reply({ content: '❌ You cannot give Fame or Humiliation to yourself.', ephemeral: true });
  }
  if (target.bot && !config.allowBotTargets) {
    return interaction.reply({ content: '❌ Bots cannot receive Fame or Humiliation.', ephemeral: true });
  }

  const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!targetMember) {
    return interaction.reply({ content: '❌ That member is not currently in this server.', ephemeral: true });
  }

  try {
    const result = await db.castVote({
      guildId: interaction.guildId,
      voterId: actor.id,
      targetId: target.id,
      type,
      cooldownMs: config.cooldownMs,
    });

    if (!result.ok) {
      return interaction.reply({
        content: `⏳ You already gave ${type === 'fame' ? 'Fame' : 'Humiliation'} to ${mention(target.id)} recently. You can vote for them again in about ${formatRemaining(result.remainingMs)}.`,
        ephemeral: true,
      });
    }

    const stats = result.stats;
    const noun = type === 'fame' ? 'Fame' : 'Humiliation';
    const emoji = type === 'fame' ? '⭐' : '👎';
    await interaction.reply({
      content: `${emoji} **${noun} Given**\nYou gave +1 ${noun} to ${mention(target.id)}.\n\n${mention(target.id)} now has **${type === 'fame' ? stats.fame : stats.humiliation} ${noun}**.`,
      ephemeral: true,
    });

    await sendLog(interaction, `${emoji} ${noun} Awarded`, `${mention(actor.id)} gave ${noun} to ${mention(target.id)}.\n${mention(target.id)} now has **${type === 'fame' ? stats.fame : stats.humiliation} ${noun}**.`, COLORS[type]);
  } catch (error) {
    console.error('Vote error:', error);
    await interaction.reply({ content: '❌ Something went wrong while recording that vote. Please try again later.', ephemeral: true }).catch(() => {});
  }
}

async function handleReputation(interaction) {
  const user = interaction.options.getUser('member') || interaction.user;
  try {
    await db.ensureMember(interaction.guildId, user.id, true);
    const stats = await db.getRanks(interaction.guildId, user.id, config.showDeparted);
    const embed = new EmbedBuilder()
      .setTitle(`⭐ Reputation — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .setColor(COLORS.reputation)
      .addFields(
        { name: '⭐ Fame', value: `**${stats.fame}**`, inline: true },
        { name: '👎 Humiliation', value: `**${stats.humiliation}**`, inline: true },
        { name: '📊 Reputation Score', value: `**${stats.score >= 0 ? '+' : ''}${stats.score}**`, inline: true },
        { name: '🏆 Fame Rank', value: `#${stats.fameRank}`, inline: true },
        { name: '📉 Humiliation Rank', value: `#${stats.humiliationRank}`, inline: true },
        { name: '🏆 Reputation Rank', value: `#${stats.reputationRank}`, inline: true },
        { name: '📊 Total Votes Received', value: `${stats.totalReceived}`, inline: true },
        { name: '📤 Total Votes Given', value: `${stats.totalGiven}`, inline: true },
      );
    await interaction.reply({ embeds: [embed], ephemeral: false });
  } catch (error) {
    console.error('Reputation error:', error);
    await interaction.reply({ content: '❌ I could not load that reputation profile right now.', ephemeral: true });
  }
}

function leaderboardEmbed(type, rows, page, total, pageSize) {
  const title = type === 'fame' ? '⭐ NRR Fame Leaderboard' : type === 'humiliation' ? '👎 NRR Humiliation Leaderboard' : '🏆 NRR Reputation Leaderboard';
  const label = type === 'fame' ? 'Fame' : type === 'humiliation' ? 'Humiliation' : 'Reputation';
  const lines = rows.length
    ? rows.map((row, i) => {
        const position = (page - 1) * pageSize + i + 1;
        const value = type === 'fame' ? row.fame : type === 'humiliation' ? row.humiliation : row.score;
        const formatted = type === 'reputation' && value >= 0 ? `+${value}` : value;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
        return `${medal} ${mention(row.user_id)} — **${formatted} ${label}**`;
      }).join('\n')
    : 'No reputation data yet.';

  return new EmbedBuilder().setTitle(title).setDescription(lines).setColor(COLORS[type]).setFooter({ text: `Page ${page}/${Math.max(1, Math.ceil(total / pageSize))}` });
}

function paginationRow(type, page, totalPages, ownerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rep:${type}:${page - 1}:${ownerId}`).setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`rep:${type}:${page + 1}:${ownerId}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
  );
}

async function showLeaderboard(interaction, type, page = 1) {
  const pageSize = 10;
  const data = await db.getLeaderboard(interaction.guildId, type, page, pageSize, config.showDeparted);
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const finalData = safePage === page ? data : await db.getLeaderboard(interaction.guildId, type, safePage, pageSize, config.showDeparted);
  const embed = leaderboardEmbed(type, finalData.rows, safePage, finalData.total, pageSize);
  const components = totalPages > 1 ? [paginationRow(type, safePage, totalPages, interaction.user.id)] : [];
  await interaction.reply({ embeds: [embed], components });
}

async function handleAdmin(interaction) {
  if (!interaction.memberPermissions?.has(config.adminPermission)) {
    return interaction.reply({ content: '❌ You do not have permission to use reputation administration commands.', ephemeral: true });
  }
  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser('member', true);
  if (target.bot && !config.allowBotTargets) {
    return interaction.reply({ content: '❌ Bots cannot be modified by the reputation system.', ephemeral: true });
  }
  try {
    if (sub === 'reset') {
      const stats = await db.resetMember(interaction.guildId, interaction.user.id, target.id);
      return interaction.reply({ content: `✅ Reset ${mention(target.id)}. Fame: **${stats.fame}**, Humiliation: **${stats.humiliation}**.`, ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount', true);
    const type = sub.includes('fame') ? 'fame' : 'humiliation';
    const signed = sub.startsWith('remove-') ? -amount : amount;
    const stats = await db.adminAdjust(interaction.guildId, interaction.user.id, target.id, type, signed);
    return interaction.reply({ content: `✅ Updated ${mention(target.id)}: ${type === 'fame' ? '⭐ Fame' : '👎 Humiliation'} is now **${stats[type]}**.`, ephemeral: true });
  } catch (error) {
    console.error('Admin reputation error:', error);
    return interaction.reply({ content: '❌ I could not apply that administrative change.', ephemeral: true });
  }
}

function parseMuteDuration(input) {
  const match = String(input).trim().toLowerCase().match(/^(\\d+)\\s*(m|h|d|w)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000 };
  const duration = amount * multipliers[unit];
  if (!Number.isSafeInteger(duration) || duration < 1000 || duration > 28 * 24 * 60 * 60 * 1000) return null;
  return duration;
}

async function getModerationTarget(interaction, optionName) {
  const user = interaction.options.getUser(optionName, true);
  if (user.id === interaction.user.id) return { error: '❌ You cannot moderate yourself.' };
  if (user.id === interaction.client.user.id) return { error: '❌ I cannot moderate myself.' };
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return { error: '❌ That user is not currently in this server.' };
  if (member.id === interaction.guild.ownerId) return { error: '❌ The server owner cannot be moderated by the bot.' };
  return { user, member };
}

async function handleMute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '❌ You do not have permission to mute members.', ephemeral: true });
  const target = await getModerationTarget(interaction, 'user');
  if (target.error) return interaction.reply({ content: target.error, ephemeral: true });
  const durationInput = interaction.options.getString('time', true);
  const duration = parseMuteDuration(durationInput);
  if (!duration) return interaction.reply({ content: '❌ Invalid mute time. Use 10m, 2h, 1d, or 1w (maximum 28 days).', ephemeral: true });
  if (!target.member.moderatable) return interaction.reply({ content: '❌ I cannot mute that member. Check my role position and Moderate Members permission.', ephemeral: true });
  const reason = interaction.options.getString('reason') || 'No reason provided';
  try {
    await target.member.timeout(duration, reason);
    return interaction.reply({ content: 'lmaooo <@' + target.user.id + '> has been muted for ' + durationInput.trim() + ', couldn\'t be me 😂' });
  } catch (error) {
    console.error('Mute error:', error);
    return interaction.reply({ content: '❌ I could not mute that member. Check my permissions and role hierarchy.', ephemeral: true });
  }
}

async function handleKick(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '❌ You do not have permission to kick members.', ephemeral: true });
  const target = await getModerationTarget(interaction, 'user');
  if (target.error) return interaction.reply({ content: target.error, ephemeral: true });
  if (!target.member.kickable) return interaction.reply({ content: '❌ I cannot kick that member. Check my role position and Kick Members permission.', ephemeral: true });
  const reason = interaction.options.getString('reason') || 'No reason provided';
  try {
    await target.member.kick(reason);
    return interaction.reply({ content: '<@' + target.user.id + '> has been successfully kicked 😨.' });
  } catch (error) {
    console.error('Kick error:', error);
    return interaction.reply({ content: '❌ I could not kick that member. Check my permissions and role hierarchy.', ephemeral: true });
  }
}

async function handleBan(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '❌ You do not have permission to ban members.', ephemeral: true });
  const target = await getModerationTarget(interaction, 'user');
  if (target.error) return interaction.reply({ content: target.error, ephemeral: true });
  if (!target.member.bannable) return interaction.reply({ content: '❌ I cannot ban that member. Check my role position and Ban Members permission.', ephemeral: true });
  const reason = interaction.options.getString('reason') || 'No reason provided';
  try {
    await target.member.ban({ reason });
    return interaction.reply({ content: '<@' + target.user.id + '> has been successfully banned.' });
  } catch (error) {
    console.error('Ban error:', error);
    return interaction.reply({ content: '❌ I could not ban that member. Check my permissions and role hierarchy.', ephemeral: true });
  }
}

async function handleInteraction(interaction) {
  if (interaction.isModalSubmit() && interaction.customId.startsWith('event_submit:modal:')) {
    const eventId = interaction.customId.slice('event_submit:modal:'.length);
    return eventSystem.submit(interaction, eventId);
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'createevent') return eventSystem.createEvent(interaction);
    if (interaction.commandName === 'send') return eventSystem.send(interaction);
    if (interaction.commandName === 'stick') return eventSystem.stick(interaction);
    if (interaction.commandName === 'end') return eventSystem.end(interaction);
    if (interaction.commandName === 'mute') return handleMute(interaction);
    if (interaction.commandName === 'kick') return handleKick(interaction);
    if (interaction.commandName === 'ban') return handleBan(interaction);

    if (interaction.commandName === 'fame') return handleVote(interaction, 'fame');
    if (interaction.commandName === 'humiliate') return handleVote(interaction, 'humiliation');
    if (interaction.commandName === 'reputation') return handleReputation(interaction);
    if (interaction.commandName === 'leaderboard') return showLeaderboard(interaction, interaction.options.getSubcommand());
    if (interaction.commandName === 'reputation-admin') return handleAdmin(interaction);
  }

  if (interaction.isButton() && interaction.customId.startsWith('event_submit:')) {
    const value=interaction.customId.slice('event_submit:'.length);
    if(value.startsWith('modal:')) return eventSystem.submit(interaction,value.slice(6));
    return eventSystem.showModal(interaction,value);
  }
  if (interaction.isButton() && interaction.customId.startsWith('event_review:')) {
    const value=interaction.customId.slice('event_review:'.length); const split=value.split(':');
    return eventSystem.review(interaction,split[0],split[1]);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rep:')) {
    const [, type, pageText, ownerId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '❌ These leaderboard controls belong to the person who opened the leaderboard.', ephemeral: true });
    }
    return showLeaderboard(interaction, type, Number(pageText));
  }
}

module.exports = { commands, handleInteraction };
