const { Chess } = require('chess.js');
const sharp = require('sharp');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('./access');

const ROUND_TIMEOUT_MS = 45_000;
const COOLDOWN_MS = 5_000;
const games = new Map();
const PIECES = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

// Small built-in starter bank. Each position is checked for FEN validity and legal solution moves on load.
// SAN is the canonical answer; coordinate moves (e2e4) are accepted too.
const PUZZLES = [
  { name: 'Scholar’s Mate finish', theme: 'Checkmate in one', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solution: 'Qxf7#', hint: 'The queen and bishop are aiming at the same square.' },
  { name: 'Back-rank pressure', theme: 'Active rook check', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution: 'Re8#', hint: 'Use the rook to invade the eighth rank.' },
  { name: 'Queen net', theme: 'Checkmate in one', fen: '7k/6pp/5KQ1/8/8/8/8/8 w - - 0 1', solution: 'Qxg7#', hint: 'The king can help protect a queen sacrifice.' },
  { name: 'Cornered king', theme: 'Checkmate in one', fen: 'k7/pp6/1QK5/8/8/8/8/8 w - - 0 1', solution: 'Qxb7#', hint: 'Look for a queen capture that leaves the king no safe square.' },
  { name: 'Queen capture', theme: 'Win the queen', fen: '4k3/8/5q2/3N4/8/8/8/4K3 w - - 0 1', solution: 'Nxf6', hint: 'A knight can capture the undefended queen.' },
];

function validatePuzzles() {
  const valid = [];
  for (const puzzle of PUZZLES) {
    try {
      const chess = new Chess(puzzle.fen);
      const move = chess.move(puzzle.solution);
      if (!move) throw new Error('solution was not legal');
      valid.push({ ...puzzle, solution: move.san, uci: move.from + move.to + (move.promotion || '') });
    } catch (error) {
      console.error('Skipping invalid chess puzzle "' + puzzle.name + '": ' + error.message);
    }
  }
  return valid;
}
const BANK = validatePuzzles();

function gameFor(channelId) { const game = games.get(channelId); return game?.active ? game : null; }
function pickPuzzle(game) {
  if (!BANK.length) throw new Error('Chess puzzle bank has no valid positions.');
  if (game.used.size >= BANK.length) game.used.clear();
  const remaining = BANK.filter(p => !game.used.has(p.name));
  const puzzle = remaining[Math.floor(Math.random() * remaining.length)];
  game.used.add(puzzle.name);
  return puzzle;
}

