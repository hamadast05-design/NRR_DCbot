const {
  ActionRowBuilder,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} = require('discord.js');
const db = require('./db');
const { config } = require('./config');
const { STAFF_ROLE_ID } = require('./staff-analytics');

const TIME_ZONE = 'Asia/Riyadh';
const COLORS = { messages: 0x3c3c3d, punishments: 0x5865f2 };

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function safeName(value) {
  return String(value || 'Unknown')
    .replace(/[\r\n\t`]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 19);
}

function makeTable(rows) {
  const heading = [
    '`#  STAFF MEMBER          LAST 7D   LAST 14D   ALL TIME`',
    '`────────────────────────────────────────────────────────`',
  ];
  if (!rows.length) return 'No staff members with the Staff Team role were found.';
  const lines = rows.map((row, index) => {
    const rank = String(row.rank || index + 1).padStart(2, ' ');
    const name = safeName(row.display_name).padEnd(19, ' ');
    const seven = formatCount(row.last_7d).padStart(7, ' ');
    const fourteen = formatCount(row.last_14d).padStart(7, ' ');
    const all = formatCount(row.all_time).padStart(9, ' ');
    return '`' + rank + '  ' + name + '  ' + seven + '  ' + fourteen + '  ' + all + '`';
  });
  return heading.concat(lines).join('\n');
}

async function getRankingData(communityGuild, category) {
  await communityGuild.members.fetch();
  const role = await communityGuild.roles.fetch(STAFF_ROLE_ID).catch(() => null);
  if (!role) throw new Error('The configured Staff Team role could not be found in the Community Server.');
  const members = [...role.members.values()].filter(member => !member.user.bot);
  if (!members.length) return [];

  const ids = members.map(member => member.id);
  const table = category === 'punishments' ? 'nrr_punishments' : 'nrr_message_activity';
  const personColumn = category === 'punishments' ? 'moderator_id' : 'user_id';
  const dateColumn = category === 'punishments' ? 'occurred_at' : 'created_at';
  const result = await db.query(
    `SELECT ${personColumn} AS user_id,
      COUNT(*) FILTER (WHERE ${dateColumn} >=
        ((date_trunc('day', NOW() AT TIME ZONE $3) - INTERVAL '6 days') AT TIME ZONE $3)
      )::int AS last_7d,
      COUNT(*) FILTER (WHERE ${dateColumn} >=
        ((date_trunc('day', NOW() AT TIME ZONE $3) - INTERVAL '13 days') AT TIME ZONE $3)
      )::int AS last_14d,
      COUNT(*)::int AS all_time
    FROM ${table}
    WHERE guild_id = $1 AND ${personColumn} = ANY($2::text[])
    GROUP BY ${personColumn}`,
    [communityGuild.id, ids, TIME_ZONE]
  );

  const counts = new Map(result.rows.map(row => [row.user_id, row]));
  const rows = members.map(member => {
    const stats = counts.get(member.id) || {};
    return {
      user_id: member.id,
      display_name: member.displayName || member.user.username,
      last_7d: Number(stats.last_7d || 0),
      last_14d: Number(stats.last_14d || 0),
      all_time: Number(stats.all_time || 0),
    };
  }).sort((a, b) =>
    b.last_7d - a.last_7d ||
    b.last_14d - a.last_14d ||
    b.all_time - a.all_time ||
    a.display_name.localeCompare(b.display_name)
  );
  let previousScore = null;
  let position = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].last_7d !== previousScore) position = i + 1;
    rows[i].rank = position;
    previousScore = rows[i].last_7d;
  }
  const cutoffRank = rows[Math.min(9, rows.length - 1)]?.rank;
  return rows.filter(row => row.rank <= cutoffRank);
}

