const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const { config, validate } = require('./config');
const db = require('./db');
const { handleInteraction } = require('./commands');
const eventSystem = require('./event');
const annihilateSystem = require('./annihilate');
const wordkillSystem = require('./wordkill');
const newsSystem = require('./news');
const insightsSystem = require('./insights');

validate();

async function registerApplicationCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  const commandList = require('./commands').commands;
  console.log(`Registering ${commandList.length} application commands...`);
  await rest.put(route, { body: commandList.map(command => command.toJSON()) });
  console.log('Application commands registered successfully.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerApplicationCommands();
    await db.migrate();
    console.log('Database migrations ready.');

    setInterval(() => eventSystem.autoApprove(readyClient).catch(error => console.error('Event auto-approval failed:', error)), 30 * 1000);
    newsSystem.start(readyClient);
    insightsSystem.start(readyClient);

    for (const guild of readyClient.guilds.cache.values()) {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (!member.user.bot || config.allowBotTargets) {
          await db.ensureMember(guild.id, member.id, true);
        }
      }
      console.log(`Synced ${members.size} members for ${guild.name}.`);
    }
  } catch (error) {
    console.error('Startup database sync failed:', error);
  }
});

client.on(Events.GuildMemberAdd, async member => {
  if (!member.user.bot || config.allowBotTargets) {
    await db.setMemberActive(member.guild.id, member.id, true).catch(error => console.error('Member add sync failed:', error));
  }
});

client.on(Events.GuildMemberRemove, async member => {
  await db.setMemberActive(member.guild.id, member.id, false).catch(error => console.error('Member remove sync failed:', error));
});

client.on(Events.MessageCreate, async message => {
  try { await wordkillSystem.onMessage(message); } catch (error) { console.error('WordKill message error:', error); }
  try { await insightsSystem.onMessage(message); } catch (error) { console.error('Server Intelligence message error:', error); }
  try { await eventSystem.onMessage(message); } catch (error) { console.error('Event stick error:', error); }
  try { await annihilateSystem.onMessage(message); } catch (error) { console.error('Annihilate message error:', error); }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('Interaction error:', error);
    const payload = { content: '❌ Something went wrong while processing that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

client.login(config.token);
