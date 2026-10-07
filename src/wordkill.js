const { EmbedBuilder } = require('discord.js');

const englishWords = require('a-set-of-english-words');

// WordKill uses a large English word list instead of a small hard-coded set.
// Only plain alphabetic words with at least 3 letters are accepted.
const WORDS = new Set(
  [...englishWords]
    .map(word => String(word).trim().toLowerCase())
    .filter(word => /^[a-z]{3,}$/.test(word))
);

// Pre-index every consecutive 3-letter sequence once at startup. This keeps
// round generation fast even with hundreds of thousands of dictionary words.
const SEQUENCE_CANDIDATES = new Map();
for (const word of WORDS) {
  const seen = new Set();
  for (let i = 0; i <= word.length - 3; i++) {
    const sequence = word.slice(i, i + 3);
    if (seen.has(sequence)) continue;
    seen.add(sequence);

    let candidates = SEQUENCE_CANDIDATES.get(sequence);
    if (!candidates) {
      candidates = [];
      SEQUENCE_CANDIDATES.set(sequence, candidates);
    }
    candidates.push(word);
  }
}

const PLAYABLE_WORDS = [...WORDS].filter(word => {
  for (let i = 0; i <= word.length - 3; i++) {
    const candidates = SEQUENCE_CANDIDATES.get(word.slice(i, i + 3));
    if (candidates && candidates.length >= 2) return true;
  }
  return false;
});

const games = new Map();
const ROUND_TIMEOUT_MS = 30_000;
const NORMAL_COOLDOWN_MS = 4_000;
const MILESTONE_COOLDOWN_MS = 10_000;

function clearTimers(game) {
  if (game.timeout) clearTimeout(game.timeout);
  if (game.cooldown) clearTimeout(game.cooldown);
  game.timeout = null;
  game.cooldown = null;
}

function endGame(channelId) {
  const game = games.get(channelId);
  if (!game) return false;
  game.active = false;
  clearTimers(game);
  games.delete(channelId);
  return true;
}

function getGame(channelId) {
  const game = games.get(channelId);
  return game && game.active ? game : null;
}

function isValidWord(content) {
  const word = String(content || '').trim().toLowerCase();
  return /^[a-z]+$/.test(word) && WORDS.has(word);
}

function candidatesForSequence(sequence) {
  return SEQUENCE_CANDIDATES.get(sequence) || [];
}

function chooseRound() {
  const pool = PLAYABLE_WORDS.length ? PLAYABLE_WORDS : [...WORDS];
  const fullWord = pool[Math.floor(Math.random() * pool.length)];
  const sequences = [];

  for (let i = 0; i <= fullWord.length - 3; i++) {
    const sequence = fullWord.slice(i, i + 3);
    if (candidatesForSequence(sequence).length >= 2) sequences.push(sequence);
  }

  // PLAYABLE_WORDS guarantees this in normal operation, but keep a safe
  // fallback so a future dictionary change cannot create an invalid round.
  if (!sequences.length) {
    const fallback = [...SEQUENCE_CANDIDATES.entries()].find(([, candidates]) => candidates.length >= 2);
    if (!fallback) throw new Error('WordKill dictionary contains no playable 3-letter sequence.');
    return {
      fullWord: fallback[1][Math.floor(Math.random() * fallback[1].length)],
      target: fallback[0],
    };
  }

  return {
    fullWord,
    target: sequences[Math.floor(Math.random() * sequences.length)],
  };
}

function questionEmbed(game) {
  return new EmbedBuilder()
    .setDescription(`☕ Type a **word** containing the letters: **${game.current_target_letters.toUpperCase()}**.`)
    .setColor(0x5865f2)
    .setFooter({ text: `Round ${game.question_counter + 1}` });
}

