const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const questionBank = require('./geography-trivia-questions');
const { hasPermission } = require('./access');

const games = new Map();
const ROUND_TIMEOUT_MS = 30_000;
const NORMAL_COOLDOWN_MS = 5_000;
const MILESTONE_COOLDOWN_MS = 10_000;
const MILESTONE_EVERY = 5;
const MAX_LEADERBOARD_ROWS = 20;

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
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function editDistance(a, b) {
  if (a.length > b.length) [a, b] = [b, a];
  let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    const current = [i];
    for (let j = 1; j <= a.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1));
    previous = current;
  }
  return previous[a.length];
}
function answerMatches(input, acceptedAnswers) {
  const guess = normalize(input);
  if (!guess) return false;
  return acceptedAnswers.some(answer => {
    const candidate = normalize(answer);
    if (!candidate || guess === candidate) return Boolean(candidate);
    if (candidate.length < 6 || guess.length < 5 || Math.abs(candidate.length - guess.length) > 1) return false;
    return editDistance(guess, candidate) <= 1;
  });
}
function shuffledIndices() {
  const indices = questionBank.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}
function chooseQuestion(game) {
  if (!questionBank.length) throw new Error('Geography Trivia question bank is empty.');
  if (!game.deck.length) game.deck = shuffledIndices();
  return questionBank[game.deck.pop()];
}
function questionEmbed(game) {
  return new EmbedBuilder().setTitle('🌍 Geography Trivia').setDescription(game.current.question)
    .setColor(0x3498db).setFooter({ text: '30 seconds • First correct answer wins • +1 point' });
}
function rankedPlayers(game) {
  return [...game.points.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function leaderboardEmbed(game, final) {
  const ranked = rankedPlayers(game);
  const lines = ranked.length ? ranked.slice(0, MAX_LEADERBOARD_ROWS).map(([userId, points], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';
    const streak = game.streaks.get(userId);
    const best = streak && streak.best ? ' · Best streak: ' + streak.best : '';
    return medal + ' <@' + userId + '> — **' + points + ' ' + (points === 1 ? 'point' : 'points') + '**' + best;
  }).join('\n') : 'No points scored yet.';
  const embed = new EmbedBuilder().setTitle(final ? '🏆 Geography Trivia — Final Results' : '🏆 Geography Trivia Leaderboard')
    .setDescription(lines).setColor(final ? 0x2ecc71 : 0xf1c40f)
    .addFields(
      { name: 'Correct answers', value: String(game.question_counter), inline: true },
      { name: 'Questions attempted', value: String(game.rounds_started), inline: true },
      { name: 'Question bank', value: questionBank.length + ' questions', inline: true }
    );
  if (ranked.length > MAX_LEADERBOARD_ROWS) embed.setFooter({ text: 'Showing the top ' + MAX_LEADERBOARD_ROWS + ' of ' + ranked.length + ' players.' });
  else if (!final) embed.setFooter({ text: 'After ' + game.question_counter + ' successful answers' });
  return embed;
}
function createGame(channelId) {
  const game = {
    active: true, current: null, question_counter: 0, rounds_started: 0,
    points: new Map(), streaks: new Map(), unansweredStreak: 0,
    deck: shuffledIndices(), timeout: null, cooldown: null
  };
  games.set(channelId, game);
  return game;
}
function resetCurrentStreaks(game) {
  for (const streak of game.streaks.values()) streak.current = 0;
}
function revealAnswers(answers) {
  if (answers.length === 1) return 'The correct answer was **' + answers[0] + '**.';
  return 'Accepted answers include: **' + answers.join('**, **') + '**.';
}
async function finish(channel, game, reason) {
  if (!game.active || games.get(channel.id) !== game) return false;
  game.active = false;
  game.current = null;
  clearTimers(game);
  games.delete(channel.id);
  const ending = reason === 'unanswered'
    ? '🛑 Geography Trivia ended because three consecutive questions went unanswered.'
    : '🛑 Geography Trivia has ended.';
  await channel.send({ content: ending, embeds: [leaderboardEmbed(game, true)], allowedMentions: { parse: [] } })
    .catch(error => console.error('Geography Trivia final results error:', error));
  return true;
}
function scheduleNext(channel, game, delay) {
  if (!game.active || games.get(channel.id) !== game) return;
  if (game.cooldown) clearTimeout(game.cooldown);
  game.cooldown = setTimeout(() => {
    game.cooldown = null;
    sendQuestion(channel, game).catch(error => console.error('Geography Trivia next round error:', error));
  }, delay === undefined ? NORMAL_COOLDOWN_MS : delay);
}
async function sendQuestion(channel, game) {
  if (!game.active || games.get(channel.id) !== game) return;
  game.current = chooseQuestion(game);
  game.rounds_started += 1;
  const question = game.current;
  try {
    await channel.send({ embeds: [questionEmbed(game)] });
  } catch (error) {
    console.error('Geography Trivia question send error:', error);
    await finish(channel, game, 'error');
    return;
  }
  game.timeout = setTimeout(async () => {
    if (!game.active || games.get(channel.id) !== game || game.current !== question) return;
    game.timeout = null;
    game.current = null;
    resetCurrentStreaks(game);
    game.unansweredStreak += 1;
    await channel.send('⏰ Time\\'s up! ' + revealAnswers(question.answers)).catch(() => {});
    if (game.unansweredStreak >= 3) {
      await finish(channel, game, 'unanswered');
      return;
    }
    scheduleNext(channel, game, NORMAL_COOLDOWN_MS);
  }, ROUND_TIMEOUT_MS);
}
async function start(channel) {
  if (!channel || !channel.isTextBased || !channel.isTextBased() || typeof channel.send !== 'function')
    return { ok: false, message: '❌ Geography Trivia can only be started in a text channel.' };
  if (getGame(channel.id)) return { ok: false, message: '❌ Geography Trivia is already active in this channel.' };
  const game = createGame(channel.id);
  try {
    await channel.send('🌍 **Geography Trivia has started!** First correct answer wins. You have 30 seconds per question.');
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
  const game = channel && getGame(channel.id);
  if (!game) return false;
  return finish(channel, game, 'manual');
}
async function skip(channel, game) {
  if (!game || !game.current || game.cooldown) return false;
  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = null;
  const answers = game.current.answers;
  game.current = null;
  await channel.send('⏭️ Geography Trivia skipped. ' + revealAnswers(game.current.answers) + ' No points awarded.').catch(() => {});
  scheduleNext(channel, game, NORMAL_COOLDOWN_MS);
  return true;
}
async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game = getGame(message.channel.id);
  if (!game) return;
  if (message.content.trim().toLowerCase() === '!skipg') {
    if (!hasPermission(message.author.id, message.member && message.member.permissions, PermissionFlagsBits.ManageGuild)) {
      await message.reply({ content: '❌ You need Manage Server permission to skip Geography Trivia questions.', allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }
    const skipped = await skip(message.channel, game);
    if (!skipped) await message.reply('⏳ There is no active Geography Trivia question to skip right now.').catch(() => {});
    return;
  }
  if (!game.current || game.cooldown || !answerMatches(message.content, game.current.answers)) return;
  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = null;
  game.current = null;
  const userId = message.author.id;
  game.unansweredStreak = 0;
  for (const [id, streak] of game.streaks.entries()) if (id !== userId) streak.current = 0;
  const playerStreak = game.streaks.get(userId) || { current: 0, best: 0 };
  playerStreak.current += 1;
  playerStreak.best = Math.max(playerStreak.best, playerStreak.current);
  game.streaks.set(userId, playerStreak);
  game.points.set(userId, (game.points.get(userId) || 0) + 1);
  game.question_counter += 1;
  const streakText = playerStreak.current >= 2 ? ' 🔥 **' + playerStreak.current + ' answer streak!**' : '';
  await message.channel.send({
    content: '✅ <@' + userId + '> got it right! **+1 point.**' + streakText,
    allowedMentions: { parse: [], users: [userId] }
  });
  const milestone = game.question_counter % MILESTONE_EVERY === 0;
  if (milestone) await message.channel.send({ embeds: [leaderboardEmbed(game)], allowedMentions: { parse: [] } });
  scheduleNext(message.channel, game, milestone ? MILESTONE_COOLDOWN_MS : NORMAL_COOLDOWN_MS);
}
async function startCommand(interaction) {
  if (!interaction.inGuild() || !hasPermission(interaction.user.id, interaction.memberPermissions, PermissionFlagsBits.ManageGuild))
    return interaction.reply({ content: '❌ You need Manage Server permission to start Geography Trivia.', ephemeral: true });
  try {
    const result = await start(interaction.channel);
    await interaction.reply({ content: result.ok ? '✅ Geography Trivia started in this channel.' : result.message, ephemeral: true });
  } catch (error) {
    console.error('Geography Trivia start error:', error);
    await interaction.reply({ content: '❌ I could not start Geography Trivia right now.', ephemeral: true }).catch(() => {});
  }
}
async function endCommand(interaction) {
  if (!interaction.inGuild() || !hasPermission(interaction.user.id, interaction.memberPermissions, PermissionFlagsBits.ManageGuild))
    return interaction.reply({ content: '❌ You need Manage Server permission to end Geography Trivia.', ephemeral: true });
  try {
    const stopped = await stop(interaction.channel);
    await interaction.reply({ content: stopped ? '🛑 Geography Trivia ended.' : '❌ There is no active Geography Trivia game in this channel.', ephemeral: true });
  } catch (error) {
    console.error('Geography Trivia end error:', error);
    await interaction.reply({ content: '❌ I could not end Geography Trivia cleanly.', ephemeral: true }).catch(() => {});
  }
}
module.exports = { startCommand, endCommand, onMessage, getGame, start, stop };
