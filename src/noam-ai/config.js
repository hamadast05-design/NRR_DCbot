const config = {
  enabled: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
  apiKey: process.env.OPENAI_API_KEY || null,
  model: process.env.OPENAI_MODEL || null,
  guildId: process.env.DISCORD_GUILD_ID || null,
  channelId: process.env.NOAM_AI_CHANNEL_ID || '1572013456092045423',
  avatarUrl: process.env.NOAM_AI_AVATAR_URL || 'https://cdn.imageurlgenerator.com/uploads/9835b4aa-ea4b-4a13-97a8-254f69c2c4e5.png',
  displayName: process.env.NOAM_AI_DISPLAY_NAME || 'Noam (AI)',
  noamUserIds: (process.env.NOAM_AI_USER_IDS || '830865461021114438,1356667738516357416,1262610664795537503')
    .split(',').map(value => value.trim()).filter(Boolean),
  lookbackDays: 365,
  cooldownMs: 7000,
  maxOutputTokens: 450,
  historyLimit: 8,
  collectionNoticeAcknowledged: process.env.NOAM_COLLECTION_NOTICE_ACKNOWLEDGED === 'true',
  collectionEnabled: process.env.NOAM_COLLECTION_ENABLED === 'true',
};
module.exports = { config };