function leaderboardEmbed(game) {
  const ranked = [...game.points.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const lines = ranked.length
    ? ranked.map(([userId, points], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} <@${userId}> — **${points} ${points === 1 ? 'point' : 'points'}**`;
      }).join('\\n')
    : 'No points yet.';

  return new EmbedBuilder()
    .setTitle('🏆 WordKill Leaderboard')
    .setDescription(lines)
    .setColor(0xf1c40f)
    .setFooter({ text: `After Round ${game.question_counter}` });
}

function createGame(channelId) {
  const game = {
    active: true,
    current_target_letters: '',
    current_full_word: '',
    question_counter: 0,
    points: new Map(),
    timeout: null,
    cooldown: null,
  };
  games.set(channelId, game);
  return game;
}

async function sendQuestion(channel, game) {
  if (!game.active || games.get(channel.id) !== game) return;

  const round = chooseRound();
  game.current_target_letters = round.target;
  game.current_full_word = round.fullWord;

  await channel.send({ embeds: [questionEmbed(game)] });

  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = setTimeout(async () => {
    if (!game.active || games.get(channel.id) !== game) return;

    game.timeout = null;
    game.current_target_letters = '';
    await channel.send(`⏰ Time's up! The correct answer was **${game.current_full_word}**.`).catch(() => {});

    game.cooldown = setTimeout(() => {
      game.cooldown = null;
      sendQuestion(channel, game).catch(error => console.error('WordKill next round error:', error));
    }, NORMAL_COOLDOWN_MS);
  }, ROUND_TIMEOUT_MS);
}

async function start(channel) {
  if (!channel?.isTextBased()) {
    return { ok: false, message: '❌ WordKill can only be started in a text channel.' };
  }

  if (getGame(channel.id)) {
    return { ok: false, message: '❌ A WordKill game is already active in this channel.' };
  }

  const game = createGame(channel.id);

  try {
    await channel.send('☕ **WordKill has started!** Be the first to type a valid word containing the displayed letters.');
    await sendQuestion(channel, game);
    return { ok: true };
  } catch (error) {
    endGame(channel.id);
    throw error;
  }
}

async function stop(channel) {
  if (!getGame(channel.id)) return false;
  endGame(channel.id);
  await channel.send('🛑 **WordKill has ended.**').catch(() => {});
  return true;
}

async function onMessage(message) {
  if (!message.guild || message.author.bot) return;

  const game = getGame(message.channel.id);
  if (!game || !isValidWord(message.content)) return;

  const guess = message.content.trim().toLowerCase();
  if (!game.current_target_letters || !guess.includes(game.current_target_letters)) return;

  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = null;

  const correctAnswer = game.current_full_word;
  game.current_target_letters = '';
  const userId = message.author.id;
  game.points.set(userId, (game.points.get(userId) || 0) + 1);
  game.question_counter += 1;

  await message.channel.send(
    `${message.author} Has guessed the right word!`
  );

  const milestone = game.question_counter % 5 === 0;
  if (milestone) {
    await message.channel.send({ embeds: [leaderboardEmbed(game)] });
  }

  const cooldown = milestone ? MILESTONE_COOLDOWN_MS : NORMAL_COOLDOWN_MS;
  game.cooldown = setTimeout(() => {
    game.cooldown = null;
    sendQuestion(message.channel, game).catch(error => console.error('WordKill next round error:', error));
  }, cooldown);
}

async function startCommand(message) {
  try {
    const result = await start(message.channel);
    if (!result.ok) await message.reply(result.message);
  } catch (error) {
    console.error('WordKill start error:', error);
    await message.reply('❌ I could not start WordKill right now.').catch(() => {});
  }
}

async function endCommand(message) {
  try {
    const stopped = await stop(message.channel);
    if (!stopped) await message.reply('❌ There is no active WordKill game in this channel.');
  } catch (error) {
    console.error('WordKill end error:', error);
    await message.reply('❌ I could not end WordKill cleanly.').catch(() => {});
  }
}

module.exports = { startCommand, endCommand, onMessage, getGame };
