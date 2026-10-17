const engine = require('./image-minigame');
const bank = require('./countries');
const config = { key: 'flagrush', title: 'FlagRush', color: 0x2ecc71, bank, hintEnabled: false, infoEnabled: true };
module.exports = { startCommand: i => engine.startCommand(i, config), endCommand: i => engine.endCommand(i, config), onMessage: m => engine.onMessage(m, config), start: channel => engine.start(channel, config), getGame: channelId => engine.getGame(channelId, config.key) };
