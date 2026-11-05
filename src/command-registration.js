const { REST, Routes } = require('discord.js');
const { config } = require('./config');
const db = require('./db');
const { commands, staffRankingCommand } = require('./commands');

async function backupGuildCommands(rest, route, guildId) {
  const current = await rest.get(route);
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_command_registration_backups (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      commands JSONB NOT NULL
    )
  `);
  await db.query(
    'INSERT INTO nrr_command_registration_backups(guild_id, commands) VALUES($1, $2::jsonb)',
    [guildId, JSON.stringify(current)]
  );
  await db.query(`
    DELETE FROM nrr_command_registration_backups
    WHERE guild_id = $1 AND id NOT IN (
      SELECT id FROM nrr_command_registration_backups
      WHERE guild_id = $1 ORDER BY captured_at DESC, id DESC LIMIT 5
    )
  `, [guildId]);
  console.log(`Saved a backup of ${current.length} currently registered commands for guild ${guildId}.`);
}

async function registerApplicationCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const communityRoute = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  const communityPayload = commands.map(command => command.toJSON());

  if (!config.staffGuildId && config.staffRankingChannelId) {
    const rankingChannel = await rest.get(Routes.channel(config.staffRankingChannelId));
    config.staffGuildId = rankingChannel.guild_id || null;
    if (!config.staffGuildId) throw new Error('Could not resolve STAFF_GUILD_ID from STAFF_RANKING_CHANNEL_ID.');
  }
  if (config.staffGuildId && config.staffGuildId === config.guildId) {
    throw new Error('STAFF_GUILD_ID must be different from DISCORD_GUILD_ID.');
  }

  if (config.guildId) {
    // Snapshot the actual live Community Server command list before replacing it.
    await backupGuildCommands(rest, communityRoute, config.guildId);
  }
  console.log(`Registering ${communityPayload.length} Community Server application commands...`);
  await rest.put(communityRoute, { body: communityPayload });
  console.log('Community Server application commands registered successfully.');

  if (config.staffGuildId) {
    const staffRoute = Routes.applicationGuildCommands(config.clientId, config.staffGuildId);
    console.log('Registering only /staff_ranking in the Staff Server...');
    await rest.put(staffRoute, { body: [staffRankingCommand.toJSON()] });
    console.log('Staff Server /staff_ranking command registered successfully.');
  } else {
    console.warn('STAFF_GUILD_ID is not configured; skipping Staff Server command registration.');
  }
}

module.exports = { registerApplicationCommands };
