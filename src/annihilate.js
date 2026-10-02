const { PermissionFlagsBits, WebhookClient } = require('discord.js');
const db = require('./db');

const TIMEOUT_MS = 10 * 60 * 1000;

function parseMention(content) {
  return content.trim().match(/^<@!?([0-9]+)>$/)?.[1] || null;
}

async function hasModerationPermission(message) {
  return message.guild && message.member?.permissions?.has(PermissionFlagsBits.ModerateMembers);
}

async function annihilate(message) {
  if (!message.guild || message.author.bot) return;
  if (!message.content.toLowerCase().startsWith('!annihilate')) return false;
  const userId = parseMention(message.content.slice('!annihilate'.length));
  if (!userId) { await message.delete().catch(() => {}); return true; }
  if (!(await hasModerationPermission(message))) { await message.delete().catch(() => {}); return true; }
  if (userId === message.author.id) { await message.delete().catch(() => {}); return true; }

  const target = await message.guild.members.fetch(userId).catch(() => null);
  if (!target || target.user.bot) { await message.delete().catch(() => {}); return true; }
  const botMember = message.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ModerateMembers) || !target.moderatable) { await message.delete().catch(() => {}); return true; }
  const channel = message.channel;
  if (!channel.isTextBased() || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageWebhooks)) { await message.delete().catch(() => {}); return true; }
  if (await db.getAnnihilateByTarget(message.guild.id, target.id) || await db.getAnnihilateByRunner(message.guild.id, message.author.id)) { await message.delete().catch(() => {}); return true; }

  let webhook;
  try {
    await target.timeout(TIMEOUT_MS, 'Annihilate prank');
    webhook = await channel.createWebhook({
      name: target.user.username,
      avatar: target.user.displayAvatarURL({ extension: 'png', size: 256 }),
      reason: 'Annihilate prank session',
    });
    await db.createAnnihilateSession({ guildId: message.guild.id, targetId: target.id, runnerId: message.author.id, channelId: channel.id, webhookId: webhook.id, webhookToken: webhook.token });
    await message.author.send('💀 **Annihilate session active.**\nAnything you send in this DM will be sent into the server through the webhook as the mentioned user.\n\nUse `!release @user` in the server to end the session and remove their timeout.');
  } catch (error) {
    console.error('Annihilate setup failed:', error);
    if (webhook) await webhook.delete().catch(() => {});
    await target.timeout(null, 'Annihilate setup failed').catch(() => {});
  }
  await message.delete().catch(() => {});
  return true;
}

async function release(message) {
  if (!message.guild || message.author.bot) return false;
  if (!message.content.toLowerCase().startsWith('!release')) return false;
  const userId = parseMention(message.content.slice('!release'.length));
  if (!userId) { await message.delete().catch(() => {}); return true; }
  if (!(await hasModerationPermission(message))) { await message.delete().catch(() => {}); return true; }
  const session = await db.getAnnihilateByTarget(message.guild.id, userId);
  if (!session) { await message.delete().catch(() => {}); return true; }
  const target = await message.guild.members.fetch(userId).catch(() => null);
  if (target) await target.timeout(null, 'Annihilate released').catch(() => {});
  await db.endAnnihilateSession(session.id);
  await message.delete().catch(() => {});
  return true;
}

async function onMessage(message) {
  if (message.author.bot) return;
  if (message.guild) {
    if (message.content.toLowerCase().startsWith('!annihilate')) return annihilate(message);
    if (message.content.toLowerCase().startsWith('!release')) return release(message);
    return false;
  }
  const sessions = await db.getAnnihilateByRunnerGlobal(message.author.id);
  if (!sessions.length) return false;
  const session = sessions[0];
  const webhook = new WebhookClient({ id: session.webhook_id, token: session.webhook_token });
  try {
    const files = [...message.attachments.values()].map(a => ({ attachment: a.url, name: a.name || 'attachment' }));
    await webhook.send({ content: message.content || undefined, files: files.length ? files : undefined, allowedMentions: { parse: [] } });
  } catch (error) { console.error('Annihilate relay failed:', error); }
  finally { webhook.destroy(); }
  return true;
}

module.exports = { onMessage };