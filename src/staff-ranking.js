const {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} = require('discord.js');
const db = require('./db');
const { config } = require('./config');
const { STAFF_ROLE_ID } = require('./staff-analytics');

const TIME_ZONE = 'Asia/Riyadh';
const COLORS = { messages: 0x3c3c3d, punishments: 0x5865f2 };
let diagnosticTableReady = false;
let snapshotsTableReady = false;
let memberCacheSyncPromise = null;
const AUTHOR_IMAGE_URL = 'https://cdn.imageurlgenerator.com/uploads/be02df8f-b7f6-4d45-899b-02b5c3dcfc51.jpg';

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function safeName(value) {
  return String(value || 'Unknown')
    .replace(/[\r\n\t`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

function renderRankingRows(rows, previousRanks = {}) {
  if (!rows.length) return '_No staff members were found for this ranking._';
  const medals = ['🥇', '🥈', '🥉'];
  return rows.map((row, index) => {
    const rank = Number(row.rank || index + 1);
    const previousRank = Number(previousRanks[row.user_id]);
    const movement = !Number.isFinite(previousRank) || previousRank <= 0
      ? '●'
      : rank < previousRank ? '▲' : rank > previousRank ? '▼' : '●';
    const name = safeName(row.display_name);
    const heading = medals[rank - 1]
      ? '### ' + medals[rank - 1] + ' **' + name + '** ' + movement
      : '**' + String(rank).padStart(2, '0') + '. ' + name + '** ' + movement;
    const stats = '**' + formatCount(row.last_7d) + '**  ·  **' +
      formatCount(row.last_14d) + '**  ·  **' + formatCount(row.all_time) + '**';
    return heading + '\\n' + stats;
  }).join('\\n');
}

async function ensureSnapshotsTable() {
  if (snapshotsTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_staff_ranking_snapshots (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('messages', 'punishments')),
      slot_key TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ranks JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (guild_id, category, slot_key)
    );
    CREATE INDEX IF NOT EXISTS idx_nrr_staff_ranking_snapshots_latest
      ON nrr_staff_ranking_snapshots(guild_id, category, captured_at DESC);
  `);
  snapshotsTableReady = true;
}

async function getPreviousRanks(guildId, category) {
  await ensureSnapshotsTable();
  const result = await db.query(`
    SELECT ranks
    FROM nrr_staff_ranking_snapshots
    WHERE guild_id = $1 AND category = $2
    ORDER BY captured_at DESC, id DESC
    LIMIT 1
  `, [guildId, category]);
  return result.rows[0]?.ranks || {};
}

async function getRankingData(communityGuild, category) {
  // Fetch the full member list once per process, not once per interaction.
  // This avoids incomplete role.members caches while preventing repeated
  // Gateway member-request bursts.
  if (!memberCacheSyncPromise) {
    memberCacheSyncPromise = communityGuild.members.fetch().catch(error => {
      memberCacheSyncPromise = null;
      throw Object.assign(error, { staffRankingStage: 'sync_staff_member_cache' });
    });
  }
  await memberCacheSyncPromise;

  const role = communityGuild.roles.cache.get(STAFF_ROLE_ID)
    || await communityGuild.roles.fetch(STAFF_ROLE_ID).catch(() => null);
  if (!role) throw Object.assign(new Error('Staff Team role not found in Community Server.'), { staffRankingStage: 'resolve_staff_role' });

  const members = [...role.members.values()].filter(member => !member.user.bot);
  if (!members.length) {
    throw Object.assign(
      new Error('No cached non-bot Staff Team members were available. Check startup member synchronization and the GuildMembers intent.'),
      { staffRankingStage: 'read_staff_member_cache' }
    );
  }

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
    const score = [rows[i].last_7d, rows[i].last_14d, rows[i].all_time].join(':');
    if (score !== previousScore) position = i + 1;
    rows[i].rank = position;
    previousScore = score;
  }
  return rows;
}

