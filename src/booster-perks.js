const {SlashCommandBuilder,ContextMenuCommandBuilder,ApplicationCommandType,PermissionFlagsBits,MessageFlags,ContainerBuilder,TextDisplayBuilder,SeparatorBuilder,SeparatorSpacingSize,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
const crypto=require('node:crypto');
const sharp=require('sharp');
const db=require('./db');
const {config}=require('./config');
const PREFIX='booster:';
const commands=[
 new SlashCommandBuilder().setName('booster-perks').setDescription('View your NRR booster customization perks.'),
 new SlashCommandBuilder().setName('booster-emoji').setDescription('Create one of your two custom NRR emojis.')
  .addStringOption(o=>o.setName('name').setDescription('Emoji name.').setRequired(true).setMaxLength(32))
  .addAttachmentOption(o=>o.setName('image').setDescription('Image to upload.'))
  .addStringOption(o=>o.setName('source_emoji').setDescription('Paste a custom Discord emoji such as <:name:id>.').setMaxLength(100)),
 new SlashCommandBuilder().setName('booster-sticker').setDescription('Create your custom NRR sticker.')
  .addStringOption(o=>o.setName('name').setDescription('Sticker name.').setRequired(true).setMaxLength(30))
  .addAttachmentOption(o=>o.setName('image').setDescription('PNG, APNG, or Lottie JSON.').setRequired(true))
  .addStringOption(o=>o.setName('description').setDescription('Optional description.').setMaxLength(100))
  .addStringOption(o=>o.setName('tags').setDescription('Unicode emoji tag. Defaults to ✨').setMaxLength(20)),
 new ContextMenuCommandBuilder().setName('Create NRR Emoji from Message').setType(ApplicationCommandType.Message),
 new ContextMenuCommandBuilder().setName('Create NRR Sticker from Message').setType(ApplicationCommandType.Message)
];
const targetGuild=()=>config.guildId||null;
const text=s=>new TextDisplayBuilder().setContent(s);
const inNrr=i=>Boolean(targetGuild()&&i.guildId===targetGuild()&&i.guild);
const isBooster=m=>Boolean(m&&m.premiumSince);
async function migrate(){
 await db.query("CREATE TABLE IF NOT EXISTS nrr_booster_perk_accounts(guild_id TEXT NOT NULL,user_id TEXT NOT NULL,session_id TEXT NOT NULL,boost_started_at TIMESTAMPTZ NOT NULL,emoji_used INTEGER NOT NULL DEFAULT 0 CHECK(emoji_used BETWEEN 0 AND 2),sticker_used INTEGER NOT NULL DEFAULT 0 CHECK(sticker_used BETWEEN 0 AND 1),eligible BOOLEAN NOT NULL DEFAULT TRUE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(guild_id,user_id));CREATE TABLE IF NOT EXISTS nrr_booster_perk_assets(id BIGSERIAL PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,guild_id TEXT NOT NULL,user_id TEXT NOT NULL,session_id TEXT NOT NULL,asset_id TEXT,asset_type TEXT NOT NULL CHECK(asset_type IN ('emoji','sticker')),asset_name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','cleanup_pending','deleted','failed')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),deleted_at TIMESTAMPTZ,last_error TEXT);CREATE UNIQUE INDEX IF NOT EXISTS idx_nrr_booster_asset_id ON nrr_booster_perk_assets(guild_id,asset_id) WHERE asset_id IS NOT NULL;CREATE INDEX IF NOT EXISTS idx_nrr_booster_asset_owner ON nrr_booster_perk_assets(guild_id,user_id,status)");
}
async function getAccount(g,u){const r=await db.query('SELECT * FROM nrr_booster_perk_accounts WHERE guild_id=$1 AND user_id=$2',[g,u]);return r.rows[0]||null;}
async function startSession(m){
 if(!isBooster(m))return;
 await db.query('INSERT INTO nrr_booster_perk_accounts(guild_id,user_id,session_id,boost_started_at,emoji_used,sticker_used,eligible) VALUES($1,$2,$3,$4,0,0,TRUE) ON CONFLICT(guild_id,user_id) DO UPDATE SET session_id=EXCLUDED.session_id,boost_started_at=EXCLUDED.boost_started_at,emoji_used=0,sticker_used=0,eligible=TRUE,updated_at=NOW() WHERE nrr_booster_perk_accounts.eligible=FALSE OR nrr_booster_perk_accounts.boost_started_at IS DISTINCT FROM EXCLUDED.boost_started_at',[m.guild.id,m.id,crypto.randomUUID(),m.premiumSince]);
}
async function deleteAsset(g,row){
 try{
  if(!row.asset_id){await db.query("UPDATE nrr_booster_perk_assets SET status='failed' WHERE id=$1",[row.id]);return;}
  if(row.asset_type==='emoji'){const a=await g.emojis.fetch(row.asset_id).catch(e=>e.code===10014?null:Promise.reject(e));if(a)await a.delete('NRR booster perk cleanup');}
  else{const a=await g.stickers.fetch(row.asset_id).catch(e=>e.code===10011?null:Promise.reject(e));if(a)await a.delete('NRR booster perk cleanup');}
  await db.query("UPDATE nrr_booster_perk_assets SET status='deleted',deleted_at=NOW() WHERE id=$1",[row.id]);
 }catch(e){await db.query("UPDATE nrr_booster_perk_assets SET status='cleanup_pending',last_error=$2 WHERE id=$1",[row.id,String(e.message||e).slice(0,1000)]);console.error('[BoosterPerks] cleanup pending',row.asset_id,e);}
}
async function cleanup(g,u){const r=await db.query("SELECT * FROM nrr_booster_perk_assets WHERE guild_id=$1 AND user_id=$2 AND status IN ('active','cleanup_pending')",[g.id,u]);for(const row of r.rows)await deleteAsset(g,row);}
async function endSession(m){await db.query('UPDATE nrr_booster_perk_accounts SET eligible=FALSE,updated_at=NOW() WHERE guild_id=$1 AND user_id=$2',[m.guild.id,m.id]);await cleanup(m.guild,m.id);}
async function retryCleanup(g){if(!g||g.id!==targetGuild())return;const p=await db.query("SELECT * FROM nrr_booster_perk_assets WHERE guild_id=$1 AND status='cleanup_pending' ORDER BY id LIMIT 50",[g.id]);for(const row of p.rows)await deleteAsset(g,row);}
async function syncGuild(g,members){if(!g||g.id!==targetGuild())return;members=members||await g.members.fetch();for(const m of members.values()){if(isBooster(m))await startSession(m);else{const a=await getAccount(g.id,m.id);if(a&&a.eligible)await endSession(m);}}await retryCleanup(g);}
async function onMemberUpdate(oldM,newM){if(!newM.guild||newM.guild.id!==targetGuild())return;const before=oldM.premiumSince?oldM.premiumSince.getTime():null,after=newM.premiumSince?newM.premiumSince.getTime():null;if(before===after)return;if(after)await startSession(newM);else if(before)await endSession(newM);}
async function onMemberRemove(m){if(m.guild&&m.guild.id===targetGuild())await endSession(m);}
async function reserve(g,u,type){const col=type==='emoji'?'emoji_used':'sticker_used',limit=type==='emoji'?2:1;const r=await db.query('UPDATE nrr_booster_perk_accounts SET '+col+'='+col+'+1 WHERE guild_id=$1 AND user_id=$2 AND eligible=TRUE AND '+col+'<$3 RETURNING session_id,'+col,[g,u,limit]);if(r.rowCount)return{ok:true,session:r.rows[0].session_id,used:r.rows[0][col]};const a=await getAccount(g,u);return{ok:false,reason:a&&a.eligible?'limit':'booster'};}
async function release(g,u,type,s){const col=type==='emoji'?'emoji_used':'sticker_used';await db.query('UPDATE nrr_booster_perk_accounts SET '+col+'=GREATEST(0,'+col+'-1) WHERE guild_id=$1 AND user_id=$2 AND session_id=$3 AND eligible=TRUE',[g,u,s]);}
function validName(n,t){const s=String(n||'').trim();return /^[A-Za-z0-9_]{2,}$/.test(s)&&s.length<=(t==='emoji'?32:30);}
function safeCdn(url){try{const u=new URL(url);return u.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname);}catch{return false;}}
async function fetchAsset(url){if(!safeCdn(url))throw new Error('Only Discord-hosted files and assets can be imported.');const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Could not retrieve the source asset.');const b=Buffer.from(await r.arrayBuffer());if(!b.length||b.length>10*1024*1024)throw new Error('Source file is empty or too large.');return{buffer:b,type:r.headers.get('content-type')||''};}
function fileExt(url,type){let p='';try{p=new URL(url).pathname;}catch{}const m=p.match(/\.([a-z0-9]{2,5})$/i);if(m)return m[1].toLowerCase();if(type.includes('gif'))return'gif';if(type.includes('apng'))return'apng';if(type.includes('json'))return'json';if(type.includes('webp'))return'webp';return'png';}
async function makeEmoji(b,e){if(e==='gif'){if(b.length>256*1024)throw new Error('Animated emoji exceeds Discord’s upload limit.');return{attachment:b,name:'emoji.gif'};}const m=await sharp(b).metadata();if(!['png','jpeg','webp'].includes(m.format))throw new Error('Use PNG, JPEG, WebP, or GIF.');const out=await sharp(b).rotate().resize(128,128,{fit:'inside',withoutEnlargement:true}).png({compressionLevel:9,palette:true}).toBuffer();if(out.length>256*1024)throw new Error('Processed emoji exceeds Discord’s upload limit.');return{attachment:out,name:'emoji.png'};}
async function makeSticker(b,e){if(e==='gif'){if(b.length>512*1024)throw new Error('Animated sticker exceeds Discord’s upload limit.');return{attachment:b,name:'sticker.gif'};}if(e==='json'){let j;try{j=JSON.parse(b.toString('utf8'));}catch{throw new Error('Invalid Lottie JSON.');}if(!j.v||!Array.isArray(j.layers)||b.length>100*1024)throw new Error('Invalid or oversized Lottie sticker.');return{attachment:b,name:'sticker.json'};}if(e==='apng'||(e==='png'&&b.indexOf(Buffer.from('acTL'))!==-1)){if(b.length>512*1024)throw new Error('Animated sticker exceeds Discord’s upload limit.');return{attachment:b,name:'sticker.png'};}if(!['png','jpg','webp'].includes(e))throw new Error('Use PNG, APNG, or Lottie JSON for stickers.');const m=await sharp(b).metadata();if(!['png','jpeg','webp'].includes(m.format))throw new Error('Unsupported sticker image.');const out=await sharp(b).rotate().resize(320,320,{fit:'contain',background:{r:0,g:0,b:0,alpha:0},withoutEnlargement:true}).png({compressionLevel:9,palette:true}).toBuffer();if(out.length>512*1024)throw new Error('Processed sticker exceeds 512 KB.');return{attachment:out,name:'sticker.png'};}
function emojisIn(content){const a=[],r=/<(a?):([A-Za-z0-9_]{2,32}):(\d{17,22})>/g;let m;while((m=r.exec(String(content||''))))a.push({label:':'+m[2]+':',url:'https://cdn.discordapp.com/emojis/'+m[3]+'.'+(m[1]?'gif':'png')+'?size=256&quality=lossless',ext:m[1]?'gif':'png'});return a;}
function panel(owner,a){const eu=a?a.emoji_used:0,su=a?a.sticker_used:0,c=new ContainerBuilder().setAccentColor(0x3c3c3d);c.addTextDisplayComponents(text('# ✨ NRR Booster Perks'),text('Available exclusively to active NRR boosters.'));c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));c.addTextDisplayComponents(text('## 🎭 Custom Emojis'),text('**'+(2-eu)+' / 2 available** • '+eu+' used'),text('## 🏷️ Custom Sticker'),text('**'+(1-su)+' / 1 available** • '+su+' used'));c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));c.addTextDisplayComponents(text('**Commands**\n/booster-emoji — Create an emoji\n/booster-sticker — Create a sticker\nRight-click a message → Apps to import from a message.'),text('-# NRR • Booster Customization'));c.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(PREFIX+'refresh:'+owner).setLabel('Refresh quotas').setStyle(ButtonStyle.Secondary)));return c;}
async function showPanel(i){if(!inNrr(i))return i.reply({content:'❌ This perk is available only inside NRR.',ephemeral:true});const m=await i.guild.members.fetch(i.user.id).catch(()=>null);if(!isBooster(m))return i.reply({content:'❌ You must currently boost NRR.',ephemeral:true});await startSession(m);return i.reply({components:[panel(i.user.id,await getAccount(i.guildId,i.user.id))],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral,allowedMentions:{parse:[]}});}
async function createAsset(i,type,name,source,description,tags){
 if(!inNrr(i))return i.reply({content:'❌ This perk is available only inside NRR.',ephemeral:true});if(!validName(name,type))return i.reply({content:'❌ Name must contain 2–'+(type==='emoji'?32:30)+' letters, numbers or underscores.',ephemeral:true});
 const m=await i.guild.members.fetch(i.user.id).catch(()=>null);if(!isBooster(m))return i.reply({content:'❌ You must currently boost NRR.',ephemeral:true});await startSession(m);
 const slot=await reserve(i.guildId,i.user.id,type);if(!slot.ok)return i.reply({content:slot.reason==='limit'?'❌ You have used all '+(type==='emoji'?'emoji':'sticker')+' slots for this boost session.':'❌ Your booster access is inactive.',ephemeral:true});
 let rec=null,created=null;
 try{
  const ins=await db.query("INSERT INTO nrr_booster_perk_assets(request_id,guild_id,user_id,session_id,asset_type,asset_name,status) VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING id",[crypto.randomUUID(),i.guildId,i.user.id,slot.session,type,name]);rec=ins.rows[0];await i.deferReply({ephemeral:true});
  const f=await fetchAsset(source.url),e=source.ext||fileExt(source.url,f.type),bot=i.guild.members.me;if(!bot||!bot.permissions.has(PermissionFlagsBits.ManageGuildExpressions))throw new Error('I need Manage Expressions permission in NRR.');
  if(type==='emoji'){const file=await makeEmoji(f.buffer,e);created=await i.guild.emojis.create({attachment:file.attachment,name,reason:'NRR Booster Perk created by '+i.user.tag});}
  else{const file=await makeSticker(f.buffer,e);created=await i.guild.stickers.create({file:{attachment:file.attachment,name:file.name},name,description:String(description||'').slice(0,100),tags:String(tags||'✨').slice(0,20),reason:'NRR Booster Perk created by '+i.user.tag});}
  await db.query("UPDATE nrr_booster_perk_assets SET asset_id=$2,status='active' WHERE id=$1",[rec.id,created.id]);
  const latest=await getAccount(i.guildId,i.user.id);if(!latest||!latest.eligible||latest.session_id!==slot.session){await deleteAsset(i.guild,{id:rec.id,asset_id:created.id,asset_type:type});return i.editReply({content:'❌ Your boost session ended during creation. The asset was removed.'});}
  return i.editReply({content:'✅ Your custom '+type+' **'+name+'** was created in NRR. Remaining this session: **'+((type==='emoji'?2:1)-slot.used)+'**.',allowedMentions:{parse:[]}});
 }catch(e){if(created&&rec)await deleteAsset(i.guild,{id:rec.id,asset_id:created.id,asset_type:type});else if(rec)await db.query("UPDATE nrr_booster_perk_assets SET status='failed',last_error=$2 WHERE id=$1",[rec.id,String(e.message||e).slice(0,1000)]).catch(()=>{});await release(i.guildId,i.user.id,type,slot.session).catch(()=>{});console.error('[BoosterPerks] creation failed:',e);const p={content:'❌ '+String(e.message||'Creation failed.'),allowedMentions:{parse:[]}};if(i.deferred||i.replied)return i.editReply(p).catch(()=>{});return i.reply({...p,ephemeral:true}).catch(()=>{});}
}
function nameModal(i,type,source){const id=crypto.randomUUID();pending.set(id,{type,source,user:i.user.id});const m=new ModalBuilder().setCustomId(PREFIX+'name:'+id).setTitle('Create NRR '+(type==='emoji'?'Emoji':'Sticker'));m.addComponents({type:1,components:[new TextInputBuilder().setCustomId('name').setLabel('Name for your new '+type).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(type==='emoji'?32:30)]});if(type==='sticker')m.addComponents({type:1,components:[new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)]});return i.showModal(m);}
async function contextImport(i,type){if(!inNrr(i))return i.reply({content:'❌ This action is available only inside NRR.',ephemeral:true});const m=await i.guild.members.fetch(i.user.id).catch(()=>null);if(!isBooster(m))return i.reply({content:'❌ You must currently boost NRR.',ephemeral:true});const msg=i.targetMessage;const sources=type==='emoji'?emojisIn(msg.content):[...msg.stickers.values()].map(s=>({label:s.name,url:s.url,ext:s.format===3?'json':s.format===2?'apng':s.format===4?'gif':'png'}));if(!sources.length)return i.reply({content:'❌ No custom '+type+' found in that message.',ephemeral:true});if(sources.length===1)return nameModal(i,type,sources[0]);pending.set('choices:'+i.user.id,{type,sources,user:i.user.id});const menu=new StringSelectMenuBuilder().setCustomId(PREFIX+'choose:'+i.user.id+':'+type).setPlaceholder('Choose an asset from this message').addOptions(sources.slice(0,25).map((v,n)=>({label:String(v.label||('Asset '+(n+1))).slice(0,100),value:String(n)})));return i.reply({content:'This message contains multiple assets. Choose the one to import:',components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});}
async function handleInteraction(i){
 if(i.isChatInputCommand()){
  if(i.commandName==='booster-perks')return showPanel(i);
  if(i.commandName==='booster-emoji'){const a=i.options.getAttachment('image'),raw=i.options.getString('source_emoji');if(Boolean(a)===Boolean(raw))return i.reply({content:'❌ Provide exactly one source: image attachment or custom emoji.',ephemeral:true});if(a)return createAsset(i,'emoji',i.options.getString('name',true),{url:a.url,ext:fileExt(a.url,a.contentType)});const matches=emojisIn(raw);if(matches.length!==1)return i.reply({content:'❌ Paste exactly one valid custom Discord emoji, such as <:name:123456789012345678>.',ephemeral:true});return createAsset(i,'emoji',i.options.getString('name',true),matches[0]);}
  if(i.commandName==='booster-sticker'){const a=i.options.getAttachment('image',true);return createAsset(i,'sticker',i.options.getString('name',true),{url:a.url,ext:fileExt(a.url,a.contentType)},i.options.getString('description'),i.options.getString('tags'));}
 }
 if(i.isMessageContextMenuCommand()){if(i.commandName==='Create NRR Emoji from Message')return contextImport(i,'emoji');if(i.commandName==='Create NRR Sticker from Message')return contextImport(i,'sticker');}
 if(i.isStringSelectMenu()&&i.customId.startsWith(PREFIX+'choose:')){const p=i.customId.split(':'),owner=p[2],type=p[3];if(owner!==i.user.id)return i.reply({content:'❌ This selection belongs to another member.',ephemeral:true});const item=pending.get('choices:'+owner);if(!item||item.type!==type)return i.reply({content:'❌ This selection expired. Select the message again.',ephemeral:true});const source=item.sources[Number(i.values[0])];pending.delete('choices:'+owner);if(!source)return i.reply({content:'❌ Asset unavailable.',ephemeral:true});return nameModal(i,type,source);}
 if(i.isButton()&&i.customId.startsWith(PREFIX+'refresh:')){const owner=i.customId.split(':')[2];if(owner!==i.user.id)return i.reply({content:'❌ This panel belongs to another member.',ephemeral:true});const m=await i.guild.members.fetch(owner).catch(()=>null);return i.update({components:[panel(owner,m&&isBooster(m)?await getAccount(i.guildId,owner):null)],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral,allowedMentions:{parse:[]}});}
 if(i.isModalSubmit()&&i.customId.startsWith(PREFIX+'name:')){const id=i.customId.split(':')[2],p=pending.get(id);if(!p||p.user!==i.user.id)return i.reply({content:'❌ Import request expired. Select the message again.',ephemeral:true});pending.delete(id);return createAsset(i,p.type,i.fields.getTextInputValue('name'),p.source,p.type==='sticker'?i.fields.getTextInputValue('description'):'','✨');}
 return false;
}
async function handleMessageCreate(message){
 if(!message.guild||message.guild.id!==targetGuild()||message.author.bot||message.webhookId)return false;
 const match=message.content.trim().match(/^!booster-(emoji|sticker)\s+([A-Za-z0-9_]{2,32})$/i);
 if(!match)return false;
 if(!message.reference||!message.reference.messageId){await message.reply('Reply to a message containing one custom emoji or sticker. Usage: !booster-emoji name or !booster-sticker name.');return true;}
 const target=await message.fetchReference().catch(()=>null);
 if(!target){await message.reply('❌ I could not retrieve the message you replied to.');return true;}
 const type=match[1].toLowerCase(),name=match[2];
 let source;
 if(type==='emoji'){
  const sources=emojisIn(target.content);
  if(sources.length!==1){await message.reply(sources.length?'This message contains multiple custom emojis. Use the message Apps menu to choose one.':'I could not find a custom emoji in that message.');return true;}
  source=sources[0];
 }else{
  const stickers=[...target.stickers.values()];
  if(stickers.length!==1){await message.reply(stickers.length?'This message contains multiple stickers. Use the message Apps menu to choose one.':'I could not find a sticker in that message.');return true;}
  const sticker=stickers[0];
  source={url:sticker.url,ext:sticker.format===3?'json':sticker.format===2?'apng':sticker.format===4?'gif':'png'};
 }
 let response=null;
 const fake={
  guild:message.guild,guildId:message.guild.id,user:message.author,deferred:false,replied:false,
  reply:async payload=>{fake.replied=true;return message.reply(typeof payload==='string'?payload:payload.content);},
  deferReply:async()=>{fake.deferred=true;response=await message.reply('⏳ Processing your booster asset...');},
  editReply:async payload=>response?response.edit(payload):message.reply(payload.content),
 };
 await createAsset(fake,type,name,source,'','✨');
 return true;
}

function handles(i){return (i.isChatInputCommand()&&['booster-perks','booster-emoji','booster-sticker'].includes(i.commandName))||(i.isMessageContextMenuCommand()&&['Create NRR Emoji from Message','Create NRR Sticker from Message'].includes(i.commandName))||(i.isButton()&&i.customId.startsWith(PREFIX))||(i.isStringSelectMenu()&&i.customId.startsWith(PREFIX))||(i.isModalSubmit()&&i.customId.startsWith(PREFIX));}
module.exports={commands,migrate,syncGuild,retryCleanup,onMemberUpdate,onMemberRemove,handleMessageCreate,handles,handleInteraction};