// Render a real PNG board from the puzzle's FEN. The position image and answer always come
// from the same puzzle record, so no manually matched screenshot bank can drift out of sync.
async function renderBoard(fen) {
  const board = new Chess(fen).board();
  const square = 80;
  const boardSize = square * 8;
  const left = 64;
  const top = 74;
  const width = 768;
  const height = 790;
  const light = '#eeeed2';
  const dark = '#769656';
  const pieces = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = left + col * square;
      const y = top + row * square;
      const fill = (row + col) % 2 === 0 ? light : dark;
      pieces.push('<rect x="' + x + '" y="' + y + '" width="' + square + '" height="' + square + '" fill="' + fill + '"/>');
      const piece = board[row][col];
      if (piece) {
        const glyph = PIECES[piece.color][piece.type];
        const isWhite = piece.color === 'w';
        const fillColor = isWhite ? '#fffdf5' : '#202820';
        const outline = isWhite ? '#343a32' : '#f5f1e5';
        const cx = x + square / 2;
        const cy = y + square / 2 + 2;
        pieces.push('<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans, Noto Sans Symbols 2, serif" font-size="64" font-weight="bold" fill="' + fillColor + '" stroke="' + outline + '" stroke-width="1.2" paint-order="stroke fill">' + glyph + '</text>');
      }
    }
  }

  const coords = [];
  for (let col = 0; col < 8; col++) {
    const label = String.fromCharCode(97 + col);
    coords.push('<text x="' + (left + col * square + square / 2) + '" y="' + (top + boardSize + 26) + '" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#dce4d3">' + label + '</text>');
  }
  for (let row = 0; row < 8; row++) {
    coords.push('<text x="' + (left - 25) + '" y="' + (top + row * square + square / 2 + 6) + '" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#dce4d3">' + (8 - row) + '</text>');
  }

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    '<defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#000" flood-opacity=".25"/></filter></defs>' +
    '<rect width="100%" height="100%" rx="26" fill="#202a24"/>' +
    '<text x="' + (width / 2) + '" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3" fill="#f0f4e8">NRR CHESS PUZZLE</text>' +
    '<rect x="' + (left - 2) + '" y="' + (top - 2) + '" width="' + (boardSize + 4) + '" height="' + (boardSize + 4) + '" rx="3" fill="#101710" filter="url(#shadow)"/>' +
    pieces.join('') + coords.join('') +
    '<text x="' + (width / 2) + '" y="778" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#aeb9a9">WHITE TO MOVE</text>' +
    '</svg>';

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function puzzleEmbed(puzzle, round) {
  const boardImage = await renderBoard(puzzle.fen);
  const embed = new EmbedBuilder().setTitle('♟️ CHESS PUZZLE')
    .setDescription('**' + puzzle.theme + '**\nFind the best move for **White**.\n\n💡 Hint: ||' + puzzle.hint + '||')
    .setImage('attachment://chess-puzzle.png')
    .setColor(0x5865f2).setFooter({ text: 'Round ' + round + ' • 45 seconds • Answer with SAN (e.g. Nf3) or coordinates (e2e4)' });
  return { embed, boardImage };
}
function finalEmbed(game, reason) {
  const ranked = [...game.points.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = ranked.length ? ranked.map(([id,score],i) => (i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.') + ' <@' + id + '> — **' + score + ' ' + (score===1?'point':'points') + '**').join('\n') : 'No points were scored this session.';
  return new EmbedBuilder().setTitle('🏁 Chess Puzzle ended').setDescription(reason + '\n\n' + lines).setColor(0x5865f2).setFooter({ text: 'Solved puzzles: ' + game.solved });
}
function clearGame(game) {
  if (game.timeout) clearTimeout(game.timeout);
  if (game.cooldown) clearTimeout(game.cooldown);
  game.timeout = game.cooldown = null;
}
async function finish(channel, game, reason) {
  if (!game.active) return;
  game.active = false; clearGame(game); games.delete(channel.id);
  await channel.send({ embeds: [finalEmbed(game, reason)], allowedMentions: { parse: [] } }).catch(() => {});
}
async function nextRound(channel, game) {
  if (!game.active || games.get(channel.id) !== game) return;
  game.current = pickPuzzle(game);
  const rendered = await puzzleEmbed(game.current, game.solved + 1);
  await channel.send({
    embeds: [rendered.embed],
    files: [{ attachment: rendered.boardImage, name: 'chess-puzzle.png' }]
  });
  game.timeout = setTimeout(async () => {
    if (!game.active || games.get(channel.id) !== game || !game.current) return;
    const puzzle = game.current; game.current = null; game.timeout = null; game.unanswered++;
    await channel.send('⏰ Time is up! The solution was **' + puzzle.solution + '** (' + puzzle.name + ').').catch(() => {});
    if (game.unanswered >= 3) return finish(channel, game, 'Nobody solved three puzzles in a row.');
    game.cooldown = setTimeout(() => { game.cooldown = null; nextRound(channel, game).catch(error => console.error('Chess puzzle next round error:', error)); }, COOLDOWN_MS);
  }, ROUND_TIMEOUT_MS);
}
async function start(channel) {
  if (!channel?.isTextBased?.() || !channel.send) return { ok: false, message: 'Chess Puzzle can only be started in a text channel.' };
  if (gameFor(channel.id)) return { ok: false, message: 'A Chess Puzzle game is already active in this channel.' };
  if (!BANK.length) return { ok: false, message: 'The chess puzzle bank failed validation. Please notify a bot administrator.' };
  const game = { active: true, current: null, points: new Map(), solved: 0, unanswered: 0, used: new Set(), timeout: null, cooldown: null };
  games.set(channel.id, game);
  try {
    await channel.send('♟️ **Chess Puzzle has started!** Solve the position before the 45-second timer ends. First correct move earns 1 point. Three consecutive unsolved puzzles end the game.');
    await nextRound(channel, game);
    return { ok: true };
  } catch (error) { game.active = false; clearGame(game); games.delete(channel.id); throw error; }
}
async function stop(channel) {
  const game = gameFor(channel.id);
  if (!game) return false;
  await finish(channel, game, 'The host ended the session.');
  return true;
}
async function startCommand(interaction) {
  if (!hasPermission(interaction.user.id, interaction.memberPermissions, PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need Manage Server permission to host Chess Puzzle.', ephemeral: true });
  try {
    const result = await start(interaction.channel);
    if (!result.ok) return interaction.reply({ content: '❌ ' + result.message, ephemeral: true });
    return interaction.reply({ content: '✅ Chess Puzzle started in this channel.', ephemeral: true });
  } catch (error) {
    console.error('Chess Puzzle start error:', error);
    return interaction.reply({ content: '❌ I could not start Chess Puzzle right now.', ephemeral: true }).catch(() => {});
  }
}
async function endCommand(interaction) {
  if (!hasPermission(interaction.user.id, interaction.memberPermissions, PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need Manage Server permission to end Chess Puzzle.', ephemeral: true });
  const stopped = await stop(interaction.channel);
  return interaction.reply({ content: stopped ? '🛑 Chess Puzzle ended.' : '❌ There is no active Chess Puzzle game in this channel.', ephemeral: true });
}
function parseMove(chess, content) {
  const input = String(content || '').trim().replace(/^\x60+|\x60+$/g, '');
  if (!input || input.length > 12) return null;
  const legal = chess.moves({ verbose: true });
  return legal.find(move => move.san.toLowerCase() === input.toLowerCase() || (move.from + move.to + (move.promotion || '')).toLowerCase() === input.toLowerCase()) || null;
}
async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game = gameFor(message.channel.id);
  if (!game || !game.current || game.cooldown) return;
  const chess = new Chess(game.current.fen);
  const move = parseMove(chess, message.content);
  if (!move || move.san !== game.current.solution) return;
  if (game.timeout) clearTimeout(game.timeout);
  game.timeout = null;
  const puzzle = game.current; game.current = null; game.solved++; game.unanswered = 0;
  const id = message.author.id;
  game.points.set(id, (game.points.get(id) || 0) + 1);
  await message.channel.send({ content: '✅ <@' + id + '> solved it with **' + puzzle.solution + '**! **+1 point**.', allowedMentions: { parse: [], users: [id] } });
  await message.channel.send('**Puzzle:** ' + puzzle.name + ' • **Theme:** ' + puzzle.theme);
  if (game.solved % 5 === 0) {
    const ranked = [...game.points.entries()].sort((a,b) => b[1] - a[1]);
    await message.channel.send({ embeds: [new EmbedBuilder().setTitle('🏆 Chess Puzzle Leaderboard').setDescription(ranked.map(([uid,score],i)=>(i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.')+' <@'+uid+'> — **'+score+'**').join('\n') || 'No points yet.').setColor(0xf1c40f)], allowedMentions: { parse: [] } });
  }
  game.cooldown = setTimeout(() => { game.cooldown = null; nextRound(message.channel, game).catch(error => console.error('Chess puzzle next round error:', error)); }, COOLDOWN_MS);
}
module.exports = { startCommand, endCommand, start, stop, onMessage, getGame: channelId => gameFor(channelId) };
