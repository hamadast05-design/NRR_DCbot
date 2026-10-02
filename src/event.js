const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, LabelBuilder, FileUploadBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { config } = require('./config');

const SUBMIT = 'event_submit:';
const REVIEW = 'event_review:';

function isManager(i) {
  if (config.eventManagerRoleIds.length) return config.eventManagerRoleIds.some(id => i.member?.roles?.cache?.has(id));
  return i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}
async function requireManager(i) { if (!isManager(i)) { await i.reply({content:'❌ You do not have permission to manage event submissions.',ephemeral:true}); return false; } return true; }
function interfacePayload(eventId) {
  return { embeds:[new EmbedBuilder().setTitle('📤 Event Submissions').setDescription('Click the button below to submit your entry for the ongoing contest.').setColor(0x5865f2).setFooter({text:'Entries are reviewed before publication.'})], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(SUBMIT+eventId).setLabel('Submit Entry').setEmoji('📤').setStyle(ButtonStyle.Primary))] };
}
function reviewEmbed(s,status) {
  return new EmbedBuilder().setTitle('📥 Submission Pending Review').setDescription('**Submitter:** <@'+s.submitter_id+'>\n**Event:** #'+s.event_id+'\n**Submitted:** <t:'+Math.floor(new Date(s.submitted_at).getTime()/1000)+':F>\n**Status:** '+status).setImage(s.image_url).setColor(status==='pending'?0x5865f2:status==='rejected'?0xe74c3c:0x57f287);
}
function reviewRow(id) { return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(REVIEW+'approve:'+id).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(REVIEW+'reject:'+id).setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger)); }