async function buildComponents(client, category, onStage = () => {}) {
  onStage('resolve_community_guild');
  const communityGuild = client.guilds.cache.get(config.guildId)
    || await client.guilds.fetch(config.guildId);
  onStage('sync_staff_member_cache');
  const rows = await getRankingData(communityGuild, category);
  const previousRanks = await getPreviousRanks(communityGuild.id, category);
  onStage('render_ranking');

  const title = category === 'punishments'
    ? 'NR:R Staff Punishments Ranking'
    : 'NR:R Staff Messages Ranking';
  const description = [
    '**LAST 7 DAYS**  ·  **LAST 14 DAYS**  ·  **ALL TIME**',
    '',
    renderRankingRows(rows, previousRanks),
  ].join('\\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS[category])
    .setAuthor({ name: 'NR:C Staff Hub', iconURL: AUTHOR_IMAGE_URL })
    .setTitle(title)
    .setDescription(description);

  if (category === 'messages') {
    const totalWeeklyMessages = rows.reduce((sum, row) => sum + row.last_7d, 0);
    const weeklyAverage = rows.length ? totalWeeklyMessages / rows.length : 0;
    embed.setFooter({
      text: 'Team weekly average: ' +
        weeklyAverage.toLocaleString('en-US', { maximumFractionDigits: 1 }) +
        ' messages per staff member',
    });
  } else {
    embed.setFooter({ text: 'NR:R Staff Rankings' });
  }

  const selector = new StringSelectMenuBuilder()
    .setCustomId('staff-ranking:category')
    .setPlaceholder('Switch ranking category')
    .addOptions(
      { label: 'Messages', value: 'messages', description: 'View staff message rankings', default: category === 'messages' },
      { label: 'Punishments', value: 'punishments', description: 'View staff punishment rankings', default: category === 'punishments' },
    );
  const row = new ActionRowBuilder().addComponents(selector);
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

async function saveRankingSnapshots(client, slotKey) {
  await ensureSnapshotsTable();
  const communityGuild = client.guilds.cache.get(config.guildId)
    || await client.guilds.fetch(config.guildId);
  for (const category of ['messages', 'punishments']) {
    const rows = await getRankingData(communityGuild, category);
    const ranks = Object.fromEntries(rows.map(row => [row.user_id, row.rank]));
    await db.query(`
      INSERT INTO nrr_staff_ranking_snapshots (guild_id, category, slot_key, ranks)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (guild_id, category, slot_key) DO NOTHING
    `, [communityGuild.id, category, slotKey, JSON.stringify(ranks)]);
  }
}

async function handleCommand(interaction) {
  if (!config.guildId) {
    return interaction.reply({ content: 'The Community Server ID is not configured.', ephemeral: true });
  }
  if (!config.staffGuildId || interaction.guildId !== config.staffGuildId) {
    return interaction.reply({ content: 'This command is only available in the Staff Server.', ephemeral: true });
  }

  const category = interaction.options.getString('category') || 'messages';
  let stage = 'defer_initial_response';
  try {
    await interaction.deferReply();
    stage = 'build_ranking';
    const components = await buildComponents(interaction.client, category, next => { stage = next; });
    stage = 'send_ranking_response';
    return await interaction.editReply(components);
  } catch (error) {
    const diagnosticId = await recordDiagnostic({
      source: 'slash_command', stage: error.staffRankingStage || stage, category, interaction, error,
      details: { command: 'staff_ranking', deferred: interaction.deferred },
    });
    const errorEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Staff Ranking could not be loaded')
      .setDescription('Diagnostic ID: **' + (diagnosticId ? 'SR-' + diagnosticId : 'not saved') + '**');
    return interaction.editReply({
      embeds: [errorEmbed],
      components: [],
      allowedMentions: { parse: [] },
    }).catch(editError => {
      console.error('[StaffRankingDiagnostic] Could not send V2 failure response:', editError);
    });
  }
}

async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'staff-ranking:category') return false;
  const category = interaction.values[0];
  if (!['messages', 'punishments'].includes(category)) {
    return interaction.reply({ content: 'Invalid ranking category.', ephemeral: true });
  }
  let stage = 'build_selected_category';
  try {
    const components = await buildComponents(interaction.client, category, next => { stage = next; });
    stage = 'update_original_ranking_message';
    await interaction.update(components);
  } catch (error) {
    const diagnosticId = await recordDiagnostic({
      source: 'category_select', stage: error.staffRankingStage || stage, category, interaction, error,
      details: { customId: interaction.customId, messageId: interaction.message?.id },
    });
    await interaction.reply({
      content: 'That ranking could not be loaded. Diagnostic ID: ' + (diagnosticId ? 'SR-' + diagnosticId : 'not saved') + '.',
      ephemeral: true,
    }).catch(replyError => console.error('[StaffRankingDiagnostic] Could not send select failure notice:', replyError));
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
    await message.channel.send(components);
  } catch (error) {
    const diagnosticId = await recordDiagnostic({
      source: 'prefix_command', stage: error.staffRankingStage || 'build_or_send', category, message, error,
      details: { command: '!staff_ranking' },
    });
    await message.reply('I could not load the staff rankings. Diagnostic ID: ' + (diagnosticId ? 'SR-' + diagnosticId : 'not saved') + '.').catch(() => {});
  }
  return true;
}

