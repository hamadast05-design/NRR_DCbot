const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasPermission } = require('./access');
const bank = require('./mysterygen-items');

const CLUE_INTERVAL_MS = 15_000;
const FINAL_CLUE_INTERVAL_MS = 10_000;
const NEXT_ROUND_DELAY_MS = 10_000;
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
  const description = isStart
    ? [
        '## Can you figure out what I am?',
        '',
        'Three clues will be revealed for each mystery item. Send your guess in chat at any time.',
        '',
        '**CLUE 1 OF 3**',
        '> ' + game.current.clues[clueIndex],
        '',
        'The first correct answer ends the round.'
      ].join('\\n')
    : [
        '## I am thinking of something...',
        '',
        '**CLUE ' + number + ' OF 3**',
        '> ' + game.current.clues[clueIndex],
        '',
        'Send your guess in chat. The next clue arrives automatically.'
      ].join('\\n');
  const fields = isStart
    ? [
        { name: 'ROUND', value: String(game.roundNumber), inline: true },
        { name: 'CLUE TIMING', value: '15s between clues', inline: true },
        { name: 'FINAL CLUE', value: '10s to solve', inline: true },
        { name: 'QUESTION BANK', value: game.bank.length + ' items', inline: true },
        { name: 'HOST COMMAND', value: '!reveal skips to the answer', inline: true }
      ]
    : [
        { name: 'ROUND', value: String(game.roundNumber), inline: true },
        { name: 'CLUE', value: number + ' / 3', inline: true },
        { name: 'NEXT CLUE', value: clueIndex === 2 ? 'Answer reveal in 10s' : 'In 15s', inline: true }
      ];
  return new EmbedBuilder()
    .setTitle(isStart ? 'MYSTERYGEN | GAME STARTED' : 'MYSTERYGEN | WHAT AM I?')
    .setColor(0x5865f2)
    .setDescription(description)
    .addFields(fields)
    .setFooter({ text: 'Three clues • First correct answer wins • No points or leaderboard' });
}
function answerEmbed(item, roundNumber, solved) {
  return new EmbedBuilder()
    .setTitle(solved?'MYSTERY SOLVED':'MYSTERY REVEALED')
    .setColor(solved?0x2ecc71:0x5865f2)
    .setDescription('## '+item.name+'\n\n'+(solved?'Correct answer received!':'Nobody guessed the item this round.'))
    .setFooter({text:'Round '+roundNumber+' • Next round in 10 seconds'});
}
function scheduleNextRound(channel,game) {
  clearTimer(game);
  game.phase='between-rounds';
  game.timer=setTimeout(()=>{ game.timer=null; beginRound(channel,game).catch(error=>console.error('[MysteryGen] Next round failed:',error)); },NEXT_ROUND_DELAY_MS);
}
async function revealRound(channel,game,solved,winnerId=null) {
  if (!game.active || games.get(String(channel.id))!==game || !game.current) return false;
  const item=game.current;
  game.current=null;
  game.phase='revealing';
  clearTimer(game);
  await channel.send({embeds:[answerEmbed(item,game.roundNumber,solved)],allowedMentions:{parse:[]}});
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
    else revealRound(channel,game,false).catch(error=>console.error('[MysteryGen] Reveal failed:',error));
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
  await revealRound(message.channel,game,false);
  return true;
}
async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  const game=getGame(message.channel.id);
  if (!game || !game.current || game.phase==='between-rounds' || game.phase==='revealing') return;
  if (!acceptedAnswer(game.current,message.content)) return;
  await revealRound(message.channel,game,true,message.author.id);
}
module.exports={startCommand,endCommand,onMessage,revealCommand,start,stop,getGame,bankSize:bank.length};
