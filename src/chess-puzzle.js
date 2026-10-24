const { Chess } = require('chess.js');
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
  { name: 'Back-rank pressure', theme: 'Active rook check', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution: 'Re8+', hint: 'Use the rook to invade the eighth rank.' },
  { name: 'Queen gives check', theme: 'Forcing move', fen: '7k/5Qpp/6K1/8/8/8/8/8 w - - 0 1', solution: 'Qf8+', hint: 'Look for a forcing queen move near the enemy king.' },
  { name: 'Develop with tempo', theme: 'Tactical check', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', solution: 'Bxf7+', hint: 'A bishop sacrifice can pull the king into the open.' },
  { name: 'Knight attack', theme: 'Fork threat', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', solution: 'Nxe5', hint: 'Can the knight take the central pawn safely?' },
  { name: 'Central capture', theme: 'Win material', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', solution: 'Nf3', hint: 'Develop a piece while preparing to attack the centre.' }
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
function renderBoard(fen) {
  const board = new Chess(fen).board();
  const lines = ['  a b c d e f g h'];
  for (let rank = 0; rank < 8; rank++) {
    const cells = board[rank].map(piece => piece ? PIECES[piece.color][piece.type] : '·');
    lines.push((8 - rank) + ' ' + cells.join(' '));
  }
  lines.push('  a b c d e f g h');
  return '```
' + lines.join('
') + '
```';
}
function puzzleEmbed(puzzle, round) {
  return new EmbedBuilder().setTitle('♟️ CHESS PUZZLE')
    .setDescription('**' + puzzle.theme + '**\nFind the best move for **White**.\n\n' + renderBoard(puzzle.fen) + '\n💡 Hint: ||' + puzzle.hint + '||')
    .setColor(0x5865f2).setFooter({ text: 'Round ' + round + ' • 45 seconds • Answer with SAN (e.g. Nf3) or coordinates (e2e4)' });
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
  await channel.send({ embeds: [puzzleEmbed(game.current, game.solved + 1)] });
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
  const input = String(content || '').trim().replace(/^`+|`+$/g, '');
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
