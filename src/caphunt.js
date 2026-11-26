const { EmbedBuilder } = require('discord.js');
const countries = require('./countries');
const { hasFeatureAccess } = require('./access');

const STAFF_TEAM_ROLE_ID = '1180415723164668044';
const ROUND_TIMEOUT_MS = 20_000;
const HINT_DELAY_MS = 15_000;
const NORMAL_COOLDOWN_MS = 5_000;
const MILESTONE_COOLDOWN_MS = 10_000;
const MILESTONE_EVERY = 5;
const MAX_LEADERBOARD_ROWS = 20;

// CapHunt deliberately uses a curated pool rather than every country in countries.js.
// Core pool: familiar countries across Asia, Europe and North America.
// Exceptions: selected widely recognized countries from Africa, South America and Oceania.
const INCLUDED_COUNTRY_CODES = new Set([
  // Asia
  'af','am','az','bh','bd','bt','bn','kh','cn','cy','ge','in','id','ir','iq','il',
  'jp','jo','kz','kw','kg','la','lb','my','mv','mn','mm','np','om','pk','ph','qa',
  'sa','sg','kr','lk','sy','tj','th','tl','tr','tm','ae','uz','vn','ye',
  // Europe
  'al','ad','at','by','be','ba','bg','hr','cz','dk','ee','fi','fr','de','gr','hu',
  'is','ie','it','lv','li','lt','lu','mt','md','mc','me','nl','mk','no','pl','pt',
  'ro','ru','sm','rs','sk','si','es','se','ch','ua','gb','va',
  // North America, Central America and the Caribbean
  'ag','bs','bb','bz','ca','cr','cu','dm','do','sv','gd','gt','ht','hn','jm','mx',
  'ni','pa','kn','lc','vc','tt','us',
  // Selected famous exceptions
  'eg','ma','za','ng','ke',
  'ar','br','cl','co','pe',
  'au','nz'
]);

// Additional valid capital spellings and recognized capital arrangements.
const CAPITAL_ALIASES = {
  us: ['Washington DC', 'Washington D.C.'],
  gb: ['London'],
  cn: ['Peking'],
  mm: ['Nay Pyi Taw', 'Naypyidaw'],
  lk: ['Sri Jayawardenepura Kotte', 'Kotte', 'Colombo'],
  za: ['Cape Town', 'Bloemfontein'],
  my: ['Putrajaya'],
  nl: ['The Hague'],
  bo: ['Sucre', 'La Paz'],
  tz: ['Dodoma'],
  ci: ['Yamoussoukro', 'Abidjan']
};

const bank = countries
  .filter(country => INCLUDED_COUNTRY_CODES.has(String(country.code || '').toLowerCase()))
  .filter(country => country.name && country.capital && country.image)
  .map(country => ({
    ...country,
    acceptedCapitals: [...new Set([country.capital, ...(CAPITAL_ALIASES[country.code] || [])])]
  }));

if (bank.length < 50) throw new Error('CapHunt country bank is unexpectedly small; check the curated country codes.');

const games = new Map();

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function answerMatches(input, acceptedAnswers) {
  const guess = normalize(input);
  if (!guess || guess.length < 2) return false;
  return acceptedAnswers.some(answer => {
    const candidate = normalize(answer);
    if (!candidate) return false;
    if (guess === candidate) return true;
    if (candidate.length < 5 || guess.length < 5) return false;
    const limit = candidate.length >= 10 && guess.length >= 10 ? 2 : 1;
    return editDistance(guess, candidate) <= limit;
  });
}

