const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('./access');

const ROUND_TIMEOUT_MS = 30_000;
const NORMAL_COOLDOWN_MS = 5_000;
const MILESTONE_COOLDOWN_MS = 10_000;
const games = new Map();

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function editDistanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function acceptedAnswer(question, content) {
  const guess = normalize(content);
  if (!guess || guess.length < 2) return false;
  const answers = (question.aliases || [question.name]).map(normalize).filter(Boolean);
  if (answers.includes(guess)) return true;
  return answers.some(answer => answer.length >= 8 && guess.length >= 8 && editDistanceAtMostOne(answer, guess));
}

function clearTimers(game) {
  if (game.timeout) clearTimeout(game.timeout);
  if (game.hintTimeout) clearTimeout(game.hintTimeout);
  if (game.cooldown) clearTimeout(game.cooldown);
  game.timeout = game.hintTimeout = game.cooldown = null;
}
function gameId(key, channelId) { return key + ':' + channelId; }
function getGame(channelId, key) { const game = games.get(gameId(key, channelId)); return game && game.active ? game : null; }

function pickQuestion(game) {
  if (!game.bank.length) throw new Error(game.title + ' question bank is empty.');
  if (game.used.size >= game.bank.length) game.used.clear();
  const remaining = game.bank.map((_, i) => i).filter(i => !game.used.has(i));
  const index = remaining[Math.floor(Math.random() * remaining.length)];
  game.used.add(index);
  return game.bank[index];
}

