const { EmbedBuilder } = require('discord.js');
const questionBank = require('./political-trivia-questions');

const games = new Map();
const ROUND_TIMEOUT_MS = 30_000;
const NORMAL_COOLDOWN_MS = 6_000;
const MILESTONE_COOLDOWN_MS = 10_000;

function clearTimers(game) {
  if (game.timeout) clearTimeout(game.timeout);
  if (game.cooldown) clearTimeout(game.cooldown);
  game.timeout = null;
  game.cooldown = null;
}

function getGame(channelId) {
  const game = games.get(channelId);
  return game && game.active ? game : null;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chooseQuestion(game) {
  if (!questionBank.length) throw new Error('Political Trivia question bank is empty.');
  if (game.usedQuestions.size >= questionBank.length) game.usedQuestions.clear();
  let index;
  do {
    index = Math.floor(Math.random() * questionBank.length);
  } while (game.usedQuestions.has(index) && game.usedQuestions.size < questionBank.length);
  game.usedQuestions.add(index);
  return questionBank[index];
}

function questionEmbed(game) {
  return new EmbedBuilder()
    .setTitle('🌍 Political Trivia')
    .setDescription(game.current.question)
    .addFields({ name: 'Category', value: game.current.category, inline: true })
    .setColor(0x3498db)
    .setFooter({ text: 'First correct answer wins • 30 seconds • Round ' + (game.question_counter + 1) });
}

function leaderboardEmbed(game) {
  const ranked = [...game.points.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = ranked.length
    ? ranked.map(([userId, points], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';
        return medal + ' <@' + userId + '> — **' + points + ' ' + (points === 1 ? 'point' : 'points') + '**';
      }).join('\n')
    : 'No points yet.';
  return new EmbedBuilder()
    .setTitle('🏆 Political Trivia Leaderboard')
    .setDescription(lines)
    .setColor(0xf1c40f)
    .setFooter({ text: 'After ' + game.question_counter + ' successful answers' });
}

function createGame(channelId) {
  const game = {
    active: true,
    current: null,
    question_counter: 0,
    points: new Map(),
    usedQuestions: new Set(),
    timeout: null,
    cooldown: null,
  };
  games.set(channelId, game);
  return game;
}

async function sendQuestion(channel, game) {
  if (!game.active || games.get(channel.id) !== game) return;
  game.current = chooseQuestion(game);
  await channel.send({ embeds: [questionEmbed(game)] });
  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = setTimeout(async () => {
    if (!game.active || games.get(channel.id) !== game || !game.current) return;
    const answer = game.current.answers[0];
    game.timeout = null;
    game.current = null;
    await channel.send('⏰ Time\'s up! The correct answer was **' + answer + '**.').catch(() => {});
    game.cooldown = setTimeout(() => {
      game.cooldown = null;
      sendQuestion(channel, game).catch(error => console.error('Political Trivia next round error:', error));
    }, NORMAL_COOLDOWN_MS);
  }, ROUND_TIMEOUT_MS);
}

async function start(channel) {
  if (!channel?.isTextBased()) return { ok: false, message: '❌ Political Trivia can only be started in a text channel.' };
  if (getGame(channel.id)) return { ok: false, message: '❌ Political Trivia is already active in this channel.' };
  const game = createGame(channel.id);
  try {
    await channel.send('🌍 **Political Trivia has started!** First correct answer wins. You have 30 seconds per question.');
    await sendQuestion(channel, game);
    return { ok: true };
  } catch (error) {
    game.active = false;
    clearTimers(game);
    games.delete(channel.id);
    throw error;
  }
}

async function stop(channel) {
  if (!getGame(channel.id)) return false;
  const game = games.get(channel.id);
  game.active = false;
  clearTimers(game);
  games.delete(channel.id);
  await channel.send('🛑 **Political Trivia has ended.**').catch(() => {});
  return true;
}

async function skip(channel, game) {
  if (!game || !game.current || game.cooldown) return false;
  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = null;
  const answer = game.current.answers[0];
  game.current = null;
  await channel.send('⏭️ Political Trivia skipped. The answer was **' + answer + '**. No points awarded.');
  game.cooldown = setTimeout(() => {
    game.cooldown = null;
    sendQuestion(channel, game).catch(error => console.error('Political Trivia skipped round error:', error));
  }, NORMAL_COOLDOWN_MS);
  return true;
}

async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game = getGame(message.channel.id);
  if (!game) return;

  if (message.content.trim().toLowerCase() === '!skipp') {
    const skipped = await skip(message.channel, game);
    if (!skipped) await message.reply('⏳ There is no active Political Trivia question to skip right now.').catch(() => {});
    return;
  }

  if (!game.current || game.cooldown) return;
  const guess = normalize(message.content);
  if (!guess) return;
  const accepted = game.current.answers.some(answer => normalize(answer) === guess);
  if (!accepted) return;

  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = null;
  game.current = null;
  const userId = message.author.id;
  game.points.set(userId, (game.points.get(userId) || 0) + 1);
  game.question_counter += 1;

  await message.channel.send('✅ ' + message.author + ' got it right! **+1 point**.');
  const milestone = game.question_counter % 5 === 0;
  if (milestone) await message.channel.send({ embeds: [leaderboardEmbed(game)] });

  game.cooldown = setTimeout(() => {
    game.cooldown = null;
    sendQuestion(message.channel, game).catch(error => console.error('Political Trivia next round error:', error));
  }, milestone ? MILESTONE_COOLDOWN_MS : NORMAL_COOLDOWN_MS);
}

async function startCommand(interaction) {
  try {
    const result = await start(interaction.channel);
    if (!result.ok) await interaction.reply({ content: result.message, ephemeral: true });
    else await interaction.reply({ content: '✅ Political Trivia started in this channel.', ephemeral: true });
  } catch (error) {
    console.error('Political Trivia start error:', error);
    await interaction.reply({ content: '❌ I could not start Political Trivia right now.', ephemeral: true }).catch(() => {});
  }
}

async function endCommand(interaction) {
  try {
    const stopped = await stop(interaction.channel);
    await interaction.reply({ content: stopped ? '🛑 Political Trivia ended.' : '❌ There is no active Political Trivia game in this channel.', ephemeral: true });
  } catch (error) {
    console.error('Political Trivia end error:', error);
    await interaction.reply({ content: '❌ I could not end Political Trivia cleanly.', ephemeral: true }).catch(() => {});
  }
}

module.exports = { startCommand, endCommand, onMessage, getGame };
