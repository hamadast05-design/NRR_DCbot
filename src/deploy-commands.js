const { config, validate } = require('./config');
const { registerApplicationCommands } = require('./command-registration');

validate();

registerApplicationCommands().catch(error => {
  console.error('Failed to register application commands:', error);
  process.exitCode = 1;
});
