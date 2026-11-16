const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { config } = require('./config');
const store = require('./database');
const NOAM_IDS = new Set(config.noamUserIds);
const runningGuilds = new Set();
const PARENT_TYPES = [ChannelType.GuildText,ChannelType.GuildAnnouncement,ChannelType.GuildForum,ChannelType.GuildMedia];

function isPublicParent(channel) {
  if(!channel?.guild||channel.isDMBased?.()||!PARENT_TYPES.includes(channel.type)) return false;
  return Boolean(channel.permissionsFor(channel.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel));
}
function canReadPublicChannel(channel) {
  if(!channel?.guild||channel.isDMBased?.()) return false;
  if(channel.type===ChannelType.PublicThread) return isPublicParent(channel.parent);
  return [ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type)&&isPublicParent(channel);
}
function serializeMessage(message) {
  return {messageId:message.id,guildId:message.guildId,channelId:message.channelId,userId:message.author.id,
    username:message.member?.displayName||message.author.globalName||message.author.username,
    content:message.cleanContent||message.content,createdAt:message.createdAt.toISOString(),isNoam:NOAM_IDS.has(message.author.id)};
}
async function collectChannel(channel,cutoff) {
  const state=await store.getCollectionState(channel.id);
  if(state?.completed) return 0;
  let before=state?.before_message_id||undefined,collected=0;
  while(true) {
    const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});
    if(!batch.size){await store.updateCollectionState(channel.id,before||null,true);break;}
    const messages=[...batch.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
    const olderThanCutoff=messages.some(m=>m.createdTimestamp<cutoff);
    const eligible=messages.filter(m=>m.guildId===channel.guild.id&&!m.author.bot&&!m.webhookId&&m.createdTimestamp>=cutoff&&m.content)
      .map(serializeMessage);
    const count=await store.storeMessages(eligible);collected+=count;before=messages[0].id;
    await store.updateCollectionState(channel.id,before,olderThanCutoff,count);
    if(olderThanCutoff||batch.size<100){await store.updateCollectionState(channel.id,before,true);break;}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  return collected;
}
async function fetchPublicThreads(parent,cutoff) {
  const threads=[];
  try {
    const active=await parent.threads.fetchActive();
    for(const thread of active.threads.values()) if(thread.type===ChannelType.PublicThread) threads.push(thread);
  } catch(error) { console.warn('[NoamAI] Could not fetch active public threads for',parent.id,error?.message||error); }
  if(typeof parent.threads?.fetchArchived!=='function') return threads;
  let before=new Date();
  for(let page=0;page<20;page++) {
    try {
      const archived=await parent.threads.fetchArchived({type:'public',limit:100,before});
      const values=[...archived.threads.values()];
      if(!values.length) break;
      for(const thread of values) {
        if(thread.type===ChannelType.PublicThread&&thread.createdTimestamp>=cutoff) threads.push(thread);
      }
      const oldest=values.reduce((a,b)=>a.createdTimestamp<b.createdTimestamp?a:b);
      if(oldest.createdTimestamp<cutoff||!archived.hasMore) break;
      before=new Date(oldest.createdTimestamp);
    } catch(error) {
      console.warn('[NoamAI] Could not fetch archived public threads for',parent.id,error?.message||error);
      break;
    }
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  return [...new Map(threads.map(thread=>[thread.id,thread])).values()];
}
async function collectGuild(guild) {
  if(!config.collectionNoticeAcknowledged) throw new Error('Collection is locked until the server-wide data-use notice is published and acknowledged.');
  if(runningGuilds.has(guild.id)) return {started:false,reason:'already_running'};
  runningGuilds.add(guild.id);
  const cutoff=Date.now()-config.lookbackDays*86400000;
  let total=0,completedTargets=0;
  try {
    const channels=await guild.channels.fetch();
    const parents=[...channels.values()].filter(isPublicParent);
    const targets=[];
    for(const parent of parents) {
      if([ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(parent.type)) targets.push(parent);
      targets.push(...await fetchPublicThreads(parent,cutoff));
    }
    for(const channel of targets) {
      try {total+=Number(await collectChannel(channel,cutoff)||0);completedTargets++;}
      catch(error){console.error('[NoamAI] Collection failed for channel/thread',channel.id,error?.message||error);}
    }
    return {started:true,channels:targets.length,completedChannels:completedTargets,newlyStored:total};
  } finally {runningGuilds.delete(guild.id);}
}
async function storeLiveMessage(message) {
  if(!config.collectionEnabled||!config.collectionNoticeAcknowledged||!message.guild||message.guild.id!==config.guildId||
    !canReadPublicChannel(message.channel)||message.author.bot||message.webhookId||!message.content) return;
  await store.storeMessages([serializeMessage(message)]);
}
module.exports={collectGuild,storeLiveMessage,canReadPublicChannel};