function shuffledIndices() {
  const indices = bank.map((_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function clearTimers(game) {
  if (game.timeout) clearTimeout(game.timeout);
  if (game.hintTimeout) clearTimeout(game.hintTimeout);
  if (game.cooldown) clearTimeout(game.cooldown);
  game.timeout = game.hintTimeout = game.cooldown = null;
}

function getGame(channelId) {
  const game = games.get(String(channelId));
  return game && game.active ? game : null;
}

function pickQuestion(game) {
  if (!game.deck.length) game.deck = shuffledIndices();
  return bank[game.deck.pop()];
}

function rankedPlayers(game) {
  return [...game.points.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function leaderboardEmbed(game, final = false) {
  const ranked = rankedPlayers(game);
  const lines = ranked.length
    ? ranked.slice(0, MAX_LEADERBOARD_ROWS).map(([id, points], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';
      const best = game.bestStreak.get(id) || 0;
      return medal + ' <@' + id + '> — **' + points + ' ' + (points === 1 ? 'point' : 'points') + '**' + (best >= 3 ? ' · Best streak: ' + best : '');
    }).join('\n')
    : 'No points were scored this session.';
  const embed = new EmbedBuilder()
    .setTitle(final ? '🏆 CapHunt — Final Results' : '🏆 CapHunt Leaderboard')
    .setDescription(lines)
    .setColor(final ? 0x2ecc71 : 0xf1c40f)
    .addFields(
      { name: 'Correct answers', value: String(game.questionCounter), inline: true },
      { name: 'Rounds played', value: String(game.roundsStarted), inline: true },
      { name: 'Countries in pool', value: String(bank.length), inline: true }
    );
  if (ranked.length > MAX_LEADERBOARD_ROWS) embed.setFooter({ text: 'Showing the top ' + MAX_LEADERBOARD_ROWS + ' of ' + ranked.length + ' players.' });
  else if (!final) embed.setFooter({ text: 'Leaderboard refreshes every ' + MILESTONE_EVERY + ' correct answers.' });
  return embed;
}

function finalEmbed(game, reason) {
  const embed = leaderboardEmbed(game, true);
  embed.setDescription(reason + '\n\n' + embed.data.description);
  return embed;
}

function questionEmbed(question) {
  return new EmbedBuilder()
    .setTitle('🌍 CAPHUNT')
    .setDescription('**What is the capital of ' + question.name + '?**')
    .setImage(question.image)
    .setColor(0x3498db)
    .setFooter({ text: '20 seconds • First correct answer wins • +1 point' });
}

function hintFor(question) {
  const answer = String(question.capital || '').trim();
  const firstWord = answer.split(/\s+/)[0] || answer;
  const firstLetter = [...firstWord][0] || '?';
  return '💡 **Hint:** The capital starts with **' + firstLetter.toUpperCase() + '**.';
}

function reveal(question) {
  return 'The answer was **' + question.capital + '**.';
}

async function finish(channel, game, reason) {
  if (!game.active || games.get(String(channel.id)) !== game) return false;
  game.active = false;
  game.current = null;
  clearTimers(game);
  games.delete(String(channel.id));
  await channel.send({
    content: reason,
    embeds: [finalEmbed(game, reason)],
    allowedMentions: { parse: [] }
  }).catch(error => console.error('[CapHunt] Final results send failed:', error));
  return true;
}

function scheduleNext(channel, game, delay = NORMAL_COOLDOWN_MS) {
  if (!game.active || games.get(String(channel.id)) !== game) return;
  if (game.cooldown) clearTimeout(game.cooldown);
  game.cooldown = setTimeout(() => {
    game.cooldown = null;
    sendQuestion(channel, game).catch(error => {
      console.error('[CapHunt] Next question failed:', error);
      finish(channel, game, 'CapHunt stopped because the next question could not be sent.');
    });
  }, delay);
}

async function sendQuestion(channel, game) {
  if (!game.active || games.get(String(channel.id)) !== game) return;
  const question = pickQuestion(game);
  game.current = question;
  game.roundsStarted++;
  try {
    await channel.send({ embeds: [questionEmbed(question)] });
  } catch (error) {
    console.error('[CapHunt] Question send failed:', error);
    await finish(channel, game, 'CapHunt stopped because a question could not be sent.');
    return;
  }

  game.hintTimeout = setTimeout(async () => {
    if (!game.active || games.get(String(channel.id)) !== game || game.current !== question) return;
    game.hintTimeout = null;
    await channel.send({ content: hintFor(question), allowedMentions: { parse: [] } }).catch(() => {});
  }, HINT_DELAY_MS);

  game.timeout = setTimeout(async () => {
    if (!game.active || games.get(String(channel.id)) !== game || game.current !== question) return;
    game.timeout = null;
    if (game.hintTimeout) clearTimeout(game.hintTimeout);
    game.hintTimeout = null;
    game.current = null;
    game.unansweredStreak++;
    game.currentStreak.clear();
    await channel.send('⏰ Time is up! ' + reveal(question)).catch(() => {});
    if (game.unansweredStreak >= 3) {
      await finish(channel, game, '🛑 CapHunt ended after three consecutive unanswered rounds.');
      return;
    }
    scheduleNext(channel, game);
  }, ROUND_TIMEOUT_MS);
}

function createGame(channel) {
  const game = {
    active: true,
    current: null,
    questionCounter: 0,
    roundsStarted: 0,
    points: new Map(),
    currentStreak: new Map(),
    bestStreak: new Map(),
    unansweredStreak: 0,
    deck: shuffledIndices(),
    timeout: null,
    hintTimeout: null,
    cooldown: null
  };
  games.set(String(channel.id), game);
  return game;
}

async function start(channel) {
  if (!channel || !channel.isTextBased?.() || typeof channel.send !== 'function') {
    return { ok: false, message: '❌ CapHunt can only be started in a text channel.' };
  }
  if (getGame(channel.id)) return { ok: false, message: '❌ CapHunt is already active in this channel.' };
  const game = createGame(channel);
  try {
    await channel.send('🌍 **CapHunt has started!** Identify each country’s capital from its flag. You have **20 seconds** per question, with an automatic hint after 15 seconds. Correct answers earn **+1 point**. The game ends after three consecutive unanswered rounds.');
    await sendQuestion(channel, game);
    return { ok: true };
  } catch (error) {
    game.active = false;
    clearTimers(game);
    games.delete(String(channel.id));
    throw error;
  }
}

async function stop(channel) {
  const game = channel && getGame(channel.id);
  if (!game) return false;
  return finish(channel, game, '🛑 CapHunt was ended by a host.');
}

async function skip(channel, game) {
  if (!game || !game.current || game.cooldown) return false;
  if (game.timeout) clearTimeout(game.timeout);
  if (game.hintTimeout) clearTimeout(game.hintTimeout);
  game.timeout = game.hintTimeout = null;
  const question = game.current;
  game.current = null;
  await channel.send('⏭️ CapHunt question skipped. ' + reveal(question) + ' No points awarded.').catch(() => {});
  scheduleNext(channel, game);
  return true;
}

function canManage(userId, member) {
  return hasFeatureAccess(userId, { member, roleIds: [STAFF_TEAM_ROLE_ID] });
}

async function startCommand(interaction) {
  if (!interaction.inGuild() || !canManage(interaction.user.id, interaction.member)) {
    return interaction.reply({ content: '❌ Only the Staff Team and authorized superusers can start CapHunt.', ephemeral: true });
  }
  try {
    const result = await start(interaction.channel);
    return interaction.reply({ content: result.ok ? '✅ CapHunt started in this channel.' : result.message, ephemeral: true });
  } catch (error) {
    console.error('[CapHunt] Start command failed:', error);
    return interaction.reply({ content: '❌ I could not start CapHunt right now.', ephemeral: true }).catch(() => {});
  }
}

async function endCommand(interaction) {
  if (!interaction.inGuild() || !canManage(interaction.user.id, interaction.member)) {
    return interaction.reply({ content: '❌ Only the Staff Team and authorized superusers can end CapHunt.', ephemeral: true });
  }
  try {
    const stopped = await stop(interaction.channel);
    return interaction.reply({ content: stopped ? '🛑 CapHunt ended.' : '❌ There is no active CapHunt game in this channel.', ephemeral: true });
  } catch (error) {
    console.error('[CapHunt] End command failed:', error);
    return interaction.reply({ content: '❌ I could not end CapHunt cleanly.', ephemeral: true }).catch(() => {});
  }
}

async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game = getGame(message.channel.id);
  if (!game) return;

  if (/^!skipc$/i.test(message.content.trim())) {
    if (!canManage(message.author.id, message.member)) {
      await message.reply({ content: '❌ Only the Staff Team and authorized superusers can skip CapHunt questions.', allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }
    const skipped = await skip(message.channel, game);
    if (!skipped) await message.reply('⏳ There is no active CapHunt question to skip right now.').catch(() => {});
    return;
  }

  if (!game.current || game.cooldown || !answerMatches(message.content, game.current.acceptedCapitals)) return;
  if (game.timeout) clearTimeout(game.timeout);
  if (game.hintTimeout) clearTimeout(game.hintTimeout);
  game.timeout = game.hintTimeout = null;

  const question = game.current;
  game.current = null;
  game.unansweredStreak = 0;
  game.questionCounter++;

  const userId = message.author.id;
  const streak = (game.currentStreak.get(userId) || 0) + 1;
  game.currentStreak.set(userId, streak);
  game.bestStreak.set(userId, Math.max(game.bestStreak.get(userId) || 0, streak));
  for (const [id] of game.currentStreak) if (id !== userId) game.currentStreak.set(id, 0);
  game.points.set(userId, (game.points.get(userId) || 0) + 1);

  const streakText = streak >= 3 ? ' 🔥 **' + streak + ' correct answers in a row!**' : '';
  await message.channel.send({
    content: '✅ <@' + userId + '> got it right! The answer was **' + question.capital + '**. **+1 point.**' + streakText,
    allowedMentions: { parse: [], users: [userId] }
  });

  const milestone = game.questionCounter % MILESTONE_EVERY === 0;
  if (milestone) {
    await message.channel.send({ embeds: [leaderboardEmbed(game)], allowedMentions: { parse: [] } });
  }
  scheduleNext(message.channel, game, milestone ? MILESTONE_COOLDOWN_MS : NORMAL_COOLDOWN_MS);
}

module.exports = {
  startCommand, endCommand, onMessage, start, stop, skip, getGame,
  countryCount: bank.length
};