async function handleDiagnosticsMessage(message) {
  if (!message.guild || message.guild.id !== config.staffGuildId || message.author.bot || message.webhookId) return false;
  if (!/^!staff_ranking_diagnostics$/i.test(message.content.trim())) return false;
  if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply('You need Manage Server permission to view Staff Ranking diagnostics.').catch(() => {});
    return true;
  }
  try {
    await ensureDiagnosticsTable();
    const result = await db.query(`
      SELECT id,created_at,source,stage,category,error_name,error_code,error_message
      FROM nrr_staff_ranking_diagnostics
      ORDER BY created_at DESC LIMIT 10
    `);
    if (!result.rows.length) {
      await message.reply('No Staff Ranking failures have been recorded.').catch(() => {});
      return true;
    }
    const lines = result.rows.map(row => {
      const date = new Date(row.created_at).toLocaleString('en-GB', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' });
      return '**SR-' + row.id + '** • ' + date + ' KSA\\n' +
        '`' + row.source + ' / ' + row.stage + (row.category ? ' / ' + row.category : '') + '`\\n' +
        '`' + String(row.error_code || row.error_name || 'Error') + '` ' +
        String(row.error_message || '').replace(/[\\r\\n`]/g, ' ').slice(0, 220);
    });
    const report = ('**Latest Staff Ranking diagnostics**\\n\\n' + lines.join('\\n\\n')).slice(0, 1850);
    await message.reply({ content: report, allowedMentions: { parse: [] } }).catch(() => {});
  } catch (error) {
    console.error('[StaffRankingDiagnostic] Diagnostics command failed:', error);
    await message.reply('Could not read Staff Ranking diagnostics. Check Railway logs.').catch(() => {});
  }
  return true;
}

async function startScheduler(client) {
  await ensureDiagnosticsTable();
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
    await channel.send(components);
    await db.query('INSERT INTO nrr_staff_ranking_schedule(slot_key) VALUES($1) ON CONFLICT DO NOTHING', [slot]);
    await saveRankingSnapshots(client, slot).catch(error => {
      console.error('Could not save Staff Ranking trend snapshots for slot ' + slot + ':', error);
    });
    console.log('Posted scheduled Staff Ranking for Saudi time slot ' + slot + '.');
  };
  await checkAndPost().catch(error => console.error('Initial staff ranking schedule check failed:', error));
  setInterval(() => checkAndPost().catch(error => console.error('Staff ranking schedule failed:', error)), 60 * 1000);
}

module.exports = {
  buildComponents, handleCommand, handleSelect, handlePrefixMessage,
  handleDiagnosticsMessage, startScheduler,
};
