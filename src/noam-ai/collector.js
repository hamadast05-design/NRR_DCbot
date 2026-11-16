const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { config } = require('./config');
const store = require('./database');
const NOAM_IDS = new Set(config.noamUserIds);
const runningGuilds = new Set();

function canReadPublicChannel(channel) {
  if (!channel?.guild || channel.isDMBased?.()) return false;
  if (![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type)) return false;
  return Boolean(channel.permissionsFor(channel.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel));
}
function serializeMessage(message) {
  return {messageId:message.id,guildId:message.guildId,channelId:message.channelId,userId:message.author.id,
    username:message.member?.displayName||message.author.globalName||message.author.username,
    content:message.cleanContent||message.content,createdAt:message.createdAt.toISOString(),isNoam:NOAM_IDS.has(message.author.id)};
}
async function collectChannel(channel,cutoff) {
  const state=await store.getCollectionState(channel.id);
  if(state?.completed) return 0;
  let before=state?.before_message_id||undefined, collected=0;
  while(true) {
    const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});
    if(!batch.size) { await store.updateCollectionState(channel.id,before||null,true); break; }
    const messages=[...batch.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
    const olderThanCutoff=messages.some(m=>m.createdTimestamp<cutoff);
    const eligible=messages.filter(m=>m.guildId===channel.guild.id&&!m.author.bot&&!m.webhookId&&
      m.createdTimestamp>=cutoff&&m.content).map(serializeMessage);
    const count=await store.storeMessages(eligible); collected+=count;
    before=messages[0].id;
    await store.updateCollectionState(channel.id,before,olderThanCutoff,count);
    if(olderThanCutoff||batch.size<100) { await store.updateCollectionState(channel.id,before,true); break; }
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  return collected;
}
async function collectGuild(guild) {
  if(!config.collectionNoticeAcknowledged) throw new Error('Collection is locked until the server-wide data-use notice is published and acknowledged.');
  if(runningGuilds.has(guild.id)) return {started:false,reason:'already_running'};
  runningGuilds.add(guild.id);
  const cutoff=Date.now()-config.lookbackDays*86400000;
  let total=0;
  try {
    const channels=await guild.channels.fetch();
    const targets=[...channels.values()].filter(canReadPublicChannel);
    for(const channel of targets) {
      try { total+=Number(await collectChannel(channel,cutoff)||0); }
      catch(error) { console.error('[NoamAI] Collection failed for channel',channel.id,error?.message||error); }
    }
    return {started:true,channels:targets.length,newlyStored:total};
  } finally { runningGuilds.delete(guild.id); }
}
async function storeLiveMessage(message) {
  if(!config.collectionEnabled||!config.collectionNoticeAcknowledged||!message.guild||
    message.guild.id!==config.guildId||!canReadPublicChannel(message.channel)||message.author.bot||message.webhookId||!message.content) return;
  await store.storeMessages([serializeMessage(message)]);
}
module.exports={collectGuild,storeLiveMessage,canReadPublicChannel};
