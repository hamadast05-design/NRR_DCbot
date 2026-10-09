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
const wordkillSystem = require('./wordkill');
const insightsSystem = require('./insights');

const COLORS = {
  fame: 0xf1c40f,
  humiliation: 0xe74c3c,
  reputation: 0x5865f2,
};

const commands = [
  new SlashCommandBuilder().setName('start_wordkill').setDescription('Start a WordKill game in this channel.'),
  new SlashCommandBuilder().setName('end_wordkill').setDescription('End the active WordKill game in this channel.'),

  new SlashCommandBuilder()
    .setName('insights')
    .setDescription('NRR AI Server Intelligence dashboard and analysis.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand(s => s.setName('dashboard').setDescription('Open the interactive Server Intelligence dashboard.'))
    .addSubcommand(s => s.setName('setup').setDescription('Enable analysis for selected text channels.')
      .addStringOption(o => o.setName('channels').setDescription('Mention text channels to monitor, separated by commas.').setRequired(true).setMaxLength(1000))
      .addChannelOption(o => o.setName('dashboard_channel').setDescription('Optional channel where the dashboard embed should be posted.')))
    .addSubcommand(s => s.setName('ask').setDescription('Ask the AI a question about analyzed server activity.')
      .addStringOption(o => o.setName('question').setDescription('What would you like to understand about the community?').setRequired(true).setMaxLength(700)))
    .addSubcommand(s => s.setName('report').setDescription('Generate a weekly AI community intelligence report.')),


  new SlashCommandBuilder().setName('createevent').setDescription('Create an event submission configuration.').addStringOption(o=>o.setName('channel_id').setDescription('Destination channel ID.').setRequired(true)),
  new SlashCommandBuilder().setName('send').setDescription('Send the event submission interface.').addStringOption(o=>o.setName('channel_id').setDescription('Channel for the submission interface.').setRequired(true)),
  new SlashCommandBuilder().setName('stick').setDescription('Keep the submission interface at the top of a channel.').addStringOption(o=>o.setName('channel_id').setDescription('Channel to stick the interface in.').setRequired(true)),
  new SlashCommandBuilder().setName('end').setDescription('End the active event and remove its bot messages.'),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
    .addUserOption(o => o.setName('user').setDescription('Member to mute.').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('Any duration up to 28 days, e.g. 10 minutes, 90m, 2 hours.').setRequired(true))
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
    .setName('whitelist')
    .setDescription('Manage Fame and Humiliation immunity.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand(s => s.setName('add').setDescription('Make a member immune from Fame or Humiliation.')
      .addUserOption(o => o.setName('member').setDescription('Member to whitelist.').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Reputation type to make immune.').setRequired(true)
        .addChoices({ name: 'Fame', value: 'fame' }, { name: 'Humiliation', value: 'humiliation' })))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a member from Fame or Humiliation immunity.')
      .addUserOption(o => o.setName('member').setDescription('Member to remove from the whitelist.').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Reputation type to remove immunity for.').setRequired(true)
        .addChoices({ name: 'Fame', value: 'fame' }, { name: 'Humiliation', value: 'humiliation' }))),

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

function mention(id) { return `<@${id}>`; }

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
  await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}

async function handleVote(interaction, type) {
  const target = interaction.options.getUser('member', true);
  const actor = interaction.user;
  if (target.id === actor.id) return interaction.reply({ content: '❌ You cannot give Fame or Humiliation to yourself.', ephemeral: true });
  if (target.bot && !config.allowBotTargets) return interaction.reply({ content: '❌ Bots cannot receive Fame or Humiliation.', ephemeral: true });
  const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!targetMember) return interaction.reply({ content: '❌ That member is not currently in this server.', ephemeral: true });

  try {
    const result = await db.castVote({ guildId: interaction.guildId, voterId: actor.id, targetId: target.id, type, cooldownMs: config.cooldownMs });
    if (!result.ok) {
      if (result.reason === 'whitelisted') {
        const noun = type === 'fame' ? 'Fame' : 'Humiliation';
        return interaction.reply({ content: `🛡️ ${mention(target.id)} is currently immune from receiving ${noun}.`, ephemeral: true, allowedMentions: { parse: [] } });
      }
      return interaction.reply({ content: `⏳ You already gave ${type === 'fame' ? 'Fame' : 'Humiliation'} to ${mention(target.id)} recently. You can vote for them again in about ${formatRemaining(result.remainingMs)}.`, ephemeral: true, allowedMentions: { parse: [] } });
    }
    const stats = result.stats;
    const noun = type === 'fame' ? 'Fame' : 'Humiliation';
    const emoji = type === 'fame' ? '⭐' : '👎';
    const message = `${emoji} **${noun} Given**\n${mention(actor.id)} gave +1 ${noun} to ${mention(target.id)}.\n\n${mention(target.id)} now has **${type === 'fame' ? stats.fame : stats.humiliation} ${noun}**.`;
    await interaction.reply({ content: message, ephemeral: false, allowedMentions: { parse: [] } });
    await sendLog(interaction, `${emoji} ${noun} Awarded`, message, COLORS[type]);
  } catch (error) {
    console.error('Vote error:', error);
    await interaction.reply({ content: '❌ Something went wrong while recording that vote. Please try again later.', ephemeral: true }).catch(() => {});
  }
}

