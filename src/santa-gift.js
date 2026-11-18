const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { config } = require('./config');
const { hasPermission } = require('./access');
const { PermissionFlagsBits } = require('discord.js');

const GIFT_ICON_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f381.png';
const BOX_ICON_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f4e6.png';
const GIFT_ACCENT = 0xD42426;
const DEFAULT_GIFT_WEIGHT = 1000;
const GIFTS = [];

const command = new SlashCommandBuilder()
  .setName('santa_gift')
  .setDescription('See what Santa left for you.');

function buildOpeningEmbed(userId) {
  return new EmbedBuilder()
    .setColor(GIFT_ACCENT)
    .setTitle('🎅 Santa’s Gift Delivery')
    .setDescription('Ho ho ho! Santa stopped by for <@' + userId + '> and left something behind!')
    .setThumbnail(BOX_ICON_URL)
    .setFooter({ text: 'NRR • Santa’s Gift Delivery' });
}

function buildRevealedEmbed(gift) {
  const safeTitle = String(gift.title || 'Mystery Gift').replace(/\|\|/g, '││');
  return new EmbedBuilder()
    .setColor(GIFT_ACCENT)
    .setTitle('🎅 Santa’s Gift Delivery')
    .setDescription('🎁 **Unwrapped Item:**\n**' + safeTitle + '**')
    .setThumbnail(GIFT_ICON_URL)
    .setFooter({ text: 'NRR • Santa’s Gift Delivery' });
}

function buildGiftComponents(userId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('santa_gift:unwrap:' + userId)
        .setLabel('Unwrap Present')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
    )
  ];
}

async function chooseGift(guildId) {
  const db = require('./db');
  const giftBank = await db.getSantaGifts(guildId);
  if (!giftBank.length) return null;

  const totalWeight = giftBank.reduce((total, gift) => total + Number(gift.weight || DEFAULT_GIFT_WEIGHT), 0);
  let ticket = require('node:crypto').randomInt(totalWeight);
  for (const gift of giftBank) {
    ticket -= Number(gift.weight || DEFAULT_GIFT_WEIGHT);
    if (ticket < 0) return gift;
  }
  return giftBank[giftBank.length - 1];
}

async function handleCommand(interaction) {
  if (!interaction.inGuild() || !interaction.guildId || (config.guildId && interaction.guildId !== config.guildId)) {
    return interaction.reply({ content: '❌ Santa’s Gift Delivery can only be used inside NRR.', ephemeral: true });
  }

  const db = require('./db');
  const gifts = await db.getSantaGifts(interaction.guildId);
  if (!gifts.length) {
    return interaction.reply({
      content: '🎅 Santa’s gift bank is empty right now. Ask someone with Manage Server permission to add prizes using `!addgift Item Name`.',
      ephemeral: true,
    });
  }

  return interaction.reply({
    embeds: [buildOpeningEmbed(interaction.user.id)],
    components: buildGiftComponents(interaction.user.id),
    allowedMentions: { parse: [] },
  });
}

async function handleButton(interaction) {
  const match = interaction.customId.match(/^santa_gift:unwrap:(\d{17,20})$/);
  if (!match) return;

  const ownerId = match[1];
  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '🎁 This present belongs to someone else!',
      ephemeral: true,
    });
  }

  const gift = await chooseGift(interaction.guildId);
  if (!gift) {
    return interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(GIFT_ACCENT)
        .setTitle('🎅 Santa’s Gift Delivery')
        .setDescription('Santa checked the gift bank, but there is nothing inside just yet. Ask staff to add prizes with `!addgift Item Name`.')
        .setThumbnail(BOX_ICON_URL)
        .setFooter({ text: 'NRR • Santa’s Gift Delivery' })],
      components: [],
      allowedMentions: { parse: [] },
    });
  }

  return interaction.update({
    embeds: [buildRevealedEmbed(gift)],
    components: buildGiftComponents(ownerId, true),
    allowedMentions: { parse: [] },
  });
}

async function handlePrefixMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const match = message.content.match(/^!addgift(?:\s+([\s\S]*))?$/i);
  if (!match) return;

  if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageGuild)) {
    return message.reply({ content: '❌ You need Manage Server permission to add gifts.', allowedMentions: { parse: [] } });
  }

  const title = (match[1] || '').trim();
  if (!title) {
    return message.reply({ content: 'Usage: `!addgift Item Name`', allowedMentions: { parse: [] } });
  }
  if (title.length > 100) {
    return message.reply({ content: '❌ Gift names must be 100 characters or fewer.', allowedMentions: { parse: [] } });
  }

  try {
    const db = require('./db');
    await db.addSantaGift({
      guildId: message.guild.id,
      creatorId: message.author.id,
      title: title.replace(/\|\|/g, '││'),
      emoji: '🎁',
      description: '',
      weight: DEFAULT_GIFT_WEIGHT,
    });
    return message.reply({
      content: '🎁 **Added to Santa’s gift bank:** ' + title,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error('Santa gift add failed:', error);
    return message.reply({ content: '❌ I could not add that gift to the bank. Please try again.', allowedMentions: { parse: [] } });
  }
}

module.exports = {
  command,
  handleCommand,
  handleButton,
  handlePrefixMessage,
  GIFTS,
  DEFAULT_GIFT_WEIGHT,
  chooseGift,
  buildOpeningEmbed,
  buildRevealedEmbed,
  buildGiftComponents,
};
