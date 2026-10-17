const engine = require('./image-minigame');
const bank = require('./politicians');
const config = { key: 'gtp', title: 'Guess The Politician', color: 0x3498db, bank, hintEnabled: true, infoEnabled: true };
module.exports = { startCommand: i => engine.startCommand(i, config), endCommand: i => engine.endCommand(i, config), onMessage: m => engine.onMessage(m, config) };
