const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('./db');

const API_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.OPENAI_INSIGHTS_MODEL || 'gpt-4.1-mini';
const BATCH_INTERVAL_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 30;
let clientRef = null;
let processing = false;

function clean(value, max = 1800) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}
function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of (Array.isArray(data?.output) ? data.output : [])) {
    for (const block of (Array.isArray(item.content) ? item.content : [])) {
      if ((block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string') parts.push(block.text);
    }
  }
  return parts.join('\n').trim();
}
function parseModelJson(text) {
  const normalized = String(text || '').trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '');
  return JSON.parse(normalized);
}
function parseChannelIds(value) {
  return [...new Set(String(value || '').match(/\d{15,22}/g) || [])];
}
function isManager(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}
function dashboardEmbed(guild, status = {}) {
  const enabled = Boolean(status.enabled);
  const channels = Array.isArray(status.channel_ids) ? status.channel_ids : [];
  return new EmbedBuilder().setTitle('🧠 NRR Server Intelligence')
    .setDescription('AI-powered overview of community topics, engagement, suggestions, and potential issues.')
    .setColor(enabled ? 0x2ecc71 : 0x95a5a6)
    .addFields(
      { name: 'System status', value: enabled ? '🟢 Collecting selected channels' : '⚪ Not configured', inline: true },
      { name: 'Monitored channels', value: String(channels.length), inline: true },
      { name: 'Retention', value: RETENTION_DAYS + ' days', inline: true },
      { name: 'Explore', value: 'Use the buttons below, or run /insights ask to ask a question.' }
    ).setFooter({ text: guild.name + ' • Management-only insights' }).setTimestamp();
}
function dashboardComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('insights:view:overview').setLabel('Overview').setStyle(ButtonStyle.Primary).setEmoji('📊'),
      new ButtonBuilder().setCustomId('insights:view:topics').setLabel('Topics').setStyle(ButtonStyle.Secondary).setEmoji('🧩'),
      new ButtonBuilder().setCustomId('insights:view:suggestions').setLabel('Suggestions').setStyle(ButtonStyle.Secondary).setEmoji('💡'),
      new ButtonBuilder().setCustomId('insights:view:complaints').setLabel('Concerns').setStyle(ButtonStyle.Secondary).setEmoji('🗣️'),
      new ButtonBuilder().setCustomId('insights:view:activity').setLabel('Activity').setStyle(ButtonStyle.Secondary).setEmoji('📈')
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('insights:view:incidents').setLabel('Potential incidents').setStyle(ButtonStyle.Danger).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('insights:view:help').setLabel('How to use').setStyle(ButtonStyle.Secondary).setEmoji('❔')
    )
  ];
}
async function getSettings(guildId) {
  const result = await db.query('SELECT * FROM insights_settings WHERE guild_id = $1', [guildId]);
  return result.rows[0] || { guild_id: guildId, enabled: false, channel_ids: [] };
}
async function setup(interaction) {
  if (!isManager(interaction)) return interaction.reply({ content: 'Only server management can configure Server Intelligence.', ephemeral: true });
  const ids = parseChannelIds(interaction.options.getString('channels', true));
  if (!ids.length) return interaction.reply({ content: 'I could not find channel IDs. Mention text channels separated by commas.', ephemeral: true });
  const valid = [];
  for (const id of ids) {
    const channel = await interaction.guild.channels.fetch(id).catch(() => null);
    if (channel?.isTextBased() && channel.viewable && channel.permissionsFor(interaction.client.user)?.has(['ViewChannel', 'ReadMessageHistory'])) valid.push(id);
  }
  if (!valid.length) return interaction.reply({ content: 'None of those are accessible text channels. Check the IDs and my View Channel / Read Message History permissions.', ephemeral: true });
  const result = await db.query(
    'INSERT INTO insights_settings (guild_id, enabled, channel_ids, updated_by, updated_at) VALUES ($1, TRUE, $2::jsonb, $3, NOW()) ON CONFLICT (guild_id) DO UPDATE SET enabled = TRUE, channel_ids = EXCLUDED.channel_ids, updated_by = EXCLUDED.updated_by, updated_at = NOW() RETURNING *',
    [interaction.guildId, JSON.stringify(valid), interaction.user.id]
  );
  // Remove stored records from channels that management has deselected.
  await db.query('DELETE FROM insights_messages WHERE guild_id = $1 AND NOT (channel_id = ANY($2::text[]))', [interaction.guildId, valid]);
  const dashboardChannel = interaction.options.getChannel('dashboard_channel');
  let posted = false;
  if (dashboardChannel?.isTextBased() && dashboardChannel.permissionsFor(interaction.client.user)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
    const message = await dashboardChannel.send({ embeds: [dashboardEmbed(interaction.guild, result.rows[0])], components: dashboardComponents(), allowedMentions: { parse: [] } });
    await db.query('UPDATE insights_settings SET dashboard_channel_id = $2, dashboard_message_id = $3 WHERE guild_id = $1', [interaction.guildId, dashboardChannel.id, message.id]);
    posted = true;
  }
  return interaction.reply({
    content: '✅ Server Intelligence enabled for ' + valid.map(id => '<#' + id + '>').join(', ') + '. ' + (posted ? 'Dashboard posted in <#' + dashboardChannel.id + '>.' : 'Use /insights dashboard to open it.') + '\nNew messages will be analyzed going forward; older messages are not backfilled automatically.',
    ephemeral: true, allowedMentions: { parse: [] }
  });
}
async function disable(interaction) {
  const result = await db.query('UPDATE insights_settings SET enabled = FALSE, updated_by = $2, updated_at = NOW() WHERE guild_id = $1 RETURNING *', [interaction.guildId, interaction.user.id]);
  if (result.rows[0]?.dashboard_channel_id && result.rows[0]?.dashboard_message_id) {
    const channel = await interaction.client.channels.fetch(result.rows[0].dashboard_channel_id).catch(() => null);
    const message = channel?.isTextBased() ? await channel.messages.fetch(result.rows[0].dashboard_message_id).catch(() => null) : null;
    if (message) await message.edit({ embeds: [dashboardEmbed(interaction.guild, result.rows[0])], components: dashboardComponents() }).catch(() => {});
  }
  return interaction.reply({ content: '⏸️ Server Intelligence collection is disabled. Existing reports remain available to management, and the 30-day retention policy still applies.', ephemeral: true });
}
async function openDashboard(interaction) {
  const settings = await getSettings(interaction.guildId);
  return interaction.reply({ embeds: [dashboardEmbed(interaction.guild, settings)], components: dashboardComponents(), ephemeral: true });
}
async function getStats(guildId) {
  const result = await db.query(
    "SELECT COUNT(*)::int AS total_messages, COUNT(DISTINCT author_id)::int AS active_members, COUNT(DISTINCT channel_id)::int AS active_channels, COUNT(*) FILTER (WHERE analyzed = TRUE)::int AS analyzed_messages, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS messages_24h, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS messages_7d, COUNT(*) FILTER (WHERE category = 'suggestion')::int AS suggestions, COUNT(*) FILTER (WHERE category = 'complaint')::int AS complaints, COUNT(*) FILTER (WHERE category = 'potential_incident')::int AS incidents FROM insights_messages WHERE guild_id = $1 AND created_at >= NOW() - ($2::int * INTERVAL '1 day')",
    [guildId, RETENTION_DAYS]
  );
  return result.rows[0];
}
async function renderView(interaction, view) {
  const guildId = interaction.guildId;
  if (view === 'help') {
    const embed = new EmbedBuilder().setTitle('❔ Server Intelligence Guide')
      .setDescription('Overview: collected-message and engagement totals.\nTopics: themes detected by AI.\nSuggestions / Concerns: recurring ideas and problems.\nActivity: recent daily message counts.\nPotential incidents: moderator-review flags, never automatic punishments.\n\nUse /insights ask for custom analysis or /insights report for a written summary. Configure channels with /insights setup.')
      .setColor(0x5865f2);
    return interaction.reply({ ephemeral: true, embeds: [embed] });
  }
  if (view === 'overview') {
    const s = await getStats(guildId);
    const embed = new EmbedBuilder().setTitle('📊 Server Overview').setColor(0x5865f2)
      .setDescription('Observed activity in selected channels; not a measure of individual member quality.')
      .addFields(
        { name: 'Messages captured', value: String(s.total_messages), inline: true },
        { name: 'Distinct participants', value: String(s.active_members), inline: true },
        { name: 'Channels represented', value: String(s.active_channels), inline: true },
        { name: 'Last 24 hours', value: String(s.messages_24h), inline: true },
        { name: 'Last 7 days', value: String(s.messages_7d), inline: true },
        { name: 'AI-reviewed', value: String(s.analyzed_messages), inline: true },
        { name: 'Suggestions', value: String(s.suggestions), inline: true },
        { name: 'Concerns', value: String(s.complaints), inline: true },
        { name: 'Review flags', value: String(s.incidents), inline: true }
      ).setFooter({ text: 'Rolling 30-day window • Selected channels only' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  if (view === 'activity') {
    const result = await db.query("SELECT DATE(created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS count FROM insights_messages WHERE guild_id = $1 AND created_at >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day DESC LIMIT 7", [guildId]);
    const lines = result.rows.length ? result.rows.map(row => '• ' + new Date(row.day).toISOString().slice(0, 10) + ' — **' + row.count + ' messages**').join('\n') : 'No messages collected yet.';
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('📈 Recent Activity').setDescription(lines).setColor(0x3498db).setFooter({ text: 'Daily counts from selected channels.' })], ephemeral: true });
  }
  const category = view === 'suggestions' ? 'suggestion' : view === 'complaints' ? 'complaint' : view === 'incidents' ? 'potential_incident' : null;
  if (category) {
    const result = await db.query("SELECT topic, COUNT(*)::int AS count, MAX(created_at) AS latest FROM insights_messages WHERE guild_id = $1 AND category = $2 AND analyzed = TRUE AND created_at >= NOW() - INTERVAL '30 days' GROUP BY topic ORDER BY count DESC, latest DESC LIMIT 8", [guildId, category]);
    const label = view === 'suggestions' ? '💡 Recurring Suggestions' : view === 'complaints' ? '🗣️ Recurring Concerns' : '🛡️ Potential Incidents for Review';
    const desc = result.rows.length ? result.rows.map((row, i) => '**' + (i + 1) + '. ' + clean(row.topic || 'Uncategorized', 120) + '** — ' + row.count + ' related message(s)\nLast seen: <t:' + Math.floor(new Date(row.latest).getTime() / 1000) + ':R>').join('\n\n') : 'No analyzed items in this category yet.';
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle(label).setDescription(desc.slice(0, 4000)).setColor(view === 'incidents' ? 0xe74c3c : 0x5865f2).setFooter({ text: 'AI flags are leads for human review, not verified conclusions.' })], ephemeral: true });
  }
  const result = await db.query("SELECT topic, COUNT(*)::int AS count, MAX(created_at) AS latest FROM insights_messages WHERE guild_id = $1 AND analyzed = TRUE AND topic IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days' GROUP BY topic ORDER BY count DESC, latest DESC LIMIT 10", [guildId]);
  const desc = result.rows.length ? result.rows.map((row, i) => '**' + (i + 1) + '. ' + clean(row.topic, 120) + '** — ' + row.count + ' message(s) • last seen <t:' + Math.floor(new Date(row.latest).getTime() / 1000) + ':R>').join('\n') : 'No topics analyzed yet. Give the system time to process messages after enabling it.';
  return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🧩 Trending Topics').setDescription(desc.slice(0, 4000)).setColor(0x5865f2).setFooter({ text: 'Topics are AI-inferred and may be imperfect.' })], ephemeral: true });
}
async function ask(interaction) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return interaction.reply({ content: 'OPENAI_API_KEY is missing in Railway variables.', ephemeral: true });
  const question = clean(interaction.options.getString('question', true), 700);
  await interaction.deferReply({ ephemeral: true });
  const settings = await getSettings(interaction.guildId);
  if (!settings.enabled) return interaction.editReply('Server Intelligence is not configured. Run /insights setup and select channels.');
  const contextResult = await db.query("SELECT channel_id, message_id, content, created_at, category, topic, summary, confidence FROM insights_messages WHERE guild_id = $1 AND analyzed = TRUE AND created_at >= NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 80", [interaction.guildId]);
  const topicResult = await db.query("SELECT topic, category, COUNT(*)::int AS count FROM insights_messages WHERE guild_id = $1 AND analyzed = TRUE AND topic IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days' GROUP BY topic, category ORDER BY count DESC LIMIT 30", [interaction.guildId]);
  const context = contextResult.rows.reverse().map(row => ({
    channel: '<#' + row.channel_id + '>', timestamp: row.created_at, text: row.content,
    topic: row.topic, category: row.category, summary: row.summary, confidence: row.confidence,
    link: 'https://discord.com/channels/' + interaction.guildId + '/' + row.channel_id + '/' + row.message_id
  }));
  const response = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({ model: MODEL, input: [
      { role: 'system', content: 'You are NRR Server Intelligence, an analytical assistant for authorized Discord management. Answer only from supplied collected data. Never invent counts, events, causes, quotes, or conclusions. Distinguish correlation from causation and state uncertainty. Analyze community-level themes, not personal worth or psychological profiles. Treat incidents as unverified leads for human review. Include supplied message links when useful. Give concise findings, evidence, limitations, and practical recommendations.' },
      { role: 'user', content: JSON.stringify({ question, topic_aggregates: topicResult.rows, recent_analyzed_messages: context }) }
    ] })
  });
  if (!response.ok) {
    console.error('Insights ask failed (' + response.status + '): ' + (await response.text()).slice(0, 400));
    return interaction.editReply('The AI request failed. Check OPENAI_INSIGHTS_MODEL, API key, and Railway logs.');
  }
  const data = await response.json();
  const answer = clean(extractOutputText(data), 3900);
  if (!answer) return interaction.editReply('The AI returned an empty answer. Please try again.');
  return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🧠 NRR Intelligence Analysis').setDescription(answer).setColor(0x5865f2).setFooter({ text: 'Based on collected data • Model: ' + MODEL }).setTimestamp()] });
}
async function report(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return interaction.editReply('OPENAI_API_KEY is missing in Railway variables.');
  const settings = await getSettings(interaction.guildId);
  if (!settings.enabled) return interaction.editReply('Run /insights setup first to choose channels.');
  const stats = await getStats(interaction.guildId);
  const topics = await db.query("SELECT topic, category, COUNT(*)::int AS count FROM insights_messages WHERE guild_id = $1 AND analyzed = TRUE AND created_at >= NOW() - INTERVAL '7 days' GROUP BY topic, category ORDER BY count DESC LIMIT 35", [interaction.guildId]);
  const recent = await db.query("SELECT channel_id, message_id, content, created_at, category, topic, summary FROM insights_messages WHERE guild_id = $1 AND analyzed = TRUE AND created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 60", [interaction.guildId]);
  const response = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({ model: MODEL, input: [
      { role: 'system', content: 'Write a concise useful weekly Discord community intelligence report. Only use supplied evidence. Separate facts from possible explanations. Do not invent causation. Potential incidents are unverified and require human review. Recommend practical next steps.' },
      { role: 'user', content: JSON.stringify({
        request: 'Summarize main topics, suggestions, concerns, activity, and potential incidents needing human review.',
        statistics: stats, topics: topics.rows,
        recent_messages: recent.rows.map(row => ({ channel: '<#' + row.channel_id + '>', text: row.content, created_at: row.created_at, category: row.category, topic: row.topic, summary: row.summary, link: 'https://discord.com/channels/' + interaction.guildId + '/' + row.channel_id + '/' + row.message_id }))
      }) }
    ] })
  });
  if (!response.ok) {
    console.error('Insights report failed (' + response.status + '): ' + (await response.text()).slice(0, 400));
    return interaction.editReply('The AI report failed. Check model/API configuration and Railway logs.');
  }
  const data = await response.json();
  return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📋 NRR Weekly Intelligence Report').setDescription(clean(extractOutputText(data), 3900) || 'Not enough analyzed data to create a report yet.').setColor(0x5865f2).setTimestamp()] });
}
async function onMessage(message) {
  if (!message.guild || message.author.bot || !message.content?.trim() || message.content.startsWith('/') || message.content.startsWith('!')) return;
  const settings = await getSettings(message.guild.id);
  if (!settings.enabled || !Array.isArray(settings.channel_ids) || !settings.channel_ids.includes(message.channel.id)) return;
  await db.query('INSERT INTO insights_messages (guild_id, channel_id, message_id, author_id, content, created_at, analyzed) VALUES ($1, $2, $3, $4, $5, $6, FALSE) ON CONFLICT (guild_id, message_id) DO NOTHING',
    [message.guild.id, message.channel.id, message.id, message.author.id, clean(message.content), message.createdAt]);
}
async function onMessageDelete(message) {
  if (!message.guild || !message.id) return;
  await db.query('DELETE FROM insights_messages WHERE guild_id = $1 AND message_id = $2', [message.guild.id, message.id]);
}
async function onMessageUpdate(oldMessage, newMessage) {
  if (!newMessage.guild || newMessage.author?.bot || !newMessage.id || !newMessage.content?.trim()) return;
  const settings = await getSettings(newMessage.guild.id);
  if (!settings.enabled || !Array.isArray(settings.channel_ids) || !settings.channel_ids.includes(newMessage.channel.id)) return;
  await db.query(
    'UPDATE insights_messages SET content = $3, analyzed = FALSE, topic = NULL, category = NULL, summary = NULL, confidence = 0, analyzed_at = NULL WHERE guild_id = $1 AND message_id = $2',
    [newMessage.guild.id, newMessage.id, clean(newMessage.content)]
  );
}
async function analyzeBatch() {
  if (processing || !clientRef || !process.env.OPENAI_API_KEY) return;
  processing = true;
  try {
    const pending = await db.query("SELECT m.guild_id, m.channel_id, m.message_id, m.content, m.created_at FROM insights_messages m JOIN insights_settings s ON s.guild_id = m.guild_id AND s.enabled = TRUE WHERE m.analyzed = FALSE AND m.created_at >= NOW() - INTERVAL '30 days' AND m.channel_id = ANY(SELECT jsonb_array_elements_text(s.channel_ids)) ORDER BY m.created_at ASC LIMIT 80", []);
    if (!pending.rows.length) return;
    const payload = pending.rows.map((row, index) => ({ index, channel_id: row.channel_id, text: row.content, timestamp: row.created_at }));
    const response = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: MODEL, input: [
        { role: 'system', content: 'Classify each Discord message. Output ONLY JSON: {"items":[{"index":0,"topic":"short neutral topic","category":"general|suggestion|complaint|potential_incident|question|event|other","summary":"brief factual summary","confidence":0.0}]}. Use reusable topic labels. Suggestion means a proposal; complaint means an expressed problem; potential_incident only for clear signs of escalating conflict, threat, harassment, or serious moderation concern. This is only a review flag, never a conclusion. Do not infer sensitive traits, mental health, motives, or personality. Use general/other when unclear. Confidence is 0..1.' },
        { role: 'user', content: JSON.stringify(payload) }
      ] })
    });
    if (!response.ok) throw new Error('AI classifier HTTP ' + response.status + ': ' + (await response.text()).slice(0, 300));
    const data = await response.json();
    const parsed = parseModelJson(extractOutputText(data));
    if (!Array.isArray(parsed.items)) throw new Error('AI classifier returned invalid JSON.');
    const byIndex = new Map(parsed.items.filter(item => Number.isInteger(item.index) && item.index >= 0 && item.index < pending.rows.length).map(item => [item.index, item]));
    const allowed = new Set(['general', 'suggestion', 'complaint', 'potential_incident', 'question', 'event', 'other']);
    for (let i = 0; i < pending.rows.length; i++) {
      const row = pending.rows[i];
      const item = byIndex.get(i) || { topic: 'Unclassified', category: 'other', summary: '', confidence: 0 };
      const category = allowed.has(item.category) ? item.category : 'other';
      await db.query('UPDATE insights_messages SET analyzed = TRUE, topic = $3, category = $4, summary = $5, confidence = $6, analyzed_at = NOW() WHERE guild_id = $1 AND message_id = $2',
        [row.guild_id, row.message_id, clean(item.topic, 120) || 'Unclassified', category, clean(item.summary, 400), Math.max(0, Math.min(1, Number(item.confidence) || 0))]);
    }
    console.log('Server Intelligence analyzed ' + pending.rows.length + ' messages.');
  } catch (error) {
    console.error('Server Intelligence batch analysis failed:', error);
  } finally {
    processing = false;
  }
}
async function cleanup() {
  try { await db.query("DELETE FROM insights_messages WHERE created_at < NOW() - INTERVAL '30 days'", []); }
  catch (error) { console.error('Server Intelligence retention cleanup failed:', error); }
}
function start(client) {
  clientRef = client;
  setInterval(() => analyzeBatch(), BATCH_INTERVAL_MS);
  setInterval(() => cleanup(), 24 * 60 * 60 * 1000);
  setTimeout(() => analyzeBatch(), 30_000);
  console.log('Server Intelligence initialized; AI batch analysis runs every 10 minutes for configured channels.');
}
async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'insights') {
    if (!isManager(interaction)) return interaction.reply({ content: 'Server Intelligence is restricted to members with Manage Server permission.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') return setup(interaction);
    if (sub === 'disable') return disable(interaction);
    if (sub === 'dashboard') return openDashboard(interaction);
    if (sub === 'ask') return ask(interaction);
    if (sub === 'report') return report(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('insights:view:')) {
    if (!isManager(interaction)) return interaction.reply({ content: 'You do not have permission to view Server Intelligence.', ephemeral: true });
    return renderView(interaction, interaction.customId.slice('insights:view:'.length));
  }
}
module.exports = { start, onMessage, onMessageDelete, onMessageUpdate, handleInteraction, dashboardEmbed, dashboardComponents, getSettings };
