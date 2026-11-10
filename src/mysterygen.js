const {
  EmbedBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { hasPermission } = require('./access');
const bank = require('./mysterygen-items');

const CLUE_INTERVAL_MS = 20_000;
const FINAL_CLUE_INTERVAL_MS = 15_000;
const NEXT_ROUND_DELAY_MS = 10_000;
const REPLAY_DELAY_MS = 5_000;
const MYSTERY_ICON_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/2753.png';
const games = new Map();

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function editDistanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i=0, j=0, edits=0;
  while (i<a.length && j<b.length) {
    if (a[i]===b[j]) { i++; j++; continue; }
    if (++edits>1) return false;
    if (a.length>b.length) i++; else if (b.length>a.length) j++; else { i++; j++; }
  }
  if (i<a.length || j<b.length) edits++;
  return edits<=1;
}
function acceptedAnswer(item, content) {
  const guess=normalize(content);
  if (!guess || guess.length<2) return false;
  const answers=[...new Set([item.name,...(item.aliases||[])])].map(normalize).filter(Boolean);
  if (answers.includes(guess)) return true;
  return answers.some(answer=>answer.length>=7 && guess.length>=7 && editDistanceAtMostOne(answer,guess));
}
function getGame(channelId) { const game=games.get(String(channelId)); return game && game.active ? game : null; }
function clearTimer(game) { if (game.timer) clearTimeout(game.timer); game.timer=null; }
function pickItem(game) {
  if (game.used.size>=game.bank.length) game.used.clear();
  const remaining=game.bank.map((_,i)=>i).filter(i=>!game.used.has(i));
  const index=remaining[Math.floor(Math.random()*remaining.length)];
  game.used.add(index);
  return game.bank[index];
}
function clueEmbed(game, clueIndex, isStart = false) {
  const number = clueIndex + 1;
  const waitSeconds = clueIndex === 2 ? FINAL_CLUE_INTERVAL_MS / 1000 : CLUE_INTERVAL_MS / 1000;
  const colors = [0xf1c40f, 0xe67e22, 0xe74c3c];
  const description = [
    ...(isStart ? [
      '» A mystery is underway. Guess in chat at any time — the first correct answer wins.',
      ''
    ] : []),
    '## ✦ CLUE ' + number + ' OF 3',
    '',
    '```text',
    String(game.current.clues[clueIndex]).replace(/```/g, '` ` `'),
    '```'
  ].join('\n');
  const footer = '⌗ Round ' + game.roundNumber + (isStart ? '' : ' • ⏱ ' + (clueIndex === 2 ? 'Answer reveal' : 'Next clue') + ' in ' + waitSeconds + 's');
  return new EmbedBuilder()
    .setTitle(isStart ? 'MYSTERYGEN | GAME STARTED' : 'MYSTERYGEN')
    .setColor(colors[clueIndex])
    .setThumbnail(MYSTERY_ICON_URL)
    .setDescription(description)
    .setFooter({ text: footer });
}
function answerEmbed(item, roundNumber, outcome) {
  const solved = outcome === 'solved';
  const note = solved
    ? 'Correct answer received!'
    : 'The host revealed the answer.';
  return new EmbedBuilder()
    .setTitle(solved ? 'MYSTERY SOLVED' : 'MYSTERY REVEALED')
    .setColor(solved ? 0x2ecc71 : 0x5865f2)
    .setDescription('## ' + item.name + '\n\n' + note)
    .setFooter({ text: '⌗ Round ' + roundNumber + ' • Next round in 10 seconds' });
}
function missedRoundPanel(item, roundNumber, channelId) {
  const replayId = 'mysterygen:play-again:' + channelId + ':' + roundNumber;
  const panel = new ContainerBuilder()
    .setAccentColor(0xe74c3c)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## MYSTERY REVEALED'),
      new TextDisplayBuilder().setContent('# ' + item.name + '\nNobody guessed correctly before time ran out.')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### » Ready for another round?')
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(replayId)
          .setLabel('Play Again')
          .setStyle(ButtonStyle.Secondary)
      )
    );
  return panel;
}
function scheduleNextRound(channel,game) {
  clearTimer(game);
  game.phase='between-rounds';
  game.timer=setTimeout(()=>{ game.timer=null; beginRound(channel,game).catch(error=>console.error('[MysteryGen] Next round failed:',error)); },NEXT_ROUND_DELAY_MS);
}
async function revealRound(channel,game,outcome,winnerId=null) {
  if (!game.active || games.get(String(channel.id))!==game || !game.current) return false;
  const item=game.current;
  const roundNumber=game.roundNumber;
  game.current=null;
  game.phase='revealing';
  clearTimer(game);
  if (outcome === 'missed') {
    await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [missedRoundPanel(item,roundNumber,channel.id)],
      allowedMentions: { parse: [] }
    });
    if (game.active && games.get(String(channel.id))===game) game.phase='awaiting-replay';
    return true;
  }
  await channel.send({embeds:[answerEmbed(item,roundNumber,outcome)],allowedMentions:{parse:[]}});
  if (!game.active || games.get(String(channel.id))!==game) return true;
  if (winnerId) await channel.send({content:'Correct answer: <@'+winnerId+'>.',allowedMentions:{parse:[]}});
  scheduleNextRound(channel,game);
  return true;
}
async function sendClue(channel,game,index,isStart=false) {
  if (!game.active || games.get(String(channel.id))!==game || !game.current) return;
  game.clueIndex=index;
  game.phase='clue-'+(index+1);
  await channel.send({embeds:[clueEmbed(game,index,isStart)],allowedMentions:{parse:[]}});
  if (!game.active || games.get(String(channel.id))!==game || !game.current) return;
  clearTimer(game);
  game.timer=setTimeout(()=>{
    game.timer=null;
    if (!game.active || games.get(String(channel.id))!==game || !game.current) return;
    if (index<2) sendClue(channel,game,index+1).catch(error=>console.error('[MysteryGen] Clue send failed:',error));
    else revealRound(channel,game,'missed').catch(error=>console.error('[MysteryGen] Reveal failed:',error));
  },index===2?FINAL_CLUE_INTERVAL_MS:CLUE_INTERVAL_MS);
}
async function beginRound(channel,game,isStart=false) {
  if (!game.active || games.get(String(channel.id))!==game) return;
  game.current=pickItem(game);
  game.roundNumber++;
  game.clueIndex=0;
  await sendClue(channel,game,0,isStart);
}
async function start(channel) {
  if (!channel || !channel.isTextBased() || !channel.send) return {ok:false,message:'MysteryGen can only be started in a text channel.'};
  if (getGame(channel.id)) return {ok:false,message:'MysteryGen is already active in this channel.'};
  const game={active:true,bank,used:new Set(),current:null,clueIndex:-1,roundNumber:0,phase:'starting',timer:null};
  games.set(String(channel.id),game);
  try {
    await beginRound(channel,game,true);
    return {ok:true};
  } catch(error) {
    game.active=false; clearTimer(game); games.delete(String(channel.id)); throw error;
  }
}
async function stop(channel) {
  const game=getGame(channel?.id);
  if (!game) return false;
  game.active=false; clearTimer(game); games.delete(String(channel.id));
  await channel.send({embeds:[new EmbedBuilder().setTitle('MYSTERYGEN | GAME ENDED').setDescription('The host ended the game.').setColor(0x747f8d).setFooter({text:'MysteryGen session closed'})],allowedMentions:{parse:[]}});
  return true;
}
async function startCommand(interaction) {
  if (!hasPermission(interaction.user.id,interaction.memberPermissions,PermissionFlagsBits.ManageGuild)) return interaction.reply({content:'You need Manage Server permission to start MysteryGen.',ephemeral:true});
  try {
    const result=await start(interaction.channel);
    if (!result.ok) return interaction.reply({content:result.message,ephemeral:true});
    return interaction.reply({content:'MysteryGen has started in this channel.',ephemeral:true});
  } catch(error) {
    console.error('[MysteryGen] Start command failed:',error);
    return interaction.reply({content:'I could not start MysteryGen right now.',ephemeral:true}).catch(()=>{});
  }
}
async function endCommand(interaction) {
  if (!hasPermission(interaction.user.id,interaction.memberPermissions,PermissionFlagsBits.ManageGuild)) return interaction.reply({content:'You need Manage Server permission to end MysteryGen.',ephemeral:true});
  try {
    const stopped=await stop(interaction.channel);
    return interaction.reply({content:stopped?'MysteryGen has ended.':'There is no active MysteryGen game in this channel.',ephemeral:true});
  } catch(error) {
    console.error('[MysteryGen] End command failed:',error);
    return interaction.reply({content:'I could not end MysteryGen cleanly.',ephemeral:true}).catch(()=>{});
  }
}
async function revealCommand(message) {
  if (!message.guild || message.author.bot || message.webhookId) return false;
  if (!hasPermission(message.author.id,message.member?.permissions,PermissionFlagsBits.ManageGuild)) {
    await message.reply('You need Manage Server permission to use !reveal.').catch(()=>{});
    return true;
  }
  const game=getGame(message.channel.id);
  if (!game || !game.current) {
    await message.reply('There is no active MysteryGen round to reveal in this channel.').catch(()=>{});
    return true;
  }
  await revealRound(message.channel,game,'host-reveal');
  return true;
}
async function onButton(interaction) {
  const match = /^mysterygen:play-again:(\d+):(\d+)$/.exec(interaction.customId);
  if (!match) return false;
  const [, channelId, roundNumberText] = match;
  const game = getGame(channelId);
  if (!game || game.phase !== 'awaiting-replay' || game.roundNumber !== Number(roundNumberText) || interaction.channelId !== channelId) {
    await interaction.reply({content:'This MysteryGen round is no longer waiting for a replay.',ephemeral:true});
    return true;
  }
  game.phase = 'replay-starting';
  try {
    // Acknowledge the component immediately so Discord does not time out the interaction.
    await interaction.deferUpdate();
    await interaction.channel.send({content:'Starting new Round! ⚙..',allowedMentions:{parse:[]}});
    clearTimer(game);
    game.timer=setTimeout(()=>{
      game.timer=null;
      beginRound(interaction.channel,game).catch(error=>{
        console.error('[MysteryGen] Replay start failed:',error);
        if (game.active && games.get(String(channelId))===game) game.phase='awaiting-replay';
      });
    },REPLAY_DELAY_MS);
  } catch(error) {
    game.phase='awaiting-replay';
    console.error('[MysteryGen] Replay button handling failed:',error);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({content:'I could not start the next round. Please try the button again.',ephemeral:true}).catch(()=>{});
    }
  }
  return true;
}
async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game=getGame(message.channel.id);
  if (!game || !game.current || game.phase==='between-rounds' || game.phase==='revealing' || game.phase==='awaiting-replay' || game.phase==='replay-starting') return;
  if (!acceptedAnswer(game.current,message.content)) return;
  await revealRound(message.channel,game,'solved',message.author.id);
}
module.exports={startCommand,endCommand,onMessage,revealCommand,onButton,start,stop,getGame,bankSize:bank.length};
