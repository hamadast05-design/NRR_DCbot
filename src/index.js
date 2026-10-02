const { Client, GatewayIntentBits, Events } = require('discord.js');
const { config, validate } = require('./config');
const db = require('./db');
const { handleInteraction } = require('./commands');

validate();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await db.migrate();
    console.log('Database migrations ready.');

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
