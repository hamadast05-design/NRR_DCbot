const { Client, GatewayIntentBits, Events, PermissionFlagsBits, ActivityType } = require('discord.js');
const { config, validate } = require('./config');
const db = require('./db');
const { handleInteraction, handlePrefixMute } = require('./commands');
const gamePanel = require('./game-panel');
const { handlePrefixRoleCommands } = require('./hoster-role-commands');
const { hasPermission } = require('./access');
const eventSystem = require('./event');
const annihilateSystem = require('./annihilate');
const wordkillSystem = require('./wordkill');
const politicalTriviaSystem = require('./political-trivia');
const geographyTriviaSystem = require('./geography-trivia');
const guessPoliticianSystem = require('./guess-the-politician');
const flagRushSystem = require('./flagrush');
const mysteryGenSystem = require('./mysterygen');
const chessPuzzleSystem = require('./chess-puzzle');
const learningGames = require('./learning-games');
const newsSystem = require('./news');
const qotdSystem = require('./qotd');
const chatRevivalSystem = require('./chat-revival');
const automationControl = require('./automation-control');
const gameRotationSystem = require('./game-rotation');
const staffAnalytics = require('./staff-analytics');
const staffRanking = require('./staff-ranking');
const boosterPerks = require('./booster-perks');
const { registerApplicationCommands } = require('./command-registration');

validate();


const WORK_REMINDER_CHANNEL_ID = '1570764802651983962';
const WORK_REMINDER_USER_ID = '823983272614559766';
let workReminderInterval = null;

async function sendWorkReminder(readyClient) {
  try {
    const channel = await readyClient.channels.fetch(WORK_REMINDER_CHANNEL_ID);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
      console.error('Work reminder channel is unavailable or is not a sendable text channel.');
      return;
    }
    await channel.send({
      content: `<@${WORK_REMINDER_USER_ID}> GET BACK TO WORK`,
      allowedMentions: { parse: [], users: [WORK_REMINDER_USER_ID] }
    });
  } catch (error) {
    console.error('Work reminder failed:', error);
  }
}

function startWorkReminder(readyClient) {
  if (workReminderInterval) clearInterval(workReminderInterval);
  workReminderInterval = setInterval(() => {
    void sendWorkReminder(readyClient);
  }, 60 * 1000);
  console.log('Work reminder started (every 60 seconds).');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions],
});

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startWorkReminder(readyClient);
  readyClient.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Initiating Orbital Strike on NR3.. 🚀',
        type: ActivityType.Playing
      },
      {
        name: 'Custom Status',
        type: ActivityType.Custom,
        state: 'PLAY /STEAL_OR_NOSTEAL RIGHT NOW IN NRR!'
      }
    ]
  });
  try {
    await registerApplicationCommands();
    await db.migrate();
    await boosterPerks.migrate();
    await staffAnalytics.migrate();
    await staffRanking.startScheduler(readyClient);
    await qotdSystem.migrate();
    console.log('Database migrations ready.');
    const boosterGuild = readyClient.guilds.cache.get(config.boosterGuildId || config.guildId);
    if (boosterGuild) {
      setInterval(() => boosterPerks.retryCleanup(boosterGuild).catch(error => console.error('Booster asset cleanup retry failed:', error)), 5 * 60 * 1000);
      console.log('NRR Booster Perks session sync scheduled.');
    } else {
      console.warn('NRR Booster Perks are disabled: set BOOSTER_PERKS_GUILD_ID or DISCORD_GUILD_ID to the NRR server ID.');
    }
    await staffAnalytics.backfillAuditLogs(readyClient);
    setInterval(() => staffAnalytics.backfillAuditLogs(readyClient).catch(error => console.error('Punishment audit scan failed:', error)), 10 * 60 * 1000);

    setInterval(() => eventSystem.autoApprove(readyClient).catch(error => console.error('Event auto-approval failed:', error)), 30 * 1000);
    newsSystem.start(readyClient);
    // Temporarily disabled by administrator request: no Chat Revival or automatic game-invitation messages.
    console.log('Chat Revival and automatic game invitations are disabled.');

    for (const guild of readyClient.guilds.cache.values()) {
      const members = await guild.members.fetch();
      if (boosterGuild && guild.id === boosterGuild.id) await boosterPerks.syncGuild(guild, members);
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

async function handleWorkReminderControl(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  if (message.channelId !== WORK_REMINDER_CHANNEL_ID || message.content.trim().toLowerCase() !== '!stopping') return;

  if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageGuild)) {
    await message.reply({
      content: '❌ You need the Manage Server permission to stop the work reminder.',
      allowedMentions: { parse: [] }
    }).catch(() => {});
    return;
  }

  if (!workReminderInterval) {
    await message.reply({
      content: 'ℹ️ The work reminder is already stopped.',
      allowedMentions: { parse: [] }
    }).catch(() => {});
    return;
  }

  clearInterval(workReminderInterval);
  workReminderInterval = null;
  await message.reply({
    content: '⏹️ Work reminder stopped.',
    allowedMentions: { parse: [] }
  }).catch(() => {});
}

async function handleAutomationControlMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const command = message.content.trim().toLowerCase();
  if (command !== '!stopic' && command !== '!openic') return;

  if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageGuild)) {
    await message.reply({
      content: '❌ You need the Manage Server permission to control Chat Revival and automatic game invitations.',
      allowedMentions: { parse: [] }
    }).catch(() => {});
    return;
  }

  if (command === '!stopic') {
    const result = automationControl.stop();
    gameRotationSystem.pauseInvitations();
    await message.reply({
      content: result.changed
        ? '⏸️ Chat Revival and automatic game invitations are now paused.'
        : 'ℹ️ Chat Revival and automatic game invitations are already paused.',
      allowedMentions: { parse: [] }
    }).catch(() => {});
    return;
  }

  const result = automationControl.open();
  await message.reply({
    content: result.changed
      ? '▶️ Chat Revival and automatic game invitations are now active again.'
      : 'ℹ️ Chat Revival and automatic game invitations are already active.',
    allowedMentions: { parse: [] }
  }).catch(() => {});
}