async function handleWhitelist(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You do not have permission to manage the reputation whitelist.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser('member', true);
  const type = interaction.options.getString('type', true);
  const noun = type === 'fame' ? 'Fame' : 'Humiliation';
  try {
    await db.setWhitelist(interaction.guildId, target.id, type, sub === 'add');
    const action = sub === 'add' ? `is now immune from receiving ${noun}` : `can now receive ${noun} again`;
    return interaction.reply({ content: `✅ ${mention(target.id)} ${action}.`, ephemeral: true, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('Whitelist error:', error);
    return interaction.reply({ content: '❌ I could not update the reputation whitelist.', ephemeral: true });
  }
}

async function handleReputation(interaction) {
  const user = interaction.options.getUser('member') || interaction.user;
  try {
    await db.ensureMember(interaction.guildId, user.id, true);
    const stats = await db.getRanks(interaction.guildId, user.id, config.showDeparted);
    const embed = new EmbedBuilder().setTitle(`⭐ Reputation — ${user.username}`).setThumbnail(user.displayAvatarURL({ size: 128 })).setColor(COLORS.reputation).addFields(
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
  const lines = rows.length ? rows.map((row, i) => {
    const position = (page - 1) * pageSize + i + 1;
    const value = type === 'fame' ? row.fame : type === 'humiliation' ? row.humiliation : row.score;
    const formatted = type === 'reputation' && value >= 0 ? `+${value}` : value;
    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
    return `${medal} ${mention(row.user_id)} — **${formatted} ${label}**`;
  }).join('\n') : 'No reputation data yet.';
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
  if (!interaction.memberPermissions?.has(config.adminPermission)) return interaction.reply({ content: '❌ You do not have permission to use reputation administration commands.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser('member', true);
  if (target.bot && !config.allowBotTargets) return interaction.reply({ content: '❌ Bots cannot be modified by the reputation system.', ephemeral: true });
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
  const text = String(input || '').trim().toLowerCase();
  const regex = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w)/g;
  const multipliers = { s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000, m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000, h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000, d: 86400000, day: 86400000, days: 86400000, w: 604800000, week: 604800000, weeks: 604800000 };
  let match; let duration = 0; let consumed = 0;
  while ((match = regex.exec(text))) {
    if (text.slice(consumed, match.index).trim()) return null;
    duration += Number(match[1]) * multipliers[match[2]];
    consumed = regex.lastIndex;
  }
  if (!duration || text.slice(consumed).trim()) return null;
  if (!Number.isFinite(duration) || duration < 1000 || duration > 28 * 24 * 60 * 60 * 1000) return null;
  return Math.round(duration);
}

function formatMuteDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
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

async function getModerationTarget(interaction, optionName) {
  const user = interaction.options.getUser(optionName, true);
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return { error: '❌ That member is not currently in this server.' };
  if (member.id === interaction.user.id) return { error: '❌ You cannot use this action on yourself.' };
  if (member.id === interaction.guild.ownerId) return { error: '❌ You cannot moderate the server owner.' };
  return { user, member };
}

async function handleMute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '❌ You do not have permission to mute members.', ephemeral: true });
  const target = await getModerationTarget(interaction, 'user');
  if (target.error) return interaction.reply({ content: target.error, ephemeral: true });
  const duration = parseMuteDuration(interaction.options.getString('time', true));
  if (!duration) return interaction.reply({ content: '❌ Invalid mute duration. Use something like `10m`, `2 hours`, or `1d` (maximum 28 days).', ephemeral: true });
  if (!target.member.moderatable) return interaction.reply({ content: '❌ I cannot mute that member. Check my role position and Moderate Members permission.', ephemeral: true });
  const reason = interaction.options.getString('reason') || 'No reason provided';
  try { await target.member.timeout(duration, reason); return interaction.reply({ content: `🔇 ${mention(target.user.id)} has been muted for **${formatMuteDuration(duration)}**.`, allowedMentions: { parse: [] } }); }
  catch (error) { console.error('Mute error:', error); return interaction.reply({ content: '❌ I could not mute that member. Check my permissions and role hierarchy.', ephemeral: true }); }
}

async function handleKick(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '❌ You do not have permission to kick members.', ephemeral: true });
  const target = await getModerationTarget(interaction, 'user');
  if (target.error) return interaction.reply({ content: target.error, ephemeral: true });
  if (!target.member.kickable) return interaction.reply({ content: '❌ I cannot kick that member. Check my role position and Kick Members permission.', ephemeral: true });
  const reason = interaction.options.getString('reason') || 'No reason provided';
  try { await target.member.kick(reason); return interaction.reply({ content: `${mention(target.user.id)} has been successfully kicked 😨.`, allowedMentions: { parse: [] } }); }
  catch (error) { console.error('Kick error:', error); return interaction.reply({ content: '❌ I could not kick that member. Check my permissions and role hierarchy.', ephemeral: true }); }
}

