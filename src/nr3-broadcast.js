const { PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('./access');

const CHANNEL_ID = '1523792685478051892';

const ANNOUNCEMENT = `Hello everyone, concerned General Manager here. Recently I've noticed that the NR3 staff team has developed some serious behavioural problems. Usually I wouldn't mind since most of them can operate a paint bucket without adult supervision, but lately I've started questioning whether recruiting people directly from a kindergarten was a good idea.

Yesterday I asked a moderator why he'd banned someone. He told me the player had painted France yellow without permission and was clearly planning a coup. When I asked for evidence, he sent me a screenshot of a yellow pixel and said "look closely."

Whenever I post an announcement, 20 moderators instantly react with a checkmark. However, when I ask what it says, they suddenly develop severe reading disabilities. One moderator asked me what NR3 stood for. He's been working here for eight months.

At 3 AM, a Junior Moderator sent me 27 DMs asking whether painting Austria was considered reviving the Third Reich. When I told him no, he accused me of supporting war crimes and threatened to report the entire management team to the United Nations.

Yesterday I caught a Trial Moderator screaming "STOP RESISTING" at a player who was painting Luxembourg.

Another moderator has started introducing himself at school as "Supreme manager of  NR3." Apparently, he threatened to permanently ban his geography teacher for drawing the borders of Germany incorrectly.

Please help. 17 moderators have declared independence from NR3 and established the People's Republic of Staff General. They're demanding full control over the paint bucket and my immediate resignation. Their president is a Trial Moderator who joined yesterday and still doesn't know how to select a colour.`;

async function sendAnnouncement(client) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel?.isTextBased() || typeof channel.send !== 'function') {
    throw new Error('NR3 broadcast destination is unavailable or is not a text channel.');
  }
  return channel.send({ content: ANNOUNCEMENT, allowedMentions: { parse: [] } });
}

async function handlePrefixMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return false;
  if (message.channelId !== CHANNEL_ID || !/^!sendnr3$/i.test(message.content.trim())) return false;

  if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageGuild, message.member)) {
    await message.delete().catch(() => {});
    await message.channel.send({
      content: '❌ You need Manage Server permission to send the NR3 broadcast.',
      allowedMentions: { parse: [] }
    });
    return true;
  }

  await message.delete().catch(error => console.warn('[NR3 Broadcast] Could not delete manual command:', error.message));
  try {
    await sendAnnouncement(message.client);
  } catch (error) {
    console.error('[NR3 Broadcast] Manual send failed:', error);
    await message.channel.send({
      content: '❌ I could not send the NR3 broadcast. Please check the bot permissions.',
      allowedMentions: { parse: [] }
    }).catch(() => {});
  }
  return true;
}

module.exports = { handlePrefixMessage, sendAnnouncement };
