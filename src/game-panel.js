const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder,
  SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, SeparatorSpacingSize,
  StringSelectMenuBuilder, UserSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { runExclusive } = require('./game-sessions');
const wordkill = require('./wordkill');
const politicalTrivia = require('./political-trivia');
const geographyTrivia = require('./geography-trivia');
const guessPolitician = require('./guess-the-politician');
const flagRush = require('./flagrush');
const mysteryGen = require('./mysterygen');
const chessPuzzle = require('./chess-puzzle');
const stealOrNoSteal = require('./steal-or-no-steal');
const learningGames = require('./learning-games');

const { isSuperuser } = require('./access');

const ACCESS_ROLES = new Set(['1102294809147879465','1113872898726297661','1566684707377119232','1566681749294030881']);
const BANNER_URL = 'https://cdn.imageurlgenerator.com/uploads/88cfecef-4533-4b21-85f9-69aad6c2f089.jpg';
const GAME_THUMBNAIL_URL = 'https://cdn.imageurlgenerator.com/uploads/88cfecef-4533-4b21-85f9-69aad6c2f089.jpg';
const panelStartedGames = new Map();
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

async function launchStealChallenge(channel, owner, targetId) {
  const targetMember = await channel.guild.members.fetch(targetId).catch(() => null);
  if (!targetMember || targetMember.user.bot || targetMember.id === owner.id) return { ok:false, message:'Choose a valid, different server member as your opponent.' };
  let publicMessage = null;
  const fakeInteraction = {
    id:'gamepanel-' + Date.now(), createdTimestamp:Date.now(), guildId:channel.guildId, channelId:channel.id,
    channel, client:channel.client, user:owner, options:{ getUser:() => targetMember.user },
    deferReply:async () => { publicMessage = await channel.send('🧳 Preparing your Steal Or No Steal challenge...'); },
    fetchReply:async () => publicMessage, editReply:async payload => publicMessage.edit(payload),
  };
  await stealOrNoSteal.startCommand(fakeInteraction);
  return { ok:true };
}
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
  if (isSuperuser(interaction.user?.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleCache = interaction.member?.roles?.cache;
  const roleIds = roleCache ? [...roleCache.keys()] : (interaction.member?.roles || []);
  return [...ACCESS_ROLES].some(id => roleIds.includes(id));
}
const text = content => new TextDisplayBuilder().setContent(content);

function buildPanel(ownerId, selectedId = 'home', targetUserId = null) {
  const selected = GAMES.find(game => game.id === selectedId) || null;
  const container = new ContainerBuilder().setAccentColor(0xffffff);
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(BANNER_URL).setDescription('NR:R Game Panel banner')
  ));
  if (!selected) {
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text('# 🎮 NR:R Game Panel'), text('Browse the minigames available in this server. Select a game below to view its description, mechanics and launch options.'))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(emojiUrl('1f3ae')).setDescription('Game controller')));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(text('**GAME LIBRARY**'), text('**' + GAMES.length + ' games available**  •  Select a title to explore its page.'));
  } else {
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text('# ' + selected.icon + ' ' + selected.name), text(selected.description),
        text('**Category:** ' + selected.category + '\n**Game details:** ' + selected.details))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(emojiUrl(selected.image)).setDescription(selected.name + ' icon')));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(text('**GAME PANEL**  •  ' + (GAMES.findIndex(game => game.id === selected.id) + 1) + ' / ' + GAMES.length),
      text('Choose another game from the selector, or use the button below to launch the selected game in this channel.'));
  }
  const select = new StringSelectMenuBuilder().setCustomId('gamepanel:select:' + ownerId)
    .setPlaceholder(selected ? 'Selected: ' + selected.name + ' — choose another game' : 'Choose a game to view its details')
    .addOptions({label:'Game Library — Home',value:'home',description:'Return to the Game Panel home page',emoji:'🎮',default:!selected},
      ...GAMES.map(game => ({label:game.name,value:game.id,description:(game.category + ' • ' + game.details).slice(0,100),emoji:game.icon,default:selected?.id===game.id})));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
  if (selected?.id === 'steal') {
    container.addTextDisplayComponents(text('**CHALLENGE OPPONENT**'), text('Choose the member who will receive the challenge. You cannot challenge yourself or a bot.'));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('gamepanel:target:' + ownerId).setPlaceholder('Select your opponent').setMinValues(1).setMaxValues(1)
    ));
  }
  const canLaunch = Boolean(selected && (selected.launch || (selected.id === 'steal' && targetUserId)));
  const launchButton = new ButtonBuilder().setCustomId('gamepanel:start:' + ownerId + ':' + (selected?.id || 'none') + ':' + (targetUserId || 'none'))
    .setLabel(!selected ? 'Select a game first' : selected.id === 'steal' ? (targetUserId ? 'Start Steal Or No Steal' : 'Choose an opponent first') : 'Start ' + selected.name)
    .setEmoji(selected ? selected.icon : '🎮').setStyle(canLaunch ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!canLaunch);
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
  const [namespace,action,ownerId,gameId,targetUserId] = interaction.customId.split(':');
  if (namespace !== 'gamepanel') return false;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({content:'❌ This Game Panel belongs to the member who opened it.',ephemeral:true});
    return true;
  }
  if (!allowed(interaction)) {
    await interaction.reply({content:'❌ You no longer have permission to use the Game Panel.',ephemeral:true});
    return true;
  }
  if (action === 'select' && interaction.isStringSelectMenu()) {
    await interaction.update({components:[buildPanel(ownerId,interaction.values[0])],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}});
    return true;
  }
  if (action === 'target' && interaction.isUserSelectMenu()) {
    await interaction.deferUpdate();
    await interaction.message.edit({components:[buildPanel(ownerId,'steal',interaction.values[0])],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}});
    return true;
  }
  if (action === 'start' && interaction.isButton()) {
    const game = GAMES.find(item => item.id === gameId);
    if (!game) { await interaction.reply({content:'Select a game before starting.',ephemeral:true}); return true; }
    if (game.id === 'steal' && (!targetUserId || targetUserId === 'none')) {
      await interaction.reply({content:'Choose an opponent before starting the challenge.',ephemeral:true});
      return true;
    }
    const launch = game.id === 'steal' ? () => launchStealChallenge(interaction.channel,interaction.user,targetUserId) : () => game.launch(interaction.channel,interaction.user);
    await interaction.deferReply({ephemeral:true});
    const result = game.id === 'steal' ? await launch() : await runExclusive(interaction.channelId,game.name,launch);
    if (!result || result.ok !== false) panelStartedGames.set(interaction.channelId,{ ownerId:interaction.user.id, gameId:game.id, gameName:game.name });
    if (result && result.ok === false) { await interaction.editReply({content:'⛔ ' + result.message}); return true; }
    await interaction.editReply({content:'✅ **' + game.name + '** has been started in this channel.'});
    return true;
  }
  return false;
}