async function createEvent(i) {
  if (!(await requireManager(i))) return;
  const id=i.options.getString('channel_id',true).trim(); const ch=await i.guild.channels.fetch(id).catch(()=>null);
  if (!ch?.isTextBased()) return i.reply({content:'❌ That channel could not be found or is not a text channel.',ephemeral:true});
  const e=await db.createEvent({guildId:i.guildId,destinationChannelId:ch.id,creatorId:i.user.id});
  await i.reply({content:'✅ Event created successfully.\n\nSubmissions will be posted in <#'+ch.id+'>.\nEvent ID: **'+e.id+'**',ephemeral:true});
}
async function send(i) {
  if (!(await requireManager(i))) return; const id=i.options.getString('channel_id',true).trim();
  const ch=await i.guild.channels.fetch(id).catch(()=>null); if(!ch?.isTextBased()) return i.reply({content:'❌ That channel could not be found or is not a text channel.',ephemeral:true});
  const e=await db.getActiveEvent(i.guildId); if(!e) return i.reply({content:'❌ There is no active event. Use /createevent first.',ephemeral:true});
  const m=await ch.send(interfacePayload(e.id)); await db.recordEventInterface(e.id,ch.id,m.id);
  await i.reply({content:'✅ Submission message sent in <#'+ch.id+'>.',ephemeral:true});
}
async function stick(i) {
  if (!(await requireManager(i))) return; const id=i.options.getString('channel_id',true).trim(); const ch=await i.guild.channels.fetch(id).catch(()=>null);
  if(!ch?.isTextBased()) return i.reply({content:'❌ That channel could not be found or is not a text channel.',ephemeral:true});
  const e=await db.getActiveEvent(i.guildId); if(!e) return i.reply({content:'❌ There is no active event.',ephemeral:true});
  await db.setStickChannel(e.id,ch.id); const old=await db.getEventInterface(e.id);
  if(old){const oc=await i.guild.channels.fetch(old.channel_id).catch(()=>null); const om=await oc?.messages.fetch(old.message_id).catch(()=>null); if(om) await om.delete().catch(()=>{});}
  const m=await ch.send(interfacePayload(e.id)); await db.recordEventInterface(e.id,ch.id,m.id);
  await i.reply({content:'📌 Submission message is now stuck in <#'+ch.id+'>.',ephemeral:true});
}
async function showModal(i,eventId){
  const e=await db.getEvent(eventId,i.guildId); if(!e||!e.active) return i.reply({content:'❌ This event is no longer active.',ephemeral:true});
  const modal=new ModalBuilder().setCustomId(SUBMIT+'modal:'+eventId).setTitle('Submit Contest Entry');
  const upload=new FileUploadBuilder().setCustomId('submission_image').setMinValues(1).setMaxValues(1).setRequired(true).setFileTypes('image');
  modal.addLabelComponents(new LabelBuilder().setLabel('Upload your contest image').setDescription('Submit one image. It will be reviewed before publication.').setFileUploadComponent(upload));
  await i.showModal(modal);
}
async function submit(i,eventId){
  const e=await db.getEvent(eventId,i.guildId); if(!e||!e.active) return i.reply({content:'❌ This event is no longer active.',ephemeral:true});
  const files=i.fields.getUploadedFiles('submission_image',true); const a=files?.first();
  if(!a||!a.contentType?.startsWith('image/')) return i.reply({content:'❌ Please upload a valid image.',ephemeral:true});
  const s=await db.createSubmission({eventId:e.id,guildId:i.guildId,submitterId:i.user.id,imageUrl:a.url,imageName:a.name,submittedAt:new Date()});
  const reviewId=config.eventReviewChannelId||e.destination_channel_id; const rc=await i.guild.channels.fetch(reviewId).catch(()=>null);
  if(rc?.isTextBased()){const msg=await rc.send({content:config.eventManagerRoleIds.map(x=>'<@&'+x+'>').join(' ')||undefined,embeds:[reviewEmbed(s,'pending')],components:[reviewRow(s.id)]}).catch(()=>null); if(msg) await db.setReviewMessage(s.id,rc.id,msg.id);}
  await i.reply({content:'✅ Your submission has been received and is now pending review. If no manager acts within 3 hours, it will be automatically approved.',ephemeral:true});
}
async function publish(client,s){
  const e=await db.getEvent(s.event_id,s.guild_id); if(!e||!e.active)return false; const ch=await client.channels.fetch(e.destination_channel_id).catch(()=>null); if(!ch?.isTextBased())return false;
  try{const m=await ch.send({embeds:[new EmbedBuilder().setTitle('📸 Event Submission').setDescription('**Submitted by:** <@'+s.submitter_id+'>').setImage(s.image_url).setColor(0x5865f2).setTimestamp(new Date(s.submitted_at))]}); await m.react('🌟').catch(()=>{}); await db.setPublishedMessage(s.id,m.id,ch.id); return true;}catch{return false;}
}
async function review(i,action,id){
  if(!(await requireManager(i)))return; const s=await db.getSubmission(id); if(!s||s.guild_id!==i.guildId)return i.reply({content:'❌ Submission not found.',ephemeral:true});
  if(s.status!=='pending')return i.reply({content:'ℹ️ This submission has already been '+s.status+'.',ephemeral:true});
  if(action==='reject'){const ok=await db.rejectSubmission(id,i.user.id);if(!ok)return i.reply({content:'ℹ️ This submission was already processed.',ephemeral:true});await i.update({embeds:[reviewEmbed(s,'rejected')],components:[]});const u=await i.client.users.fetch(s.submitter_id).catch(()=>null);await u?.send('❌ Your event submission was not approved by the event managers.').catch(()=>{});return;}
  const ok=await db.claimSubmission(id,'approved',i.user.id);if(!ok)return i.reply({content:'ℹ️ This submission was already processed.',ephemeral:true});await i.update({embeds:[reviewEmbed(s,'approved')],components:[]});
  const fresh=await db.getSubmission(id); const done=await publish(i.client,fresh); if(!done) await i.followUp({content:'❌ The submission was approved but could not be published.',ephemeral:true}).catch(()=>{});
}
async function autoApprove(client){const rows=await db.getDueSubmissions();for(const s of rows){const ok=await db.claimSubmission(s.id,'auto-approved',null);if(ok)await publish(client,s);}}
async function end(i){
  if(!(await requireManager(i)))return; const e=await db.getActiveEvent(i.guildId);if(!e)return i.reply({content:'❌ There is no active event.',ephemeral:true});
  const rows=await db.getEventBotMessages(e.id);let n=0;for(const r of rows){const c=await i.guild.channels.fetch(r.channel_id).catch(()=>null);const m=await c?.messages.fetch(r.message_id).catch(()=>null);if(m?.author?.id===i.client.user.id){await m.delete().then(()=>n++).catch(()=>{});}}
  await db.endEvent(e.id);await i.reply({content:'✅ Event ended. Removed **'+n+'** bot messages associated with the event.',ephemeral:true});
}
async function onMessage(message){
  if(!config.eventStickEnabled||message.author.bot||!message.guild)return; const e=await db.getActiveEvent(message.guild.id);if(!e||e.stick_channel_id!==message.channel.id)return;const old=await db.getEventInterface(e.id);if(!old||old.message_id===message.id)return;
  const om=await message.channel.messages.fetch(old.message_id).catch(()=>null);if(om)await om.delete().catch(()=>{});const m=await message.channel.send(interfacePayload(e.id)).catch(()=>null);if(m)await db.recordEventInterface(e.id,message.channel.id,m.id);
}
module.exports={createEvent,send,stick,showModal,submit,review,autoApprove,end,onMessage};