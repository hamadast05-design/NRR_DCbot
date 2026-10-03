require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function positiveNumber(value, fallback, minimum = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum ? number : fallback;
}

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || null,
  cooldownMs: positiveNumber(process.env.REPUTATION_COOLDOWN_MINUTES, 5) * 60 * 1000,
  allowBotTargets: bool(process.env.ALLOW_BOT_TARGETS, false),
  showDeparted: bool(process.env.SHOW_DEPARTED_ON_LEADERBOARDS, false),
  publicEvents: bool(process.env.PUBLIC_REPUTATION_EVENTS, false),
  logChannelId: process.env.REPUTATION_LOG_CHANNEL_ID || null,
  adminPermission: process.env.ADMIN_PERMISSION || 'ManageGuild',
  eventManagerRoleIds: (process.env.EVENT_MANAGER_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean),
  eventReviewChannelId: process.env.EVENT_REVIEW_CHANNEL_ID || '1555568788492259359',
  eventStickEnabled: bool(process.env.EVENT_STICK_ENABLED, true),
};

function validate() {
  if (!config.token) throw new Error('DISCORD_TOKEN is required.');
  if (!config.clientId) throw new Error('DISCORD_CLIENT_ID is required.');
}

module.exports = { config, validate };