async function handleStopMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId || !/^!stop$/i.test(message.content.trim())) return false;
  const session = panelStartedGames.get(message.channel.id);
  if (!session) {
    await message.reply('ℹ️ There is no active Game Panel game in this channel.').catch(() => {});
    return true;
  }
  if (session.ownerId !== message.author.id) {
    await message.reply('❌ Only the member who started this game through the Game Panel can stop it.').catch(() => {});
    return true;
  }
  const channel = message.channel;
  let stopped = false;
  try {
    switch (session.gameId) {
      case 'wordkill': stopped = await wordkill.stop(channel); break;
      case 'political': stopped = await politicalTrivia.stop(channel); break;
      case 'geography': stopped = await geographyTrivia.stop(channel); break;
      case 'flag': stopped = await flagRush.stop(channel); break;
      case 'politician': stopped = await guessPolitician.stop(channel); break;
      case 'mystery': stopped = await mysteryGen.stop(channel); break;
      case 'math': stopped = await learningGames.stopByPanel(channel, message.author.id, 'math'); break;
      case 'language': stopped = await learningGames.stopByPanel(channel, message.author.id, 'language'); break;
      case 'academics': stopped = await learningGames.stopByPanel(channel, message.author.id, 'academics'); break;
      case 'chess': stopped = await chessPuzzle.stop(channel); break;
      case 'steal':
        await message.reply('ℹ️ Steal Or No Steal is a two-player challenge; use its challenge controls to finish it.').catch(() => {});
        return true;
      default: stopped = false;
    }
    if (stopped) {
      panelStartedGames.delete(channel.id);
      await message.reply('🛑 **' + session.gameName + '** has been stopped.').catch(() => {});
    } else {
      panelStartedGames.delete(channel.id);
      await message.reply('ℹ️ That Game Panel session is no longer active.').catch(() => {});
    }
  } catch (error) {
    console.error('[GamePanel] !stop failed:', error);
    await message.reply('❌ I could not stop the Game Panel game cleanly.').catch(() => {});
  }
  return true;
}

module.exports = {command,handleCommand,handleInteraction,handleStopMessage,buildPanel,GAMES};
