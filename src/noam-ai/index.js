const { PermissionFlagsBits, WebhookClient } = require('discord.js');
const { randomUUID } = require('crypto');
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
async function handleKnowledgeCommands(message,command){
  if(command==='!noam-knowledge-list'){
    const docs=await store.listCuratedKnowledge(message.guild.id,15);
    const lines=['**Curated NRR knowledge** ('+docs.length+' recent entries)'];
    lines.push(...docs.map(doc=>'#'+doc.id+' ['+doc.category+'] '+doc.title));
    if(!docs.length) lines.push('No curated entries yet. Add one with !noam-knowledge-add category | title | content');
    await message.reply({content:lines.join('\n').slice(0,1900),allowedMentions:{parse:[]}});
    return true;
  }
  if(command.startsWith('!noam-knowledge-delete ')){
    const id=Number.parseInt(command.slice('!noam-knowledge-delete '.length).trim(),10);
    if(!Number.isSafeInteger(id)||id<1){await message.reply({content:'Usage: !noam-knowledge-delete ID',allowedMentions:{parse:[]}});return true;}
    const deleted=await store.deleteCuratedKnowledge(message.guild.id,id);
    await message.reply({content:deleted?'✅ Deleted curated knowledge entry #'+id+'.':'No curated knowledge entry with that ID was found.',allowedMentions:{parse:[]}});
    return true;
  }
  if(command.startsWith('!noam-knowledge-add ')){
    const raw=message.content.slice('!noam-knowledge-add '.length);
    const parts=raw.split('|').map(value=>value.trim());
    if(parts.length<3||!parts[0]||!parts[1]||!parts.slice(2).join(' | ')){
      await message.reply({content:'Usage: !noam-knowledge-add category | title | content\nExample: !noam-knowledge-add history | NRR founding | Add verified facts and dates here.',allowedMentions:{parse:[]}});
      return true;
    }
    const [category,title,...contentParts]=parts;
    const content=contentParts.join(' | ');
    if(content.length<20){await message.reply({content:'Please provide at least 20 characters of factual content. Add one focused topic per entry.',allowedMentions:{parse:[]}});return true;}
    const saved=await store.addCuratedKnowledge(message.guild.id,category,title,content,message.author.id);
    await message.reply({content:'✅ Added curated NRR knowledge #'+saved.id+' — **'+saved.title+'**. Curated entries receive the highest retrieval priority.',allowedMentions:{parse:[]}});
    return true;
  }
  return false;
}
async function handleDirectoryCommands(message,command) {
  if(command==='!noam-member-list') {
    const members=await store.listDirectoryMembers(message.guild.id,30);
    const lines=['**NRR member directory**'];
    lines.push(...members.map(x=>x.discord_id+' — '+x.display_name+' | '+x.position+' | '+x.group_name+' | rank '+x.authority_rank+' | '+x.status));
    if(!members.length) lines.push('Directory is empty. Add verified records with !noam-member-set.');
    await message.reply({content:lines.join('\n').slice(0,1900),allowedMentions:{parse:[]}});
    return true;
  }
  if(command.startsWith('!noam-member-delete ')) {
    const id=command.slice('!noam-member-delete '.length).trim().replace(/[<@!>]/g,'');
    if(!/^\d{17,20}$/.test(id)){await message.reply({content:'Usage: !noam-member-delete DISCORD_ID',allowedMentions:{parse:[]}});return true;}
    const removed=await store.deleteDirectoryMember(message.guild.id,id);
    await message.reply({content:removed?'✅ Directory record deleted.':'No directory record found for that Discord ID.',allowedMentions:{parse:[]}});
    return true;
  }
  if(command.startsWith('!noam-member-set ')) {
    const parts=message.content.slice('!noam-member-set '.length).split('|').map(x=>x.trim());
    if(parts.length<8) {
      await message.reply({content:'Usage: !noam-member-set @user | position | group | authority rank | active/former/community | aliases (comma-separated) | bio | achievements\nLower rank number = higher authority. Use verified, non-sensitive information only.',allowedMentions:{parse:[]}});
      return true;
    }
    const id=(parts[0].match(/\d{17,20}/)||[])[0];
    const rank=Number.parseInt(parts[3],10);
    const status=parts[4].toLowerCase();
    if(!id||!parts[1]||!parts[2]||!Number.isInteger(rank)||rank<1||rank>100||!['active','former','community'].includes(status)) {
      await message.reply({content:'Invalid record. Provide a Discord user mention/ID, position, group, rank 1–100, and status active/former/community.',allowedMentions:{parse:[]}});
      return true;
    }
    const record={discordId:id,displayName:parts[0].replace(/<@!?\d{17,20}>/,'').trim()||id,
      position:parts[1],groupName:parts[2],authorityRank:rank,status,
      aliases:parts[5]?parts[5].split(',').map(x=>x.trim()).filter(Boolean).slice(0,10):[],
      bio:parts[6].slice(0,700),achievements:parts.slice(7).join(' | ').slice(0,700)};
    try {
      const member=await message.guild.members.fetch(id).catch(()=>null);
      if(member) record.displayName=member.displayName;
    } catch {}
    const saved=await store.upsertDirectoryMember(message.guild.id,record,message.author.id);
    await message.reply({content:'✅ Saved '+saved.display_name+' — '+saved.position+' (authority rank '+saved.authority_rank+').',allowedMentions:{parse:[]}});
    return true;
  }
  return false;
}
async function runDiagnostics(message) {
  const lines=['**Noam AI diagnostics**'];
  lines.push('Configuration: '+(config.enabled?'✅ API key and model variables are present':'❌ GEMINI_API_KEY or GEMINI_MODEL is missing'));
  try {
    const dbHealth=await store.databaseCheck();
    lines.push('PostgreSQL: ✅ Connected ('+dbHealth.database_name+'/'+dbHealth.schema_name+')');
    lines.push('Schema tables: ✅ '+['knowledge_table','curated_table','directory_table','conversations_table','optouts_table'].length+'/5 present');
    lines.push('Search vectors: '+(Object.values(dbHealth.searchVectors||{}).every(value=>Number(value)===0)?'✅ no NULL vectors':'⚠️ '+JSON.stringify(dbHealth.searchVectors)));
  } catch(error) {
    lines.push('PostgreSQL/schema: ❌ '+String(error?.message||error).slice(0,180));
    if(error?.diagnostics?.missing?.length) lines.push('Missing tables: '+error.diagnostics.missing.join(', '));
    lines.push('Database error code: '+String(error?.code||'unknown'));
  }
  lines.push('Directory search function: '+(typeof store.searchDirectory==='function'?'✅ exported':'❌ missing export'));
  lines.push('Knowledge search function: '+(typeof store.searchKnowledge==='function'?'✅ exported':'❌ missing export'));
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
    lines.push('Knowledge database: ✅ '+Number(stats.total||0).toLocaleString()+' Discord messages; '+Number(stats.channels||0)+' channels; '+Number(stats.curated_count||0)+' curated entries');
    lines.push('Historical targets: '+Number(stats.completed_channels||0)+' completed / '+Number(stats.total_targets||0)+' discovered; '+Number(stats.failed_channels||0)+' failed');
    if(Number(stats.failed_channels||0)>0) lines.push('Latest target error: '+String(stats.failures?.[0]?.last_error||'See server logs').slice(0,150));
    lines.push('Thread discovery errors: '+Number(stats.discovery_error_count||0));
    if(stats.discovery_failures?.[0]) lines.push('Latest discovery error: '+String(stats.discovery_failures[0].stage+': '+stats.discovery_failures[0].error).slice(0,150));
    lines.push('Official Discord sources configured: '+config.officialChannelIds.length);
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
  }
  await message.reply({content:lines.join('\n').slice(0,1900),allowedMentions:{parse:[]}});
}
async function handleAdminCommands(message){
  if(message.guild?.id!==config.guildId) return false;
  const command=message.content.trim();
  const normalized=command.toLowerCase();
  const knowledgeCommand=normalized==='!noam-knowledge-list'||normalized.startsWith('!noam-knowledge-add ')||normalized.startsWith('!noam-knowledge-delete ');
  const directoryCommand=normalized==='!noam-member-list'||normalized.startsWith('!noam-member-set ')||normalized.startsWith('!noam-member-delete ');
  if(!['!noam-collect','!noam-status','!noam-diagnose'].includes(normalized)&&!knowledgeCommand&&!directoryCommand) return false;
  if(!isManager(message)){await message.reply({content:'You need Manage Server permission to use this control.',allowedMentions:{parse:[]}});return true;}
  if(knowledgeCommand){await handleKnowledgeCommands(message,normalized);return true;}
  if(directoryCommand){await handleDirectoryCommands(message,normalized);return true;}
  if(normalized==='!noam-diagnose'){ await runDiagnostics(message); return true; }
  if(normalized==='!noam-status'){
    const s=await store.collectionStats();
    await message.reply({content:[
      '**Noam AI knowledge status**','Stored Discord messages: '+Number(s.total||0).toLocaleString(),
      'Curated knowledge entries: '+Number(s.curated_count||0),'Noam messages: '+Number(s.noam_messages||0).toLocaleString(),
      'Channels indexed: '+Number(s.channels||0),'Historical targets completed: '+Number(s.completed_channels||0)+'/'+Number(s.total_targets||0),
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
  const requestId=randomUUID();
  const startedAt=Date.now();
  let stage='typing';
  const timings={};
  const mark=(name,at)=>{timings[name]=Date.now()-at;};
  try{
    let at=Date.now();
    await message.channel.sendTyping().catch(()=>{});
    mark('typing',at);
    stage='conversation_history';
    at=Date.now();
    const history=await store.getHistory(message.channelId,message.author.id);
    mark('conversation_history',at);
    stage='knowledge_retrieval';
    at=Date.now();
    const knowledge=await store.searchKnowledge(message.guild.id,message.content,10,config.officialChannelIds);
    mark('knowledge_retrieval',at);
    stage='member_directory_lookup';
    at=Date.now();
    const directory=await store.searchDirectory(message.guild.id,message.content,12);
    mark('member_directory_lookup',at);
    stage='noam_style_examples';
    at=Date.now();
    const examples=await store.recentNoamMessages(message.guild.id,config.noamUserIds,8);
    mark('noam_style_examples',at);
    stage='ranking_context';
    at=Date.now();
    const rankingContext=await ranking.getRankingContext(message.guild);
    mark('ranking_context',at);
    stage='gemini_generation';
    at=Date.now();
    const reply=await ai.generateReply({question:message.content.slice(0,2000),history,knowledge,directory,noamExamples:examples,rankingContext,
      memberName:message.member?.displayName||message.author.username});
    mark('gemini_generation',at);
    stage='discord_webhook_delivery';
    at=Date.now();
    await sendAsNoam(message.channel,reply);
    mark('discord_webhook_delivery',at);
    stage='conversation_history_save';
    at=Date.now();
    await store.saveHistory(message.channelId,message.author.id,[...history,
      {role:'user',content:message.content.slice(0,2000)},{role:'assistant',content:reply}]);
    mark('conversation_history_save',at);
    console.log('[NoamAI][CHAT_OK]',{requestId,stage:'complete',totalMs:Date.now()-startedAt,timings,
      knowledgeHits:knowledge.length,directoryHits:directory.length,styleExamples:examples.length,replyLength:reply.length});
  }catch(error){
    const diagnostic={
      requestId,stage,totalMs:Date.now()-startedAt,timings,
      category:error?.category||'internal_error',name:error?.name||'Error',
      message:String(error?.message||error).slice(0,500),code:error?.code||null,
      httpStatus:error?.httpStatus||null,apiCode:error?.apiCode||null,
      finishReason:error?.finishReason||null,usageMetadata:error?.usageMetadata||null,
      stack:String(error?.stack||'').split('\\n').slice(0,6).join(' | '),
    };
    console.error('[NoamAI][CHAT_FAILURE]',diagnostic);
    await message.reply({content:'I ran into a problem generating a response. Please try again in a little while. (Ref: '+requestId.slice(0,8)+')',allowedMentions:{parse:[]}}).catch(replyError=>{
      console.error('[NoamAI][ERROR_NOTICE_FAILURE]',{requestId,message:String(replyError?.message||replyError).slice(0,250)});
    });
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
