const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder,
  SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder,
  StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { runExclusive } = require('./game-sessions');
const wordkill = require('./wordkill');
const politicalTrivia = require('./political-trivia');
const geographyTrivia = require('./geography-trivia');
const guessPolitician = require('./guess-the-politician');
const flagRush = require('./flagrush');
const mysteryGen = require('./mysterygen');
const chessPuzzle = require('./chess-puzzle');
const learningGames = require('./learning-games');

const ACCESS_ROLES = new Set(['1102294809147879465','1113872898726297661','1566684707377119232','1566681749294030881']);
const BANNER_URL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85';
const emojiUrl = code => 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/' + code + '.png';

const GAMES = [
  { id:'wordkill', name:'WordKill', category:'Word Games', icon:'☕', image:'2615', description:'A fast-paced word challenge. Be the first to find and type a valid word containing the displayed letter sequence before the round expires.', details:'First valid word wins each round • Human message answers • Use !skipW when permitted', launch: channel => wordkill.start(channel) },
  { id:'political', name:'Political Trivia', category:'Trivia & Knowledge', icon:'🏛️', image:'1f3db', description:'Put your knowledge of politics, leaders, international relations and history to the test in a competitive question-by-question trivia session.', details:'30-second questions • First correct answer wins • Live scoring', launch: channel => politicalTrivia.start(channel) },
  { id:'geography', name:'Geography Trivia', category:'Trivia & Knowledge', icon:'🌍', image:'1f30d', description:'Explore countries, capitals, borders, landmarks and world geography through a large rotating question bank. Compete with everyone in the channel.', details:'400-question bank • 30-second timer • First correct answer wins', launch: channel => geographyTrivia.start(channel) },
  { id:'flag', name:'FlagRush', category:'Image & Guessing', icon:'🚩', image:'1f6a9', description:'Identify countries from their flags in a rapid-fire visual guessing game. Build your score by being the first to recognize each flag.', details:'Image-based rounds • First correct answer wins • Competitive scoring', launch: channel => flagRush.start(channel) },
  { id:'politician', name:'Guess The Politician', category:'Image & Guessing', icon:'🧑‍💼', image:'1f9d1-200d-1f4bc', description:'Recognize famous political figures from their pictures. A visual guessing challenge featuring presidents, prime ministers and other notable leaders.', details:'Image-based rounds • First correct answer wins • Competitive scoring', launch: channel => guessPolitician.start(channel) },
  { id:'mystery', name:'MysteryGen', category:'Image & Guessing', icon:'🔎', image:'1f50e', description:'A mystery item is revealed through three progressive clues. Work out the answer as early as possible and see whether you can solve it before everyone else.', details:'Three clues per mystery • Progressive reveals • Play Again support', launch: channel => mysteryGen.start(channel) },
  { id:'math', name:'Math Game', category:'Learning Games', icon:'➗', image:'2797', description:'Solve quick mathematics questions and compete for points. The panel launches the mixed question set; the existing slash command still offers difficulty selection.', details:'40-second questions • Mixed difficulty • First correct answer wins', launch: (channel, owner) => launchLearning(channel, owner, 'math') },
  { id:'language', name:'Language Game', category:'Learning Games', icon:'🗣️', image:'1f5e3', description:'Test vocabulary and language knowledge with short questions. The panel launches standard message-answer mode; the existing command still offers button answers.', details:'Timed questions • Vocabulary practice • First correct answer wins', launch: (channel, owner) => launchLearning(channel, owner, 'language') },
  { id:'academics', name:'Academic Game', category:'Learning Games', icon:'🎓', image:'1f393', description:'A rotating academic quiz covering subjects such as mathematics, science, physics, chemistry and biology. Answer correctly to earn points.', details:'Multiple academic subjects • Timed questions • First correct answer wins', launch: (channel, owner) => launchLearning(channel, owner, 'academics') },
  { id:'chess', name:'Chess Puzzle', category:'Strategy', icon:'♟️', image:'265f', description:'Study a chess position and find the best move for White. Solve tactical puzzles, earn points and compete on the session leaderboard.', details:'45-second puzzles • SAN or coordinate answers • Leaderboard', launch: channel => chessPuzzle.start(channel) },
  { id:'steal', name:'Steal Or No Steal', category:'Challenge Games', icon:'🧳', image:'1f9f3', description:'Challenge another member to a two-player decision game involving negotiation and a final Steal Or No Steal choice. This game requires a chosen opponent.', details:'Two-player challenge • Requires opponent selection • Start with /steal_or_no_steal', launch: null },
];

