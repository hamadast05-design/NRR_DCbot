const { EmbedBuilder } = require('discord.js');

const WORDS = new Set(`
about above accept across action active actual after again against age air all allow almost along already also always among amount animal another answer any appear apply area arm around arrive art ask away back bad bag ball bank base be beat become bed before begin behind believe best better between big bill bird bit black blood blue body book both box boy bring brother build business buy call camera can car care carry case cause center change check child choose city class clear close cold college color come common company complete concern consider contain continue control cost could country course cover create culture cut dark data day deal death decide deep develop did die different direction do dog door down draw dream drive during each early east easy eat education effect effort eight either else end enough enter entire especially even evening ever every example experience eye face fact fall family far fast father fear feel few field fight figure fill final find fine fire first five floor fly follow food foot for form four free friend from front full game garden gas general get girl give go good government great green ground group grow guess hair half hand happen happy hard have head health hear heart help her here high him his history hit home hope horse hot hour house how however idea if image important improve in include increase indeed information inside instead interest into island issue it job join just keep key kid kind know land language large last late later laugh law lead learn least leave left less let letter life light like line list listen little live local long look lose loss lot love low machine main make man many market matter may maybe me mean measure media medical meet member memory message middle might mile military million mind minute miss model modern moment money month more morning most mother move movie much music must my name near need never new news next night nine no north note nothing notice now number occur off offer office often oil old on once one only open opportunity order other our out outside over own page paper parent part party pass past pay peace people perhaps person phone picture place plan plant play point police policy poor popular position possible power practice prepare present pretty price probably problem process produce product program project prove provide public pull purpose put quality question quick quite race radio raise reach read ready real reason receive record red reduce remain remember report require research result return right road rock room rule run safe same save say school science sea second see seem sell send sense serve set seven several she short should show side simple since sing sister six size small social some someone something soon south space speak special spend sport spring stand start state stay step still story street strong student study subject success such summer sure system table take talk teacher team tell ten term test than thank that the their them then there these they thing think third this those though thought three through time to together too took top town trade train travel tree true try turn two under understand unit until up upon use usually value very video view visit voice wait walk want war watch water way we week weight well west what when where whether which while white who whole why wide wife will win window winter wish with woman word work world would write wrong year yes yet you young yourself zero zone
`.trim().split(/\s+/));

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
  const result = [];
  for (const word of WORDS) {
    if (word.includes(sequence)) result.push(word);
  }
  return result;
}

function chooseRound() {
  const allWords = [...WORDS];
  const playableWords = allWords.filter(word => {
    for (let i = 0; i <= word.length - 3; i++) {
      if (candidatesForSequence(word.slice(i, i + 3)).length >= 2) return true;
    }
    return false;
  });

  const pool = playableWords.length ? playableWords : allWords;
  const fullWord = pool[Math.floor(Math.random() * pool.length)];
  const sequences = [];

  for (let i = 0; i <= fullWord.length - 3; i++) {
    const sequence = fullWord.slice(i, i + 3);
    if (candidatesForSequence(sequence).length >= 2) sequences.push(sequence);
  }

  if (!sequences.length) {
    for (let i = 0; i <= fullWord.length - 3; i++) sequences.push(fullWord.slice(i, i + 3));
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
    `${message.author} Has guessed the right word! The correct answer was **${correctAnswer}**`
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
