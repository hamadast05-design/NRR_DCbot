const engine = require('./image-minigame');
const countries = require('./countries');

// Keep FlagRush focused on flags that are broadly recognizable to the community.
// North Africa stays in the pool, alongside a small set of widely recognized
// African flags. All other African entries are excluded from FlagRush only;
// the shared country dataset remains untouched for any other consumers.
const AFRICAN_COUNTRY_CODES = new Set([
  'dz', 'eg', 'ly', 'ma', 'sd', 'tn', 'eh',
  'ao', 'bj', 'bw', 'bf', 'bi', 'cv', 'cm', 'cf', 'td', 'km', 'cd', 'cg',
  'dj', 'gq', 'er', 'sz', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ci', 'ke',
  'ls', 'lr', 'mg', 'mw', 'ml', 'mr', 'mu', 'mz', 'na', 'ne', 'ng', 'rw',
  'st', 'sn', 'sc', 'sl', 'so', 'ss', 'za', 'tz', 'tg', 'ug', 'zm', 'zw'
]);

// North Africa + widely recognized African flags retained in the game.
const RETAINED_AFRICAN_CODES = new Set([
  'dz', 'eg', 'ly', 'ma', 'sd', 'tn', 'eh',
  'gh', 'ke', 'ng', 'za'
]);

const bank = countries.filter(country =>
  !AFRICAN_COUNTRY_CODES.has(country.code) || RETAINED_AFRICAN_CODES.has(country.code)
);

const config = { key: 'flagrush', title: 'FlagRush', color: 0x2ecc71, bank, hintEnabled: false, infoEnabled: true };
module.exports = { startCommand: i => engine.startCommand(i, config), endCommand: i => engine.endCommand(i, config), onMessage: m => engine.onMessage(m, config), start: channel => engine.start(channel, config), stop: channel => engine.stop(channel, config), getGame: channelId => engine.getGame(channelId, config.key) };