async function launchLearning(channel, owner, type) {
  const fakeInteraction = {
    channel, channelId:channel.id, guildId:channel.guildId, user:owner, inGuild:() => Boolean(channel.guildId),
    options:{ getString:() => null, getBoolean:() => false },
    reply:payload => channel.send(payload),
  };
  if (type === 'math') return learningGames.startMath(fakeInteraction);
  if (type === 'language') return learningGames.startLanguage(fakeInteraction);
  return learningGames.startAcademics(fakeInteraction);
}

function allowed(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = interaction.member?.roles?.cache;
  return Boolean(roles && [...ACCESS_ROLES].some(id => roles.has(id)));
}
const text = content => new TextDisplayBuilder().setContent(content);

function buildPanel(ownerId, selectedId = 'home') {
  const selected = GAMES.find(game => game.id === selectedId) || null;
  const container = new ContainerBuilder().setAccentColor(0x5865f2);
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(BANNER_URL).setDescription('NR:R Game Panel banner')
  ));
  if (!selected) {
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text('# 🎮 NR:R Game Panel'), text('Browse the minigames available in this server. Select a game below to view its description, mechanics and launch options.'))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(emojiUrl('1f3ae')).setDescription('Game controller')));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(text('**GAME LIBRARY**'), text('**' + GAMES.length + ' games available**  •  Select a title to explore its page.'));
  } else {
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text('# ' + selected.icon + ' ' + selected.name), text(selected.description),
        text('**Category:** ' + selected.category + '\n**Game details:** ' + selected.details))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(emojiUrl(selected.image)).setDescription(selected.name + ' icon')));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(text('**GAME PANEL**  •  ' + (GAMES.findIndex(game => game.id === selected.id) + 1) + ' / ' + GAMES.length),
      text('Choose another game from the selector, or use the button below to launch the selected game in this channel.'));
  }
  const select = new StringSelectMenuBuilder().setCustomId('gamepanel:select:' + ownerId)
    .setPlaceholder(selected ? 'Selected: ' + selected.name + ' — choose another game' : 'Choose a game to view its details')
    .addOptions({label:'Game Library — Home',value:'home',description:'Return to the Game Panel home page',emoji:'🎮',default:!selected},
      ...GAMES.map(game => ({label:game.name,value:game.id,description:(game.category + ' • ' + game.details).slice(0,100),emoji:game.icon,default:selected?.id===game.id})));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
  const launchButton = new ButtonBuilder().setCustomId('gamepanel:start:' + ownerId + ':' + (selected?.id || 'none'))
    .setLabel(selected ? (selected.launch ? 'Start ' + selected.name : 'How to start ' + selected.name) : 'Select a game first')
    .setEmoji(selected ? selected.icon : '🎮').setStyle(selected?.launch ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!selected);
  container.addActionRowComponents(new ActionRowBuilder().addComponents(launchButton));
  container.addTextDisplayComponents(text('-# NR:R • Game Panel'));
  return container;
}

const command = new SlashCommandBuilder().setName('gamepanel').setDescription('Open your personal NR:R Game Panel.');
async function handleCommand(interaction) {
  if (!interaction.inGuild()) return interaction.reply({content:'❌ Game Panel can only be used inside the server.',ephemeral:true});
  if (!allowed(interaction)) return interaction.reply({content:'❌ You do not have access to the Game Panel.',ephemeral:true});
  return interaction.reply({components:[buildPanel(interaction.user.id)],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}});
}
async function handleInteraction(interaction) {
  const [namespace,action,ownerId,gameId] = interaction.customId.split(':');
  if (namespace !== 'gamepanel') return false;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({content:'❌ This Game Panel belongs to the member who opened it.',ephemeral:true});
    return true;
  }
  if (action === 'select' && interaction.isStringSelectMenu()) {
    await interaction.update({components:[buildPanel(ownerId,interaction.values[0])],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}});
    return true;
  }
  if (action === 'start' && interaction.isButton()) {
    const game = GAMES.find(item => item.id === gameId);
    if (!game) { await interaction.reply({content:'Select a game before starting.',ephemeral:true}); return true; }
    if (!game.launch) {
      await interaction.reply({content:'🧳 Steal Or No Steal is an opponent-based challenge. Start it with /steal_or_no_steal and choose the member you want to challenge.',ephemeral:true});
      return true;
    }
    const result = await runExclusive(interaction.channelId,game.name,() => game.launch(interaction.channel,interaction.user));
    if (!result.ok) { await interaction.reply({content:'⛔ ' + result.message,ephemeral:true}); return true; }
    await interaction.reply({content:'✅ **' + game.name + '** has been started in this channel.',ephemeral:true});
    return true;
  }
  return false;
}
module.exports = {command,handleCommand,handleInteraction,buildPanel,GAMES};