async function handleBan(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '❌ You do not have permission to ban members.', ephemeral: true });
  const target = await getModerationTarget(interaction, 'user');
  if (target.error) return interaction.reply({ content: target.error, ephemeral: true });
  if (!target.member.bannable) return interaction.reply({ content: '❌ I cannot ban that member. Check my role position and Ban Members permission.', ephemeral: true });
  const reason = interaction.options.getString('reason') || 'No reason provided';
  try { await target.member.ban({ reason }); return interaction.reply({ content: `${mention(target.user.id)} has been successfully banned.`, allowedMentions: { parse: [] } }); }
  catch (error) { console.error('Ban error:', error); return interaction.reply({ content: '❌ I could not ban that member. Check my permissions and role hierarchy.', ephemeral: true }); }
}

async function handleInteraction(interaction) {
  if ((interaction.isChatInputCommand() && interaction.commandName === 'insights') || (interaction.isButton() && interaction.customId.startsWith('insights:view:'))) return insightsSystem.handleInteraction(interaction);
  if (interaction.isModalSubmit() && interaction.customId.startsWith('event_submit:modal:')) return eventSystem.submit(interaction, interaction.customId.slice('event_submit:modal:'.length));

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'createevent') return eventSystem.createEvent(interaction);
    if (interaction.commandName === 'send') return eventSystem.send(interaction);
    if (interaction.commandName === 'stick') return eventSystem.stick(interaction);
    if (interaction.commandName === 'end') return eventSystem.end(interaction);
    if (interaction.commandName === 'start_wordkill') return wordkillSystem.startCommand(interaction);
    if (interaction.commandName === 'end_wordkill') return wordkillSystem.endCommand(interaction);
    if (interaction.commandName === 'mute') return handleMute(interaction);
    if (interaction.commandName === 'kick') return handleKick(interaction);
    if (interaction.commandName === 'ban') return handleBan(interaction);
    if (interaction.commandName === 'fame') return handleVote(interaction, 'fame');
    if (interaction.commandName === 'humiliate') return handleVote(interaction, 'humiliation');
    if (interaction.commandName === 'reputation') return handleReputation(interaction);
    if (interaction.commandName === 'leaderboard') return showLeaderboard(interaction, interaction.options.getSubcommand());
    if (interaction.commandName === 'whitelist') return handleWhitelist(interaction);
    if (interaction.commandName === 'reputation-admin') return handleAdmin(interaction);
  }

  if (interaction.isButton() && interaction.customId.startsWith('event_submit:')) {
    const value = interaction.customId.slice('event_submit:'.length);
    if (value.startsWith('modal:')) return eventSystem.submit(interaction, value.slice(6));
    return eventSystem.showModal(interaction, value);
  }
  if (interaction.isButton() && interaction.customId.startsWith('event_review:')) {
    const value = interaction.customId.slice('event_review:'.length);
    const split = value.split(':');
    return eventSystem.review(interaction, split[0], split[1], split[2]);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rep:')) {
    const [, type, pageText, ownerId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) return interaction.reply({ content: '❌ These leaderboard controls belong to the person who opened the leaderboard.', ephemeral: true });
    return showLeaderboard(interaction, type, Number(pageText));
  }
}

module.exports = { commands, handleInteraction };
