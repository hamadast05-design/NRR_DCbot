const wordkill = require('./wordkill');
const politicalTrivia = require('./political-trivia');
const geographyTrivia = require('./geography-trivia');
const guessPolitician = require('./guess-the-politician');
const flagRush = require('./flagrush');
const mysteryGen = require('./mysterygen');
const chessPuzzle = require('./chess-puzzle');
const learningGames = require('./learning-games');

const reservations = new Map();
const readers = [
  ['WordKill', wordkill.getGame],
  ['Political Trivia', politicalTrivia.getGame],
  ['Geography Trivia', geographyTrivia.getGame],
  ['Guess The Politician', guessPolitician.getGame],
  ['FlagRush', flagRush.getGame],
  ['MysteryGen', mysteryGen.getGame],
  ['Chess Puzzle', chessPuzzle.getGame],
  ['Learning Game', learningGames.getGame],
];

function getActiveGame(channelId) {
  const id = String(channelId);
  const reservation = reservations.get(id);
  if (reservation) return { name: reservation.name, starting: true };
  for (const [name, getter] of readers) {
    try {
      const game = getter?.(id);
      if (game && game.active !== false) return { name };
    } catch (error) {
      console.error('Game session lookup failed for ' + name + ':', error);
    }
  }
  return null;
}

async function runExclusive(channelId, gameName, start) {
  const id = String(channelId);
  const active = getActiveGame(id);
  if (active) return { ok: false, message: active.starting
    ? 'Another game is currently being started in this channel. Please wait a moment.'
    : 'A game is already active in this channel (' + active.name + '). Please wait until it finishes.' };
  const token = Symbol(gameName);
  reservations.set(id, { token, name: gameName });
  try {
    const result = await start();
    if (result && result.ok === false) return result;
    return { ok: true, result };
  } finally {
    if (reservations.get(id)?.token === token) reservations.delete(id);
  }
}

module.exports = { getActiveGame, runExclusive };
