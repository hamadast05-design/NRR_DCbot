const engine = require('./image-minigame');
const bank = require('./politicians-presidents');
const config = { key: 'gtp', title: 'Guess The Politician', color: 0x3498db, bank, hintEnabled: false, infoEnabled: true };
module.exports = { startCommand: i => engine.startCommand(i, config), endCommand: i => engine.endCommand(i, config), onMessage: m => engine.onMessage(m, config), start: channel => engine.start(channel, config), getGame: channelId => engine.getGame(channelId, config.key) };
