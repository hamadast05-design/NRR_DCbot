const { REST, Routes } = require('discord.js');
const { config, validate } = require('./config');
const { commands } = require('./commands');

validate();

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log(`Registering ${commands.length} application commands...`);
    const route = config.guildId
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);
    await rest.put(route, { body: commands.map(command => command.toJSON()) });
    console.log('Application commands registered successfully.');
  } catch (error) {
    console.error('Failed to register application commands:', error);
    process.exitCode = 1;
  }
})();
