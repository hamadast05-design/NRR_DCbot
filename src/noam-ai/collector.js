const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { config } = require('./config');
const store = require('./database');
const NOAM_IDS = new Set(config.noamUserIds);
const runningGuilds = new Set();
const PARENT_TYPES = [ChannelType.GuildText,ChannelType.GuildAnnouncement,ChannelType.GuildForum,ChannelType.GuildMedia];
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

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
  if(state?.completed) return {stored:0,skipped:true};
  let before=state?.before_message_id||undefined,stored=0;
  await store.registerCollectionTarget(channel.id,channel.isThread?.()?'public_thread':'public_channel');
  while(true) {
    const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});
    if(!batch.size) {
      await store.updateCollectionState(channel.id,before||null,true,0,null);
      break;
    }
    const messages=[...batch.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
    const oldest=messages[0];
    const olderThanCutoff=oldest.createdTimestamp<cutoff;
    const eligible=messages.filter(m=>m.guildId===channel.guild.id&&!m.author.bot&&!m.webhookId&&m.createdTimestamp>=cutoff&&m.content)
      .map(serializeMessage);
    const count=await store.storeMessages(eligible);
    stored+=count;
    before=oldest.id;
    await store.updateCollectionState(channel.id,before,false,count,null);
    if(olderThanCutoff||batch.size<100) {
      await store.updateCollectionState(channel.id,before,true,0,null);
      break;
    }
    await sleep(300);
  }
  return {stored,skipped:false};
}
async function fetchPublicThreads(parent,cutoff) {
  const threads=[];
  const failures=[];
  try {
    const active=await parent.threads.fetchActive();
    for(const thread of active.threads.values()) if(thread.type===ChannelType.PublicThread&&thread.createdTimestamp>=cutoff) threads.push(thread);
  } catch(error) {
    failures.push({parentId:parent.id,stage:'active_threads',error:String(error?.message||error).slice(0,300)});
    console.warn('[NoamAI] Active public-thread discovery failed',parent.id,error?.message||error);
  }
  if(typeof parent.threads?.fetchArchived!=='function') return {threads,failures};
  let before=new Date();
  let pageCount=0;
  const seenCursors=new Set();
  while(true) {
    try {
      const archived=await parent.threads.fetchArchived({type:'public',limit:100,before});
      const values=[...archived.threads.values()];
      if(!values.length) break;
      for(const thread of values) {
        if(thread.type===ChannelType.PublicThread&&thread.createdTimestamp>=cutoff) threads.push(thread);
      }
      const oldest=values.reduce((a,b)=>a.createdTimestamp<b.createdTimestamp?a:b);
      if(oldest.createdTimestamp<cutoff||!archived.hasMore) break;
      const nextBefore=oldest.id;
      if(seenCursors.has(nextBefore)) {
        failures.push({parentId:parent.id,stage:'archived_threads',error:'Discord archive pagination cursor did not move; stopped to prevent a repeated-page loop.'});
        break;
      }
      seenCursors.add(nextBefore);
      before=nextBefore;
      pageCount++;
      if(pageCount%10===0) await sleep(500);
      else await sleep(200);
    } catch(error) {
      failures.push({parentId:parent.id,stage:'archived_threads',error:String(error?.message||error).slice(0,300)});
      console.warn('[NoamAI] Archived public-thread discovery failed',parent.id,error?.message||error);
      break;
    }
  }
  return {threads:[...new Map(threads.map(thread=>[thread.id,thread])).values()],failures};
}
async function collectGuild(guild) {
  if(!config.collectionNoticeAcknowledged) throw new Error('Collection is locked until the server-wide data-use notice is published and acknowledged.');
  if(runningGuilds.has(guild.id)) return {started:false,reason:'already_running'};
  runningGuilds.add(guild.id);
  const cutoff=Date.now()-config.lookbackDays*86400000;
  const report={started:true,discovered:0,completed:0,failed:0,skipped:0,newlyStored:0,discoveryFailures:[]};
  try {
    const channels=await guild.channels.fetch();
    const parents=[...channels.values()].filter(isPublicParent);
    const targets=[];
    for(const parent of parents) {
      if([ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(parent.type)) targets.push(parent);
      const discovery=await fetchPublicThreads(parent,cutoff);
      targets.push(...discovery.threads);
      report.discoveryFailures.push(...discovery.failures);
      for(const failure of discovery.failures) await store.recordCollectionError(failure.parentId,failure.stage,failure.error);
    }
    const uniqueTargets=[...new Map(targets.map(channel=>[channel.id,channel])).values()];
    report.discovered=uniqueTargets.length;
    for(const channel of uniqueTargets) await store.registerCollectionTarget(channel.id,channel.isThread?.()?'public_thread':'public_channel');
    for(const channel of uniqueTargets) {
      try {
        const result=await collectChannel(channel,cutoff);
        if(result.skipped) report.skipped++;
        else {report.completed++;report.newlyStored+=result.stored;}
      } catch(error) {
        report.failed++;
        const detail=String(error?.message||error).slice(0,500);
        await store.updateCollectionState(channel.id,null,false,0,detail).catch(dbError=>console.error('[NoamAI] Could not save collection failure',channel.id,dbError?.message||dbError));
        console.error('[NoamAI] Collection failed for channel/thread',channel.id,detail);
      }
    }
    report.discoveryFailed=report.discoveryFailures.length;
    console.log('[NoamAI] Historical collection audit:',JSON.stringify(report));
    return report;
  } finally {runningGuilds.delete(guild.id);}
}
async function storeLiveMessage(message) {
  if(!config.collectionEnabled||!config.collectionNoticeAcknowledged||!message.guild||message.guild.id!==config.guildId||
    !canReadPublicChannel(message.channel)||message.author.bot||message.webhookId||!message.content) return;
  await store.storeMessages([serializeMessage(message)]);
}
module.exports={collectGuild,storeLiveMessage,canReadPublicChannel};
