const { PermissionFlagsBits, WebhookClient } = require('discord.js');
const { config } = require('./config');
const store = require('./database');
const collector = require('./collector');
const ai = require('./ai');
const ranking = require('./ranking');
const cooldowns=new Map(), activeUsers=new Set(), webhookCache=new Map();

async function migrate(){await store.migrate();}
function isManager(message){return Boolean(message.member?.permissions?.has(PermissionFlagsBits.ManageGuild));}
async function getWebhook(channel){
  if(webhookCache.has(channel.id)) return webhookCache.get(channel.id);
  const saved=await store.getWebhookCredentials(channel.id);
  if(saved?.webhook_id&&saved?.webhook_token){
    const client=new WebhookClient({id:saved.webhook_id,token:saved.webhook_token});
    webhookCache.set(channel.id,client);
    return client;
  }
  const created=await channel.createWebhook({name:'Noam AI',reason:'Talk to Noam AI character webhook'});
  if(!created.token) throw new Error('Discord did not return a webhook token.');
  await store.saveWebhookCredentials(channel.id,created.id,created.token);
  const client=new WebhookClient({id:created.id,token:created.token});
  webhookCache.set(channel.id,client);
  return client;
}
async function sendAsNoam(channel,content){
  const hook=await getWebhook(channel);
  return hook.send({content:String(content).slice(0,1900),username:config.displayName,avatarURL:config.avatarUrl,allowedMentions:{parse:[]}});
}
async function handleOptCommands(message){
  const command=message.content.trim().toLowerCase();
  if(command==='!noam-optout'){
    await store.optOut(message.author.id);
    await message.reply({content:'✅ Your messages have been excluded from Noam AI knowledge. Previously stored messages and your conversation history have been deleted.',allowedMentions:{parse:[]}});
    return true;
  }
  if(command==='!noam-optin'){
    await store.optIn(message.author.id);
    await message.reply({content:'✅ You have opted back in. New eligible public messages may be included while collection is enabled. Deleted history will not be restored.',allowedMentions:{parse:[]}});
    return true;
  }
  return false;
}
async function runDiagnostics(message) {
  const lines=['**Noam AI diagnostics**'];
  lines.push('Configuration: '+(config.enabled?'✅ API key and model variables are present':'❌ GEMINI_API_KEY or GEMINI_MODEL is missing'));
  try { await store.databaseCheck(); lines.push('PostgreSQL: ✅ Connected'); }
  catch(error) { lines.push('PostgreSQL: ❌ '+String(error?.message||error).slice(0,180)); }
  try {
    const channel=await message.guild.channels.fetch(config.channelId);
    if(!channel?.isTextBased()) lines.push('Discord channel: ❌ Configured Noam channel is missing or not text-based');
    else {
      const me=message.guild.members.me;
      const perms=me?channel.permissionsFor(me):null;
      const canView=Boolean(perms?.has(PermissionFlagsBits.ViewChannel));
      const canSend=Boolean(perms?.has(PermissionFlagsBits.SendMessages));
      const canHistory=Boolean(perms?.has(PermissionFlagsBits.ReadMessageHistory));
      lines.push('Discord channel: '+(canView&&canSend?'✅ View and send permissions OK':'❌ Missing View Channel or Send Messages'));
      lines.push('Message history permission: '+(canHistory?'✅ Available':'⚠️ Missing Read Message History'));
      const hook=await store.getWebhookCredentials(channel.id);
      lines.push('Webhook: '+(hook?.webhook_id&&hook?.webhook_token?'✅ Saved credentials found':(perms?.has(PermissionFlagsBits.ManageWebhooks)?'⚠️ No saved webhook; bot can create and save one on its first reply':'❌ No saved webhook and Manage Webhooks is missing')));
    }
  } catch(error) { lines.push('Discord channel: ❌ '+String(error?.message||error).slice(0,160)); }
  try {
    const stats=await store.collectionStats();
    lines.push('Knowledge database: ✅ '+Number(stats.total||0).toLocaleString()+' messages; '+Number(stats.channels||0)+' channels');
    lines.push('Historical targets: '+Number(stats.completed_channels||0)+' completed / '+Number(stats.total_targets||0)+' discovered; '+Number(stats.failed_channels||0)+' failed');
    if(Number(stats.failed_channels||0)>0) lines.push('Latest target error: '+String(stats.failures?.[0]?.last_error||'See server logs').slice(0,150));
    lines.push('Thread discovery errors: '+Number(stats.discovery_error_count||0));
    if(stats.discovery_failures?.[0]) lines.push('Latest discovery error: '+String(stats.discovery_failures[0].stage+': '+stats.discovery_failures[0].error).slice(0,150));
  } catch(error) { lines.push('Knowledge database: ❌ '+String(error?.message||error).slice(0,180)); }
  const api=await ai.diagnoseGemini();
  if(api.ok) {
    lines.push('Gemini API: ✅ '+api.detail);
    if(api.usageMetadata?.totalTokenCount) lines.push('Diagnostic tokens: '+api.usageMetadata.totalTokenCount+' total');
  } else {
    const labels={invalid_key:'Invalid API key',quota:'Free-tier quota or rate limit reached',billing:'Billing issue',rate_limit:'Rate limit reached',model:'Model unavailable or not found',permissions:'API project permission issue',timeout:'API request timed out',configuration:'Missing API configuration',max_tokens:'Output-token budget exhausted',blocked:'Prompt blocked by Gemini'};
    lines.push('Gemini API: ❌ '+(labels[api.category]||'Request failed')+' — '+api.detail);
    if(api.finishReason) lines.push('Gemini finish reason: '+api.finishReason);
    if(api.blockReason) lines.push('Gemini block reason: '+api.blockReason);
    if(api.usageMetadata?.totalTokenCount) lines.push('Diagnostic tokens: '+api.usageMetadata.totalTokenCount+' total');
    if(api.category==='max_tokens') lines.push('Next step: inspect NOAM_AI_MAX_OUTPUT_TOKENS; the diagnostic uses a 256-token budget and minimal thinking.');
    if(api.category==='quota') lines.push('Next step: check the Gemini project rate limits and daily quota in Google AI Studio.');
    if(api.category==='billing') lines.push('Next step: the project owner should check the linked Google Cloud billing account and Gemini API tier.');
  }
  await message.reply({content:lines.join('\n').slice(0,1900),allowedMentions:{parse:[]}});
}
async function handleAdminCommands(message){
  if(message.guild?.id!==config.guildId) return false;
  const command=message.content.trim().toLowerCase();
  if(!['!noam-collect','!noam-status','!noam-diagnose'].includes(command)) return false;
  if(!isManager(message)){await message.reply({content:'You need Manage Server permission to use this control.',allowedMentions:{parse:[]}});return true;}
  if(command==='!noam-diagnose'){ await runDiagnostics(message); return true; }
  if(command==='!noam-status'){
    const s=await store.collectionStats();
    await message.reply({content:[
      '**Noam AI knowledge status**','Stored messages: '+Number(s.total||0).toLocaleString(),
      'Noam messages: '+Number(s.noam_messages||0).toLocaleString(),'Channels indexed: '+Number(s.channels||0),
      'Historical targets completed: '+Number(s.completed_channels||0)+'/'+Number(s.total_targets||0),
      'Failed targets: '+Number(s.failed_channels||0),'Pending/running targets: '+Number(s.pending_channels||0),
      'Thread discovery errors: '+Number(s.discovery_error_count||0),
      'Collection notice acknowledged: '+(config.collectionNoticeAcknowledged?'Yes':'No'),
      'Live collection enabled: '+(config.collectionEnabled?'Yes':'No'),
    ].join('\n'),allowedMentions:{parse:[]}});
    return true;
  }
  if(!config.collectionNoticeAcknowledged){
    await message.reply({content:'Historical collection is locked until the server-wide data-use notice has been published. After publishing it, set NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=true in Railway and redeploy.',allowedMentions:{parse:[]}});
    return true;
  }
  await message.reply({content:'⏳ Starting historical public-channel collection in the background. Use !noam-status to check progress.',allowedMentions:{parse:[]}});
  collector.collectGuild(message.guild).then(result=>console.log('[NoamAI] Historical collection finished:',result))
    .catch(error=>console.error('[NoamAI] Historical collection failed:',error));
  return true;
}
async function handleChat(message){
  if(!message.guild||message.guild.id!==config.guildId||message.channelId!==config.channelId) return false;
  if(message.author.bot||message.webhookId||!message.content?.trim()) return false;
  if(await store.isOptedOut(message.author.id)){
    await message.reply({content:'You have opted out of Noam AI data processing. Use !noam-optin if you want to participate again.',allowedMentions:{parse:[]}});
    return true;
  }
  if(!config.enabled){
    await message.reply({content:'Noam AI is not configured yet. Please notify a server administrator.',allowedMentions:{parse:[]}});
    return true;
  }
  const now=Date.now();
  if(now-(cooldowns.get(message.author.id)||0)<config.cooldownMs||activeUsers.has(message.author.id)) return true;
  activeUsers.add(message.author.id); cooldowns.set(message.author.id,now);
  try{
    await message.channel.sendTyping().catch(()=>{});
    const history=await store.getHistory(message.channelId,message.author.id);
    const knowledge=await store.searchKnowledge(message.guild.id,message.content,6);
    const examples=await store.recentNoamMessages(message.guild.id,config.noamUserIds,8);
    const rankingContext=await ranking.getRankingContext(message.guild);
    const reply=await ai.generateReply({question:message.content.slice(0,2000),history,knowledge,noamExamples:examples,rankingContext,
      memberName:message.member?.displayName||message.author.username});
    await sendAsNoam(message.channel,reply);
    await store.saveHistory(message.channelId,message.author.id,[...history,
      {role:'user',content:message.content.slice(0,2000)},{role:'assistant',content:reply}]);
  }catch(error){
    console.error('[NoamAI] Chat response failed:',{category:error?.category||'unknown',httpStatus:error?.httpStatus||null,apiCode:error?.apiCode||null,finishReason:error?.finishReason||null,usageMetadata:error?.usageMetadata||null,message:error?.message||String(error)});
    await message.reply({content:'I ran into a problem generating a response. Please try again in a little while.',allowedMentions:{parse:[]}}).catch(()=>{});
  }finally{activeUsers.delete(message.author.id);}
  return true;
}
async function handleMessage(message){
  if(!message.guild||message.author.bot||message.webhookId) return false;
  if(await handleOptCommands(message)) return true;
  if(await handleAdminCommands(message)) return true;
  if(message.guild.id===config.guildId){
    await collector.storeLiveMessage(message).catch(error=>console.error('[NoamAI] Live collection failed:',error?.message||error));
  }
  return handleChat(message);
}
async function handleMessageDelete(message){
  if(!message?.id) return;
  await store.deleteMessage(message.id).catch(error=>console.error('[NoamAI] Deleted-message cleanup failed:',error?.message||error));
}
module.exports={migrate,handleMessage,handleMessageDelete};
