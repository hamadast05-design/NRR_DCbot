const { randomInt } = require('node:crypto');
const { SlashCommandBuilder } = require('discord.js');
const { config } = require('./config');

const GIFTS = [
  { id: 'golden-surprise', category: 'golden', weight: 500, emoji: '🌟', title: 'The Golden Surprise', description: 'Santa reached into the very bottom of his sack and found something extraordinary. You have officially made the nice list!' },
  { id: 'chocolates', category: 'ordinary', weight: 1000, emoji: '🍫', title: 'A Box of Chocolates', description: 'A delicious little Christmas treat. Santa says sharing is optional.' },
  { id: 'mystery-envelope', category: 'ordinary', weight: 1000, emoji: '✉️', title: 'A Mysterious Envelope', description: 'There is absolutely nothing suspicious about this envelope. Santa insists you do not ask questions.' },
  { id: 'festive-greeting', category: 'ordinary', weight: 1000, emoji: '💌', title: 'A Festive Greeting', description: 'Santa sent you his warmest wishes and a reminder to enjoy the season.' },
  { id: 'golden-bell', category: 'ordinary', weight: 1000, emoji: '🔔', title: 'A Golden Bell', description: 'A tiny golden bell. It makes a very satisfying jingle.' },
  { id: 'snow-globe', category: 'ordinary', weight: 1000, emoji: '❄️', title: 'A Tiny Snow Globe', description: 'A little winter wonderland, delivered straight from Santa’s sack.' },
  { id: 'candy-cane', category: 'ordinary', weight: 1000, emoji: '🍬', title: 'A Suspiciously Large Candy Cane', description: 'It is enormous. Santa refuses to explain why.' },
  { id: 'wrapped-present', category: 'ordinary', weight: 1000, emoji: '🎁', title: 'A Beautiful Present', description: 'A neatly wrapped Christmas present. Whatever is inside, Santa picked it just for you.' },
  { id: 'lump-of-coal', category: 'naughty', weight: 625, emoji: '🪨', title: 'A Lump of Coal', description: 'Santa checked the list twice. Apparently, this is what happens when you are on the naughty list. 💀' },
  { id: 'empty-box', category: 'naughty', weight: 625, emoji: '📦', title: 'An Empty Gift Box', description: 'The wrapping is beautiful. The contents are... missing. Santa may have forgotten something.' },
  { id: 'christmas-potato', category: 'naughty', weight: 625, emoji: '🥔', title: 'A Christmas Potato', description: 'A potato. Wrapped with care. Santa says it is a limited edition.' },
  { id: 'forgotten-gift', category: 'naughty', weight: 625, emoji: '🤷', title: 'Santa Forgot Your Gift', description: 'Santa has checked the sack, the sleigh and his list. He has absolutely no idea where your present went.' },
];

const TOTAL_WEIGHT = GIFTS.reduce((total, gift) => total + gift.weight, 0);
const command = new SlashCommandBuilder()
  .setName('santa_gift')
  .setDescription('See what Santa brought you in a festive mystery gift.');

function chooseGift() {
  let ticket = randomInt(TOTAL_WEIGHT);
  for (const gift of GIFTS) {
    ticket -= gift.weight;
    if (ticket < 0) return gift;
  }
  return GIFTS[GIFTS.length - 1];
}

function buildGiftMessage(userId, gift) {
  const headings = {
    golden: '🌟 SANTA BROUGHT YOU A GOLDEN SURPRISE!',
    ordinary: '🎁 SANTA HAS A PRESENT FOR YOU!',
    naughty: '💀 SANTA HAS CHECKED THE LIST...',
  };
  const reveal = '||' + gift.emoji + ' **' + gift.title + '**\n' + gift.description + '||';
  return [
    '# 🎅 Santa’s Gift Delivery',
    'Ho ho ho! Santa has arrived for <@' + userId + '>, and he has something in his sack!',
    '||Click the spoiler below to reveal your gift!||',
    '## ' + headings[gift.category],
    reveal,
    '-# A purely cosmetic NRR seasonal surprise. No coins, roles, inventory or member data are changed.',
    '-# NRR • Santa’s Gift Delivery',
  ].join('\n');
}

async function handleCommand(interaction) {
  if (!interaction.inGuild() || !interaction.guildId || (config.guildId && interaction.guildId !== config.guildId)) {
    return interaction.reply({ content: '❌ Santa’s Gift Delivery can only be used inside NRR.', ephemeral: true });
  }
  return interaction.reply({
    content: buildGiftMessage(interaction.user.id, chooseGift()),
    allowedMentions: { parse: [] },
  });
}

module.exports = { command, handleCommand, GIFTS, TOTAL_WEIGHT, chooseGift, buildGiftMessage };