async function buildComponents(client, category) {
  const communityGuild = await client.guilds.fetch(config.guildId);
  const rows = await getRankingData(communityGuild, category);
  const description = category === 'punishments'
    ? 'Counts bans, kicks and timeouts recorded against staff moderators.'
    : 'Counts messages sent by staff members. Bot and webhook messages are excluded.';
  const title = category === 'punishments' ? '## NR:R Staff Punishment Rankings' : '## NR:R Staff Message Rankings';
  const table = makeTable(rows);
  const chunks = [];
  let current = '';
  for (const line of table.split('\n')) {
    if (current.length + line.length + 1 > 3800) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n' : '') + line;
  }
  if (current) chunks.push(current);

  const container = new ContainerBuilder()
    .setAccentColor(COLORS[category])
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(title + '\n' + description))
    .addSeparatorComponents(new SeparatorBuilder());

  for (const chunk of chunks) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
  }

  const selector = new StringSelectMenuBuilder()
    .setCustomId('staff-ranking:category')
    .setPlaceholder('Switch ranking category')
    .addOptions(
      { label: 'Messages', value: 'messages', description: 'Rank staff by messages sent', default: category === 'messages' },
      { label: 'Punishments', value: 'punishments', description: 'Rank staff by punishments issued', default: category === 'punishments' },
    );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(selector));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    '`Last 7d` and `Last 14d` use Saudi Arabia calendar days (Asia/Riyadh). All Time covers every recorded entry. Sorted by Last 7d, with longer periods used to break ties.'
  ));
  return [container];
}

async function handleCommand(interaction) {
  if (!config.guildId) {
    return interaction.reply({ content: 'The Community Server ID is not configured.', ephemeral: true });
  }
  if (!config.staffGuildId || interaction.guildId !== config.staffGuildId) {
    return interaction.reply({ content: 'This command is only available in the Staff Server.', ephemeral: true });
  }
  const category = interaction.options.getString('category') || 'messages';
  await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
  try {
    const components = await buildComponents(interaction.client, category);
    return interaction.editReply({ components, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('Staff ranking load failed:', error);
    return interaction.editReply({
      components: [new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## Staff Rankings\nI could not load the staff rankings. Please check the bot logs and configuration.')
      )],
    }).catch(() => {});
  }
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'staff-ranking:category') return false;
  const category = interaction.values[0];
  if (!['messages', 'punishments'].includes(category)) {
    return interaction.reply({ content: 'Invalid ranking category.', ephemeral: true });
  }
  try {
    const components = await buildComponents(interaction.client, category);
    await interaction.update({ components, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('Staff ranking category switch failed:', error);
    await interaction.reply({ content: 'I could not load that ranking right now.', ephemeral: true }).catch(() => {});
  }
  return true;
}


async function handlePrefixMessage(message) {
  if (!message.guild || message.guild.id !== config.staffGuildId || message.author.bot || message.webhookId) return false;
  const match = message.content.trim().match(/^!staff_ranking(?:\\s+(messages|punishments))?$/i);
  if (!match) return false;
  const category = (match[1] || 'messages').toLowerCase();
  try {
    const components = await buildComponents(message.client, category);
    await message.channel.send({ components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('Staff ranking prefix command failed:', error);
    await message.reply('I could not load the staff rankings right now.').catch(() => {});
  }
  return true;
}

async function startScheduler(client) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_staff_ranking_schedule (
      slot_key TEXT PRIMARY KEY,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const checkAndPost = async () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).reduce((out, part) => {
      out[part.type] = part.value;
      return out;
    }, {});
    if (!['00', '12'].includes(parts.hour)) return;
    const slot = parts.year + '-' + parts.month + '-' + parts.day + '-' + parts.hour;
    const existing = await db.query('SELECT 1 FROM nrr_staff_ranking_schedule WHERE slot_key = $1', [slot]);
    if (existing.rowCount) return;
    const channel = await client.channels.fetch(config.staffRankingChannelId).catch(() => null);
    if (!channel?.isTextBased() || !channel.send) {
      console.error('Staff ranking schedule: configured channel is unavailable.');
      return;
    }
    const components = await buildComponents(client, 'messages');
    await channel.send({ components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    await db.query('INSERT INTO nrr_staff_ranking_schedule(slot_key) VALUES($1) ON CONFLICT DO NOTHING', [slot]);
    console.log('Posted scheduled Staff Ranking for Saudi time slot ' + slot + '.');
  };
  await checkAndPost().catch(error => console.error('Initial staff ranking schedule check failed:', error));
  setInterval(() => checkAndPost().catch(error => console.error('Staff ranking schedule failed:', error)), 60 * 1000);
}

module.exports = { buildComponents, handleCommand, handleSelect, handlePrefixMessage, startScheduler };
