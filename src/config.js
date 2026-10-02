require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || null,
  cooldownMs: Math.max(1, Number(process.env.REPUTATION_COOLDOWN_HOURS || 24)) * 60 * 60 * 1000,
  allowBotTargets: bool(process.env.ALLOW_BOT_TARGETS, false),
  showDeparted: bool(process.env.SHOW_DEPARTED_ON_LEADERBOARDS, false),
  publicEvents: bool(process.env.PUBLIC_REPUTATION_EVENTS, false),
  logChannelId: process.env.REPUTATION_LOG_CHANNEL_ID || null,
  adminPermission: process.env.ADMIN_PERMISSION || 'ManageGuild',
};

function validate() {
  if (!config.token) throw new Error('DISCORD_TOKEN is required.');
  if (!config.clientId) throw new Error('DISCORD_CLIENT_ID is required.');
}

module.exports = { config, validate };