client.on(Events.GuildMemberAdd, async member => {
  if (!member.user.bot || config.allowBotTargets) {
    await db.setMemberActive(member.guild.id, member.id, true).catch(error => console.error('Member add sync failed:', error));
  }
});

client.on(Events.GuildMemberRemove, async member => {
  await db.setMemberActive(member.guild.id, member.id, false).catch(error => console.error('Member remove sync failed:', error));
  await boosterPerks.onMemberRemove(member).catch(error => console.error('Booster perk member cleanup failed:', error));
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  await boosterPerks.onMemberUpdate(oldMember, newMember).catch(error => console.error('Booster perk boost-session update failed:', error));
});

client.on(Events.MessageDelete, async message => {
  // Chat Revival is intentionally disabled; do not trigger message deletion/revival logic.
});

client.on(Events.MessageCreate, async message => {
  // Keep the NR3 Bot from posting in the NRR staff reminder channel.
  if (message.channelId === WORK_REMINDER_CHANNEL_ID && message.author.id === '1563975512240689272') {
    await message.delete().catch(error => console.error('Could not remove NR3 Bot message:', error));
    return;
  }
  try { await handleWorkReminderControl(message); } catch (error) { console.error('Work reminder control failed:', error); }
  try { await handlePrefixMute(message); } catch (error) { console.error('Prefix mute command failed:', error); }
  try { await gamePanel.handleStopMessage(message); } catch (error) { console.error('Game Panel !stop command failed:', error); }
  try { await staffRanking.handlePrefixMessage(message); } catch (error) { console.error('Staff ranking prefix command failed:', error); }
  try { await staffRanking.handleDiagnosticsMessage(message); } catch (error) { console.error('Staff ranking diagnostics command failed:', error); }
  if (message.guild && !message.author.bot && !message.webhookId) {
    const raw = message.content.trim();
    if (/^!send_news$/i.test(raw)) { if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ You need Manage Server permission to send manual news.'); try { await newsSystem.sendLatest(client, message); } catch (error) { console.error('Manual news command failed:', error); await message.reply('❌ I could not fetch or post a news story right now.'); } }
    else if (/^!send_qotd$/i.test(raw)) { try { await qotdSystem.sendPanel(message); } catch (error) { console.error('QOTD panel command failed:', error); await message.reply('❌ I could not post the QOTD submission panel.'); } }
    else if (/^!set_qotd_channel\s+/i.test(raw)) { try { await qotdSystem.setChannel(message, raw.split(/\s+/)[1]); } catch (error) { console.error('QOTD channel setup failed:', error); await message.reply('❌ I could not update the QOTD channel.'); } }
    else if (/^!reveal$/i.test(raw)) { try { await mysteryGenSystem.revealCommand(message); } catch (error) { console.error('MysteryGen reveal command failed:', error); await message.reply('I could not reveal the current MysteryGen item.').catch(() => {}); } }
  }
  try { await handlePrefixRoleCommands(message); } catch (error) { console.error('Hoster Manager role command failed:', error); }
  // Automation controls remain inactive while Chat Revival and game invitations are paused.
  // Chat Revival is intentionally disabled; no revival prompts should be sent.
  try { await staffAnalytics.onMessage(message); } catch (error) { console.error('Staff activity tracking failed:', error); }
  try { await learningGames.onMessage(message); } catch (error) { console.error('Learning game message error:', error); }
  try { await wordkillSystem.onMessage(message); } catch (error) { console.error('WordKill message error:', error); }
  try { await politicalTriviaSystem.onMessage(message); } catch (error) { console.error('Political Trivia message error:', error); }
  try { await geographyTriviaSystem.onMessage(message); } catch (error) { console.error('Geography Trivia message error:', error); }
  try { await guessPoliticianSystem.onMessage(message); } catch (error) { console.error('Guess The Politician message error:', error); }
  try { await flagRushSystem.onMessage(message); } catch (error) { console.error('FlagRush message error:', error); }
  try { await mysteryGenSystem.onMessage(message); } catch (error) { console.error('MysteryGen message error:', error); }
  try { await chessPuzzleSystem.onMessage(message); } catch (error) { console.error('Chess Puzzle message error:', error); }
  try { await eventSystem.onMessage(message); } catch (error) { console.error('Event stick error:', error); }
  try { await annihilateSystem.onMessage(message); } catch (error) { console.error('Annihilate message error:', error); }
});


client.on(Events.GuildBanAdd, async ban => {
  try { const logs = await ban.guild.fetchAuditLogs({ type: require('discord.js').AuditLogEvent.MemberBanAdd, limit: 5 }); for (const entry of logs.entries.values()) { if (entry.target?.id === ban.user.id && Date.now() - entry.createdTimestamp < 15000) await staffAnalytics.recordAudit(ban.guild, entry); } } catch (error) { console.error('Ban audit capture failed:', error); }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try { await gameRotationSystem.onReactionAdd(reaction, user); } catch (error) { console.error('Automatic game reaction error:', error); }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('mysterygen:')) return await mysteryGenSystem.onButton(interaction);
    if (interaction.isButton() && interaction.customId.startsWith('qotd:')) return await qotdSystem.onButton(interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith('qotd:')) return await qotdSystem.onModal(interaction);
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