function leaderboardEmbed(game) {
  const ranked = [...game.points.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = ranked.length ? ranked.map(([id, points], i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.') + ' <@' + id + '> — **' + points + ' ' + (points === 1 ? 'point' : 'points') + '**').join('\n') : 'No points yet.';
  return new EmbedBuilder().setTitle('🏆 ' + game.title + ' Leaderboard').setDescription(lines).setColor(0xf1c40f).setFooter({ text: 'After ' + game.question_counter + ' correct answers' });
}

function finalEmbed(game, reason) {
  const ranked = [...game.points.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = ranked.length ? ranked.map(([id, points], i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.') + ' <@' + id + '> — **' + points + ' ' + (points === 1 ? 'point' : 'points') + '**' + (game.bestStreak.get(id) ? ' · best streak ' + game.bestStreak.get(id) : '')).join('\n') : 'No points were scored this session.';
  return new EmbedBuilder().setTitle('🏁 ' + game.title + ' ended').setDescription(reason + '\n\n' + lines).setColor(0x5865f2).setFooter({ text: 'Correct answers: ' + game.question_counter });
}

function createGame(channel, config) {
  const game = { key: config.key, title: config.title, color: config.color, bank: config.bank, hintEnabled: config.hintEnabled, infoEnabled: config.infoEnabled, active: true, current: null, question_counter: 0, points: new Map(), currentStreak: new Map(), bestStreak: new Map(), unansweredStreak: 0, used: new Set(), timeout: null, hintTimeout: null, cooldown: null };
  games.set(gameId(config.key, channel.id), game);
  return game;
}

function questionEmbed(game) {
  const embed = new EmbedBuilder().setTitle(game.key === 'gtp' ? '🏛️ GUESS THE POLITICIAN' : '🌍 FLAGRUSH').setColor(game.color)
    .setDescription(game.key === 'gtp' ? '**Who is this political figure?**' : '**Which country does this flag represent?**')
    .setImage(game.current.resolvedImage || game.current.image || game.current.fallbackImage)
    .setFooter({ text: '30 seconds..' });
  return embed;
}

function answerDescription(game, q) {
  if (game.key === 'gtp') {
    const lines = ['**Answer:** ' + q.name];
    if (game.infoEnabled) lines.push('**Country:** ' + q.country, '**Position:** ' + q.role);
    return lines.join('\n');
  }
  const lines = ['**Answer:** ' + q.name];
  if (game.infoEnabled) lines.push('**Capital:** ' + q.capital);
  return lines.join('\n');
}

async function finishGame(channel, game, reason) {
  if (!game.active) return;
  game.active = false; clearTimers(game); games.delete(gameId(game.key, channel.id));
  await channel.send({ embeds: [finalEmbed(game, reason)], allowedMentions: { parse: [] } }).catch(() => {});
}

const resolvedImageCache = new Map();

function imageInfoUrl(info, width = 900) {
  if (!info) return null;
  if (info.thumburl && /^https:\/\//i.test(info.thumburl)) return info.thumburl;
  if (info.url && /^https:\/\//i.test(info.url) && /^image\/(jpeg|png|webp|gif)$/i.test(info.mime || '')) return info.url;
  return null;
}

async function requestCommons(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    ...params
  }).toString();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'NRR-Discord-Bot/1.0 (Guess The Politician image resolver)' },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error('Wikimedia Commons API returned HTTP ' + response.status);
  return response.json();
}

async function findCommonsImage(url, name) {
  // First resolve the exact configured filename through the Commons API.
  // This avoids relying on Special:FilePath redirects inside Discord embeds.
  if (url && url.includes('Special:FilePath/')) {
    try {
      const raw = url.split('Special:FilePath/')[1].split(/[?#]/)[0];
      const filename = decodeURIComponent(raw).replace(/_/g, ' ');
      const data = await requestCommons({
        titles: 'File:' + filename,
        prop: 'imageinfo',
        iiprop: 'url|mime|size',
        iiurlwidth: '900'
      });
      const page = Object.values(data.query?.pages || {})[0];
      const exact = imageInfoUrl(page?.imageinfo?.[0]);
      if (exact) return exact;
    } catch (error) {
      console.warn('Exact Commons image lookup failed for ' + name + ':', error.message);
    }
  }

  // Several entries in the curated bank point to outdated or nonexistent
  // filenames. Search Commons by the politician's name and select a real
  // raster image URL instead of returning a broken redirect.
  const searches = [name + ' official portrait', name + ' politician portrait', name];
  for (const query of searches) {
    try {
      const data = await requestCommons({
        generator: 'search',
        gsrsearch: query,
        gsrnamespace: '6',
        gsrlimit: '12',
        prop: 'imageinfo',
        iiprop: 'url|mime|size',
        iiurlwidth: '900'
      });
      const pages = Object.values(data.query?.pages || {}).sort((a, b) => {
        const titleA = String(a.title || '').toLowerCase();
        const titleB = String(b.title || '').toLowerCase();
        const target = name.toLowerCase();
        const score = title => (title.includes(target) ? 0 : title.includes('portrait') ? 1 : 2);
        return score(titleA) - score(titleB);
      });
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        const direct = imageInfoUrl(info);
        if (!direct || !/^image\/(jpeg|png|webp|gif)$/i.test(info.mime || '')) continue;
        if (info.width && info.width < 250) continue;
        if (/coat of arms|flag of|logo|signature|map of/i.test(page.title || '')) continue;
        return direct;
      }
    } catch (error) {
      console.warn('Commons search failed for ' + name + ' (' + query + '):', error.message);
    }
  }

  // Keep a final direct-image fallback if Commons search is temporarily unavailable.
  if (url && !url.includes('Special:FilePath/')) return url;
  return null;
}

async function resolveImageUrl(url, name) {
  const cacheKey = String(name || url || '').toLowerCase();
  if (resolvedImageCache.has(cacheKey)) return resolvedImageCache.get(cacheKey);
  const pending = findCommonsImage(url, name || 'politician').catch(error => {
    console.warn('Could not resolve image for ' + name + ':', error.message);
    return url && !url.includes('Special:FilePath/') ? url : null;
  });
  resolvedImageCache.set(cacheKey, pending);
  return pending;
}

async function sendQuestion(channel, game) {
  if (!game.active || games.get(gameId(game.key, channel.id)) !== game) return;
  game.current = pickQuestion(game);
  const q = game.current;
  q.resolvedImage = await resolveImageUrl(q.image, q.name);
  if (!q.resolvedImage && q.fallbackImage && q.fallbackImage !== q.image) {
    q.resolvedImage = await resolveImageUrl(q.fallbackImage, q.name);
  }
  if (!q.resolvedImage) {
    console.error('No usable image found for ' + q.name + '; skipping this question to avoid a broken image.');
    if (game.used.size >= game.bank.length) {
      await finishGame(channel, game, 'No usable images could be found for this question bank. Please notify a bot administrator.');
      return;
    }
    return sendQuestion(channel, game);
  }
  try {
    await channel.send({ embeds: [questionEmbed(game)] });
  } catch (error) {
    if (!q.fallbackImage || q.fallbackImage === q.resolvedImage) throw error;
    q.resolvedImage = await resolveImageUrl(q.fallbackImage, q.name);
    await channel.send({ embeds: [questionEmbed(game)] });
  }
  game.timeout = setTimeout(async () => {
    if (!game.active || games.get(gameId(game.key, channel.id)) !== game || !game.current) return;
    const missed = game.current; game.current = null; game.timeout = null; game.unansweredStreak++;
    for (const [userId] of game.currentStreak) game.currentStreak.set(userId, 0);
    await channel.send('⏰ Time is up! ' + answerDescription(game, missed) + '.').catch(() => {});
    if (game.unansweredStreak >= 3) { await finishGame(channel, game, 'Nobody answered correctly for three rounds in a row.'); return; }
    game.cooldown = setTimeout(() => { game.cooldown = null; sendQuestion(channel, game).catch(error => console.error(game.title + ' next round error:', error)); }, NORMAL_COOLDOWN_MS);
  }, ROUND_TIMEOUT_MS);
}

async function start(channel, config) {
  if (!channel || !channel.isTextBased() || !channel.send) return { ok: false, message: '❌ ' + config.title + ' can only be started in a text channel.' };
  if (getGame(channel.id, config.key)) return { ok: false, message: '❌ ' + config.title + ' is already active in this channel.' };
  const game = createGame(channel, config);
  try {
    await channel.send('🎮 **' + config.title + ' has started!** First correct answer wins, with one point per answer. Each round lasts 30 seconds; the game ends after three consecutive unanswered rounds.');
    await sendQuestion(channel, game); return { ok: true };
  } catch (error) { game.active = false; clearTimers(game); games.delete(gameId(config.key, channel.id)); throw error; }
}

async function stop(channel, config) { const game = getGame(channel.id, config.key); if (!game) return false; await finishGame(channel, game, 'The host ended the session.'); return true; }

async function startCommand(interaction, config) {
  if (!hasPermission(interaction.user.id, interaction.memberPermissions, PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need Manage Server permission to host this minigame.', ephemeral: true });
  try { const result = await start(interaction.channel, config); if (!result.ok) return interaction.reply({ content: result.message, ephemeral: true }); return interaction.reply({ content: '✅ ' + config.title + ' started in this channel.', ephemeral: true }); }
  catch (error) { console.error(config.title + ' start error:', error); return interaction.reply({ content: '❌ I could not start ' + config.title + ' right now.', ephemeral: true }).catch(() => {}); }
}
async function endCommand(interaction, config) {
  if (!hasPermission(interaction.user.id, interaction.memberPermissions, PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need Manage Server permission to end this minigame.', ephemeral: true });
  try { const stopped = await stop(interaction.channel, config); return interaction.reply({ content: stopped ? '🛑 ' + config.title + ' ended.' : '❌ There is no active ' + config.title + ' game in this channel.', ephemeral: true }); }
  catch (error) { console.error(config.title + ' end error:', error); return interaction.reply({ content: '❌ I could not end ' + config.title + ' cleanly.', ephemeral: true }).catch(() => {}); }
}

async function onMessage(message, config) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game = getGame(message.channel.id, config.key); if (!game || !game.current || game.cooldown) return;
  if (!acceptedAnswer(game.current, message.content)) return;
  if (game.timeout) clearTimeout(game.timeout); if (game.hintTimeout) clearTimeout(game.hintTimeout); game.timeout = game.hintTimeout = null;
  const q = game.current; game.current = null; game.unansweredStreak = 0; game.question_counter++;
  const userId = message.author.id; game.points.set(userId, (game.points.get(userId) || 0) + 1);
  const streak = (game.currentStreak.get(userId) || 0) + 1; game.currentStreak.set(userId, streak); game.bestStreak.set(userId, Math.max(game.bestStreak.get(userId) || 0, streak));
  for (const [id] of game.currentStreak) if (id !== userId) game.currentStreak.set(id, 0);
  await message.channel.send({ content: '✅ <@' + userId + '> got it right! **+1 point**.' + (streak >= 3 ? ' 🔥 **' + streak + ' in a row!**' : ''), allowedMentions: { parse: [], users: [userId] } });
  await message.channel.send({ content: answerDescription(game, q), allowedMentions: { parse: [] } }).catch(() => {});
  if (game.question_counter % 5 === 0) await message.channel.send({ embeds: [leaderboardEmbed(game)] });
  game.cooldown = setTimeout(() => { game.cooldown = null; sendQuestion(message.channel, game).catch(error => console.error(game.title + ' next round error:', error)); }, game.question_counter % 5 === 0 ? MILESTONE_COOLDOWN_MS : NORMAL_COOLDOWN_MS);
}
module.exports = { startCommand, endCommand, onMessage, start, getGame: (channelId, key) => getGame(channelId, key) };
