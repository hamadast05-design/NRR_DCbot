const engine = require('./image-minigame');
const bank = require('./triviagen-items');

const config = {
  key: 'triviagen',
  title: 'TriviaGen',
  color: 0x8e44ad,
  bank,
  hintEnabled: true,
  infoEnabled: true,
  hintDelayMs: 15_000,
  questionTitle: '🧩 TRIVIAGEN',
  questionPrompt: '**What everyday item is shown in this image?**\nType your answer in chat. You have 30 seconds.',
};

module.exports = {
  startCommand: interaction => engine.startCommand(interaction, config),
  endCommand: interaction => engine.endCommand(interaction, config),
  onMessage: message => engine.onMessage(message, config),
  start: channel => engine.start(channel, config),
  getGame: channelId => engine.getGame(channelId, config.key),
  itemCount: bank.length,
};
