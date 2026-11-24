const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, EmbedBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, FileUploadBuilder,
} = require('discord.js');
const db = require('./db');
const crust = require('./crust');
const { config } = require('./config');

const CHANNELS = { panel:'1574128024201330739', submissions:'1574130457790914632', audit:'1574130497515298998' };
const STAFF_ROLE = '1524356504575148132';
const TZ = 'Asia/Riyadh';
const text = s => new TextDisplayBuilder().setContent(s);
const btn = (id,label,style=ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const seed = [
['The Welcomer','Welcome a new member and help them get familiar with the community.',10],
['Conversation Starter','Start an interesting discussion in General and encourage others to participate.',10],
['Active Participant','Meaningfully participate in an existing community conversation.',9],
['Conversation Reviver','Revive an inactive conversation and encourage members to participate again.',8],
['Friendly Debater','Participate in a constructive debate while maintaining respectful discussion.',8],
['Community Connector','Have meaningful interactions with at least two different community members.',9],
['Storyteller','Share a harmless personal anecdote or experience with the community.',9],
['Community Helper','Help another member with a question or problem.',8],
['The Guide','Guide a newcomer and help them understand how the community works.',10],
['Feature Explainer','Explain an NRR feature to another community member.',9],
['Peacekeeper','Help resolve a minor misunderstanding between community members.',8],
['Troubleshooter','Help resolve a technical issue or server-related problem.',9],
['Useful Resource',"Share a useful resource that answers a member's question or helps them.",9],
['Knowledge Sharer','Explain a rule or feature that another member misunderstands.',8],
['Idea Contributor','Suggest an interesting discussion topic or community improvement.',8],
['Community Researcher','Gather feedback from community members about an NRR feature.',6],
['Bug Reporter','Report a game issue affecting the server or its features.',10],
['Innovation Thinker','Propose a new feature or activity for the NRR community.',10],
['Channel Organizer','Identify and suggest an improvement to channel usability or organization.',10],
['Suggestion Follow-up','Gather additional opinions from members about an existing suggestion.',7],
['Game Night','Participate in a community game or activity.',8],
['Quizmaster','Host a quiz or trivia activity for community members using the NRR Bot Game Panel (with ping).',17],
];
const staffCommand = new SlashCommandBuilder().setName('staff_quests').setDescription('Privately view your current Daily Community Staff Quests.');
const adminCommand = new SlashCommandBuilder().setName('staff_quests_admin').setDescription('Open the administrator-only Staff Quests management panel.')
 .addUserOption(o=>o.setName('user').setDescription('Inspect a staff member quest history (administrators only).'));
let client;
let schedulerRunning=false;
const dayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const admin = i => Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
const v2 = (c,ephemeral=false) => ({components:[c],flags:MessageFlags.IsComponentsV2|(ephemeral?MessageFlags.Ephemeral:0),allowedMentions:{parse:[]}});
const resetTimestamp=day=>{const [y,m,d]=String(day||dayKey()).slice(0,10).split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d+1,-3,0,0)/1000);};
const preferenceLabels={dm:'Daily quest DMs',none:'Daily quest notifications disabled',ping:'Temporary server pings in the quest panel'};
async function getNotificationPreference(g,u){const r=await db.query('SELECT preference FROM staff_quest_notification_preferences WHERE guild_id=$1 AND user_id=$2',[g,u]);return r.rows[0]?.preference||'dm';}
async function setNotificationPreference(g,u,p){await db.query('INSERT INTO staff_quest_notification_preferences(guild_id,user_id,preference) VALUES($1,$2,$3) ON CONFLICT(guild_id,user_id) DO UPDATE SET preference=EXCLUDED.preference,updated_at=NOW()',[g,u,p]);}
function notificationSettingsPanel(p){const c=new ContainerBuilder().setAccentColor(0xffffff);c.addTextDisplayComponents(text('# ◈ Notification Preferences'),text('Choose how you receive daily quest notifications.\n**Current setting:** '+preferenceLabels[p]));c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:notify:dm','Receive Bot DMs',ButtonStyle.Secondary),btn('staffquest:notify:none','Stop Bot DMs',ButtonStyle.Secondary),btn('staffquest:notify:ping','Receive Server Pings Instead',ButtonStyle.Secondary)));return c;}
function dailyQuestEmbed(guild,quests,day){const reset=resetTimestamp(day),embed=new EmbedBuilder().setColor(0xffffff).setTitle('◈ Daily Community Staff Quests').setDescription('Your individual quests for today are ready. Complete at least one to meet the daily requirement, or complete all three to earn every reward.').setFooter({text:'Resets <t:'+reset+':t> • <t:'+reset+':R>'});const icon=guild?.iconURL?.({size:128});if(icon)embed.setThumbnail(icon);for(const q of quests)embed.addFields({name:'◈ '+q.quest_name+' · `'+q.reward+' SP`',value:'-# '+q.quest_description,inline:false});return embed;}
async function sendDailyNotification(guild,member,quests,day){
 const preference=await getNotificationPreference(guild.id,member.id);if(preference==='none')return {skipped:true};
 const claim=await db.query("INSERT INTO staff_quest_notification_deliveries(guild_id,quest_day,user_id,status) VALUES($1,$2,$3,'sending') ON CONFLICT(guild_id,quest_day,user_id) DO NOTHING RETURNING user_id",[guild.id,day,member.id]);
 if(!claim.rowCount){const prior=await db.query('SELECT status,updated_at FROM staff_quest_notification_deliveries WHERE guild_id=$1 AND quest_day=$2 AND user_id=$3',[guild.id,day,member.id]),row=prior.rows[0];if(row?.status==='sent')return {skipped:true};if(row?.status==='sending'&&Date.now()-new Date(row.updated_at).getTime()<300000)return {skipped:true};await db.query("UPDATE staff_quest_notification_deliveries SET status='sending',updated_at=NOW() WHERE guild_id=$1 AND quest_day=$2 AND user_id=$3",[guild.id,day,member.id]);}
 try{
  if(preference==='ping'){const channel=await guild.channels.fetch(CHANNELS.panel).catch(()=>null);if(!channel?.send)throw Error('Quest panel channel unavailable');const message=await channel.send({content:'<@'+member.id+'>',allowedMentions:{parse:[],users:[member.id]}});setTimeout(()=>message.delete().catch(()=>{}),5000).unref?.();await db.query("UPDATE staff_quest_notification_deliveries SET status='sent',channel_id=$4,message_id=$5,delivered_at=NOW(),updated_at=NOW() WHERE guild_id=$1 AND quest_day=$2 AND user_id=$3",[guild.id,day,member.id,channel.id,message.id]);return {sent:true};}
  const view=new ActionRowBuilder().addComponents(btn('staffquest:mine:'+guild.id,'◈ View Progress & Submit',ButtonStyle.Secondary));
  const prefs=new ActionRowBuilder().addComponents(btn('staffquest:notify:'+guild.id+':none','Stop Bot DMs',ButtonStyle.Secondary),btn('staffquest:notify:'+guild.id+':ping','Receive Server Pings Instead',ButtonStyle.Secondary));
  const message=await member.send({embeds:[dailyQuestEmbed(guild,quests,day)],components:[view,prefs],allowedMentions:{parse:[]}});
  await db.query("UPDATE staff_quest_notification_deliveries SET status='sent',channel_id=$4,message_id=$5,delivered_at=NOW(),updated_at=NOW() WHERE guild_id=$1 AND quest_day=$2 AND user_id=$3",[guild.id,day,member.id,message.channelId,message.id]);return {sent:true};
 }catch(error){await db.query("UPDATE staff_quest_notification_deliveries SET status='failed',updated_at=NOW() WHERE guild_id=$1 AND quest_day=$2 AND user_id=$3",[guild.id,day,member.id]).catch(()=>{});console.warn('[Staff Quests] Notification delivery failed for '+member.id+' ('+preference+'); no alternate notification was sent:',error.message);return {sent:false};}
}
async function showNotificationSettings(i){return i.reply(v2(notificationSettingsPanel(await getNotificationPreference(i.guildId,i.user.id)),true));}
async function updateNotificationPreference(i,g,p){await setNotificationPreference(g,i.user.id,p);if(i.inGuild())return i.reply({content:'◈ Notification preference saved: **'+preferenceLabels[p]+'**. This applies to future daily quest notifications.',ephemeral:true,allowedMentions:{parse:[]}});const embed=EmbedBuilder.from(i.message.embeds[0]);embed.setFooter({text:preferenceLabels[p]+' • Daily reset <t:'+resetTimestamp(dayKey())+':R>'});return i.update({embeds:[embed],components:i.message.components,allowedMentions:{parse:[]}});}
const auditColors={quest_created:0x2ecc71,submission_approved:0x2ecc71,quest_edited:0xf1c40f,quest_toggled:0xf1c40f,quest_deleted:0xe74c3c,submission_rejected:0xe74c3c,submission_needs_evidence:0xe67e22,submission_created:0x3498db,payout_status_updated:0x3498db,payout_manual_retry:0x3498db};
const auditTitle=action=>({quest_created:'Quest Created',quest_edited:'Quest Edited',quest_toggled:'Quest Availability Changed',quest_deleted:'Quest Deleted',submission_created:'Submission Received',submission_approved:'Submission Approved',submission_rejected:'Submission Rejected',submission_needs_evidence:'More Evidence Requested',payout_status_updated:'Payout Status Updated',payout_manual_retry:'Manual Payout Retry'}[action]||String(action).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
const auditValue=value=>value===null||value===undefined||value===''?'—':typeof value==='object'?JSON.stringify(value):String(value);
const audit = async (guildId,actor,action,details) => {
 details=details||{};
 await db.query('INSERT INTO staff_quest_audit_logs(guild_id,actor_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[guildId,actor,action,JSON.stringify(details)]);
 const guild=client?.guilds.cache.get(guildId),channel=await guild?.channels.fetch(CHANNELS.audit).catch(()=>null);if(!channel?.send)return;
 const embed=new EmbedBuilder().setColor(auditColors[action]||0x3498db).setTitle('Staff Quests • '+auditTitle(action)).setDescription('**Actor:** <@'+actor+'>').setTimestamp(new Date());
 const fields=[];
 if(action==='quest_edited'&&details.before&&details.after){
  for(const key of new Set([...Object.keys(details.before),...Object.keys(details.after)])){
   const before=details.before[key],after=details.after[key];if(JSON.stringify(before)===JSON.stringify(after))continue;
   const label=({name:'Name',description:'Description',reward:'Reward',enabled:'Enabled'}[key]||key);
   fields.push({name:label,value:(auditValue(before)+' → '+auditValue(after)).slice(0,1024),inline:false});
  }
  if(details.questId)fields.push({name:'Quest ID',value:String(details.questId),inline:true});
 }else{
  for(const [key,value] of Object.entries(details)){
   if(key==='before'||key==='after')continue;
   const label=key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
   let formatted=auditValue(value);
   if(key==='userId')formatted='<@'+value+'>\nID: '+value;
   else if(key==='feedback')formatted=String(value).slice(0,1000);
   else if(key==='imageName')formatted=String(value).slice(0,200);
   fields.push({name:label,value:formatted.slice(0,1024),inline:['submissionId','questId','reward','status'].includes(key)});
  }
 }
 if(fields.length)embed.addFields(fields.slice(0,25));
 embed.setFooter({text:'Actor ID: '+actor+(guild?.name?' • '+guild.name:'')});
 await channel.send({embeds:[embed],allowedMentions:{parse:[]} }).catch(()=>{});
};
async function migrate(){
 await db.query(
 'CREATE TABLE IF NOT EXISTS staff_quest_catalogue(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,reward INTEGER NOT NULL CHECK(reward BETWEEN 1 AND 100000),enabled BOOLEAN NOT NULL DEFAULT TRUE,deleted_at TIMESTAMPTZ,created_by TEXT,updated_by TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'+
 'CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_quest_name ON staff_quest_catalogue(LOWER(name)) WHERE deleted_at IS NULL;'+
 'CREATE TABLE IF NOT EXISTS staff_quest_daily_runs(guild_id TEXT NOT NULL,quest_day DATE NOT NULL,generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(guild_id,quest_day));'+
 'CREATE TABLE IF NOT EXISTS staff_quest_assignments(id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,quest_day DATE NOT NULL,user_id TEXT NOT NULL,quest_id BIGINT NOT NULL REFERENCES staff_quest_catalogue(id),quest_name TEXT NOT NULL,quest_description TEXT NOT NULL,reward INTEGER NOT NULL,status TEXT NOT NULL DEFAULT \'assigned\' CHECK(status IN (\'assigned\',\'pending_review\',\'completed\',\'expired\')),last_feedback TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(guild_id,quest_day,user_id,quest_id));'+
 'CREATE INDEX IF NOT EXISTS idx_staff_quest_assignments_day ON staff_quest_assignments(guild_id,user_id,quest_day);'+
 'CREATE TABLE IF NOT EXISTS staff_quest_submissions(id BIGSERIAL PRIMARY KEY,assignment_id BIGINT NOT NULL REFERENCES staff_quest_assignments(id),submitter_id TEXT NOT NULL,evidence TEXT NOT NULL,status TEXT NOT NULL DEFAULT \'pending\' CHECK(status IN (\'pending\',\'approved\',\'rejected\',\'needs_evidence\')),reviewer_id TEXT,feedback TEXT,review_channel_id TEXT,review_message_id TEXT,payout_reference_id TEXT UNIQUE,payout_status TEXT,submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ);'+
 'ALTER TABLE staff_quest_submissions DROP CONSTRAINT IF EXISTS staff_quest_submissions_status_check;'+
 'ALTER TABLE staff_quest_submissions ADD CONSTRAINT staff_quest_submissions_status_check CHECK(status IN (\'pending\',\'approved\',\'rejected\',\'needs_evidence\'));'+
 'CREATE INDEX IF NOT EXISTS idx_staff_quest_pending ON staff_quest_submissions(status,submitted_at);'+
 'CREATE TABLE IF NOT EXISTS staff_quest_audit_logs(id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,details JSONB NOT NULL DEFAULT \'{}\'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'+
 'CREATE TABLE IF NOT EXISTS staff_quest_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);'+
 'CREATE TABLE IF NOT EXISTS staff_quest_notification_preferences(guild_id TEXT NOT NULL,user_id TEXT NOT NULL,preference TEXT NOT NULL DEFAULT \'dm\' CHECK(preference IN (\'dm\',\'none\',\'ping\')),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(guild_id,user_id));'+
 'CREATE TABLE IF NOT EXISTS staff_quest_notification_deliveries(guild_id TEXT NOT NULL,quest_day DATE NOT NULL,user_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT \'sending\' CHECK(status IN (\'sending\',\'sent\',\'failed\')),channel_id TEXT,message_id TEXT,delivered_at TIMESTAMPTZ,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(guild_id,quest_day,user_id));'
 );
 const n=await db.query('SELECT COUNT(*)::int AS n FROM staff_quest_catalogue');
 if(!n.rows[0].n) for(const q of seed) await db.query('INSERT INTO staff_quest_catalogue(name,description,reward,created_by) VALUES($1,$2,$3,$4)',[q[0],q[1],q[2],'system-seed']);
}
async function rows(){const r=await db.query('SELECT id,name,description,reward,enabled FROM staff_quest_catalogue WHERE deleted_at IS NULL ORDER BY id');return r.rows.map(x=>({...x,id:String(x.id),reward:Number(x.reward)}));}
function mainPanel(){
 const c=new ContainerBuilder().setAccentColor(0xffffff),reset=resetTimestamp(dayKey());
 c.addTextDisplayComponents(text('# ◈ NR:R Daily Community Staff Quests'),text('You receive **3 individual quests every day**. Complete at least one to meet the daily requirement, or complete all three to earn every reward. Each approved quest pays its own **Staff Points (SP)** reward.'));
 c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
 c.addTextDisplayComponents(text('**HOW IT WORKS**'),text('1. View your privately assigned quests.\n2. Complete a quest and submit evidence.\n3. An administrator reviews it.\n4. Approval triggers the Staff Points payout.\n\n**Daily reset:** <t:'+reset+':t> (<t:'+reset+':R>). Unfinished quests expire at reset.'));
 c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:mine','◈ View my quests',ButtonStyle.Secondary),btn('staffquest:notifications','▪ Notification settings',ButtonStyle.Secondary)));
 return c;
}
async function ensurePanel(guild){
 const ch=await guild.channels.fetch(CHANNELS.panel).catch(()=>null); if(!ch?.send) throw new Error('Quest panel channel unavailable.');
 const saved=await db.query("SELECT value FROM staff_quest_settings WHERE key='main_panel'");
 if(saved.rows[0]){const [cid,mid]=saved.rows[0].value.split(':');const old=await guild.channels.fetch(cid).catch(()=>null);const msg=await old?.messages.fetch(mid).catch(()=>null);if(msg){await msg.edit(v2(mainPanel()));return;}}
 const msg=await ch.send(v2(mainPanel()));
 await db.query("INSERT INTO staff_quest_settings(key,value) VALUES('main_panel',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[ch.id+':'+msg.id]);
}
async function getMine(guildId,userId,day){
 const r=await db.query('SELECT a.id,a.quest_name,a.quest_description,a.reward,a.status,a.last_feedback,(SELECT s.payout_status FROM staff_quest_submissions s WHERE s.assignment_id=a.id AND s.status=\'approved\' ORDER BY s.id DESC LIMIT 1) AS payout_status,(SELECT s.payout_reference_id FROM staff_quest_submissions s WHERE s.assignment_id=a.id AND s.status=\'approved\' ORDER BY s.id DESC LIMIT 1) AS payout_reference_id FROM staff_quest_assignments a WHERE a.guild_id=$1 AND a.user_id=$2 AND a.quest_day=$3 ORDER BY a.id',[guildId,userId,day]);
 for (const row of r.rows) { if (row.payout_reference_id) { const current=await crust.getAwardStatus(row.payout_reference_id).catch(()=>null); if (current && current.status!==row.payout_status) { row.payout_status=current.status; await db.query('UPDATE staff_quest_submissions SET payout_status=$2 WHERE payout_reference_id=$1',[row.payout_reference_id,current.status]); } } }
 return r.rows;
}
function progress(rows,day){
 const c=new ContainerBuilder().setAccentColor(0xffffff),done=rows.filter(x=>x.status==='completed').length,pending=rows.filter(x=>x.status==='pending_review').length,reset=resetTimestamp(day);
 c.addTextDisplayComponents(text('# ◈ Your Daily Quests'),text('**Date:** '+day+'\n**Progress:** '+done+'/3 completed • '+pending+' awaiting review\n**Minimum requirement:** Complete at least 1 quest.\n**Additional rewards:** Each other approved quest earns its own reward.\n**Daily reset:** <t:'+reset+':t> (<t:'+reset+':R>).'));
 for(const q of rows){c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));c.addTextDisplayComponents(text('**'+q.quest_name+'** — `'+q.reward+' SP`\n'+q.quest_description+'\n**Status:** '+({assigned:'Available',pending_review:'Awaiting review',completed:'Completed',expired:'Expired'}[q.status]||q.status)));if(q.status==='assigned')c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:submit:'+q.id,'◈ Submit evidence',ButtonStyle.Secondary)));if(q.last_feedback)c.addTextDisplayComponents(text('**Reviewer feedback:** '+q.last_feedback));}
 c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));const earned=rows.filter(q=>q.payout_status==='awarded').reduce((sum,q)=>sum+Number(q.reward),0);c.addTextDisplayComponents(text('**Staff Points earned today: '+earned+' SP**'),text(rows.map(q=>q.quest_name+': '+(q.payout_status||'Not yet payable')).join('\n')));return c;
}
async function showMine(i,guildId=i.guildId){
 const d=dayKey(),rs=await getMine(guildId,i.user.id,d);
 if(!rs.length)return i.reply({content:'You do not have quests assigned today. Daily assignments are generated at 00:00 Riyadh time for eligible NR:R Branch members.',ephemeral:true});
 return i.reply(v2(progress(rs,d),true));
}
async function generate(guild){
 const d=dayKey();
 const existing=await db.query('SELECT 1 FROM staff_quest_daily_runs WHERE guild_id=$1 AND quest_day=$2',[guild.id,d]);if(existing.rowCount)return;
 const [members,active]=await Promise.all([guild.members.fetch(),db.query('SELECT id,name,description,reward FROM staff_quest_catalogue WHERE enabled=TRUE AND deleted_at IS NULL')]);
 if(active.rows.length<3)throw new Error('At least three enabled quests are required.');
 const run=await db.query('INSERT INTO staff_quest_daily_runs(guild_id,quest_day) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING quest_day',[guild.id,d]);
 if(!run.rowCount)return;
 const eligible=[...members.values()].filter(m=>!m.user.bot&&m.roles.cache.has(STAFF_ROLE));
 try { for(const m of eligible){
  const pool=[...active.rows];for(let k=pool.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[pool[k],pool[j]]=[pool[j],pool[k]];}
  for(const q of pool.slice(0,3))await db.query('INSERT INTO staff_quest_assignments(guild_id,quest_day,user_id,quest_id,quest_name,quest_description,reward) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[guild.id,d,m.id,q.id,q.name,q.description,q.reward]);
  const mine=await getMine(guild.id,m.id,d);await sendDailyNotification(guild,m,mine,d);
 }
 } catch(error) { await db.query('DELETE FROM staff_quest_daily_runs WHERE guild_id=$1 AND quest_day=$2',[guild.id,d]); throw error; }
 console.log('[Staff Quests] Assigned daily quests to '+eligible.length+' eligible staff members for '+d+'.');
}
async function recoverPendingReviews(){
 const pending=await db.query("SELECT id FROM staff_quest_submissions WHERE status='pending' AND review_message_id IS NULL ORDER BY submitted_at ASC LIMIT 50");
 for(const row of pending.rows) await postReview(row.id).catch(e=>console.error('[Staff Quests] Review recovery failed for '+row.id+':',e.message));
}
async function processPendingPayouts(){
 const pending=await db.query("SELECT s.id,s.payout_reference_id,a.guild_id,a.user_id,a.quest_name,a.reward FROM staff_quest_submissions s JOIN staff_quest_assignments a ON a.id=s.assignment_id WHERE s.status='approved' AND s.payout_status='pending' AND s.payout_reference_id IS NOT NULL ORDER BY s.reviewed_at ASC LIMIT 25");
 for(const row of pending.rows){
  try{const result=await crust.awardStaffPoints({discordUserId:row.user_id,amount:Number(row.reward),reason:'Daily Community Staff Quest: '+row.quest_name,referenceId:row.payout_reference_id});const status=(await crust.getAwardStatus(row.payout_reference_id))?.status||result.status||'pending';await db.query('UPDATE staff_quest_submissions SET payout_status=$2 WHERE id=$1',[row.id,status]);}
  catch(e){console.error('[Staff Quests] Pending payout recovery failed for submission '+row.id+':',e.message);}
 }
}
async function syncPayoutStatuses(){
 const pending=await db.query("SELECT id,payout_reference_id FROM staff_quest_submissions WHERE status='approved' AND payout_reference_id IS NOT NULL AND payout_status IN ('pending','retry','processing') ORDER BY id DESC LIMIT 100");
 for(const row of pending.rows){const status=await crust.getAwardStatus(row.payout_reference_id).catch(()=>null);if(status&&status.status!==row.payout_status)await db.query('UPDATE staff_quest_submissions SET payout_status=$2 WHERE id=$1',[row.id,status.status]);}
}
async function tick(){
 if(schedulerRunning)return;schedulerRunning=true;
 try {
 const g=client?.guilds.cache.get(config.staffGuildId);if(!g)return;const d=dayKey();
 await db.query("UPDATE staff_quest_assignments SET status='expired',updated_at=NOW() WHERE guild_id=$1 AND quest_day<$2 AND status IN ('assigned','pending_review')",[g.id,d]);
 await generate(g);await recoverPendingReviews();await processPendingPayouts();await syncPayoutStatuses();
 } finally { schedulerRunning=false; }
}
async function postReview(id){
 const r=await db.query('SELECT s.*,a.guild_id,a.quest_name,a.quest_description,a.reward FROM staff_quest_submissions s JOIN staff_quest_assignments a ON a.id=s.assignment_id WHERE s.id=$1',[id]);const q=r.rows[0];if(!q)return;
 const g=client.guilds.cache.get(q.guild_id),ch=await g?.channels.fetch(CHANNELS.submissions).catch(()=>null);if(!ch?.send)throw new Error('Submission channel unavailable.');
 const icon=g?.iconURL?.({size:64});
 const embed=new EmbedBuilder().setColor(0x3498db).setAuthor({name:'◈ QUEST SUBMISSION #'+id,...(icon?{iconURL:icon}:{})}).setTitle(q.quest_name).setDescription('▪ **PENDING REVIEW**').addFields(
  {name:'▪ STAFF MEMBER',value:'<@'+q.submitter_id+'>',inline:true},
  {name:'▪ QUEST',value:q.quest_name,inline:true},
  {name:'▪ REWARD',value:'`'+q.reward+' SP`',inline:true},
  {name:'▪ QUEST CRITERIA',value:q.quest_description,inline:false}
 ).setImage(q.evidence).setFooter({text:'NR:R • Daily Community Staff Quests'}).setTimestamp(new Date(q.submitted_at));
 const actions=new ActionRowBuilder().addComponents(
  btn('staffquest:review-approve:'+id,'Approve',ButtonStyle.Success),
  btn('staffquest:review-reject:'+id,'Reject',ButtonStyle.Danger),
  btn('staffquest:request-evidence:'+id,'Request Evidence',ButtonStyle.Secondary)
 );
 const m=await ch.send({embeds:[embed],components:[actions],allowedMentions:{parse:[]}});
 await db.query('UPDATE staff_quest_submissions SET review_channel_id=$2,review_message_id=$3 WHERE id=$1',[id,ch.id,m.id]);
}
async function updateReviewMessage(id,status,reviewerId,feedback,extra){
 const r=await db.query('SELECT s.*,a.guild_id,a.quest_name,a.reward FROM staff_quest_submissions s JOIN staff_quest_assignments a ON a.id=s.assignment_id WHERE s.id=$1',[id]);const q=r.rows[0];if(!q?.review_message_id)return;
 const guild=client.guilds.cache.get(q.guild_id),channel=await guild?.channels.fetch(q.review_channel_id||CHANNELS.submissions).catch(()=>null),message=await channel?.messages.fetch(q.review_message_id).catch(()=>null);if(!message)return;
 const state=({approved:{title:'✓ APPROVED',color:0x2ecc71},rejected:{title:'✕ REJECTED',color:0xe74c3c},needs_evidence:{title:'◒ ADDITIONAL EVIDENCE REQUESTED',color:0xf59e0b}})[status]||{title:'REVIEWED',color:0x3498db};
 const embed=EmbedBuilder.from(message.embeds[0]).setDescription('▪ **'+state.title+'**').setColor(state.color);
 const fields=(message.embeds[0].fields||[]).filter(f=>!['Review Result','Reviewed By','Reviewer Feedback','Payout Status'].includes(f.name));
 fields.push({name:'▪ REVIEWED BY',value:'<@'+reviewerId+'>',inline:true});
 if(feedback)fields.push({name:'▪ REVIEWER FEEDBACK',value:String(feedback).slice(0,1024),inline:false});
 if(extra?.payoutStatus)fields.push({name:'▪ PAYOUT STATUS',value:'`'+String(extra.payoutStatus)+'`',inline:true});
 embed.setFields(fields).setFooter({text:'NR:R • Daily Community Staff Quests'}).setTimestamp(new Date());
 await message.edit({embeds:[embed],components:[],allowedMentions:{parse:[]}});
}
function decisionDm({status,id,assignmentId,questName,reward,feedback,guild,payoutStatus}){
 const approved=status==='approved',requested=status==='needs_evidence';
 const color=approved?0x2ecc71:requested?0xf59e0b:0xef4444;
 const heading=approved?'✓ Submission Approved':requested?'◒ Additional Evidence Requested':'✕ Submission Rejected';
 const icon=guild?.iconURL?.({size:64});
 const embed=new EmbedBuilder().setColor(color).setAuthor({name:'◈ DAILY COMMUNITY STAFF QUESTS',...(icon?{iconURL:icon}:{})}).setTitle(heading).addFields(
  {name:'▪ QUEST',value:questName,inline:true},
  {name:'▪ REWARD',value:'`'+reward+' SP`',inline:true},
  ...(payoutStatus?[{name:'▪ PAYOUT STATUS',value:'`'+payoutStatus+'`',inline:true}]:[]),
  {name:'▪ REVIEWER FEEDBACK',value:feedback?'> '+String(feedback).slice(0,1000):'No additional note was provided.',inline:false}
 ).setFooter({text:'NR:R • Submission #'+id}).setTimestamp(new Date());
 const payload={embeds:[embed],allowedMentions:{parse:[]}};
 if(!approved&&guild&&assignmentId){payload.components=[new ActionRowBuilder().addComponents(btn('staffquest:resubmit:'+guild.id+':'+assignmentId,'Resubmit Evidence',ButtonStyle.Primary))];}
 return payload;
}
async function submit(i,id){
 await i.deferReply({ephemeral:true});let claimed=false,submissionId=null,guildId=null;
 try{
  const files=i.fields.getUploadedFiles('submission_image',true),attachment=files?.first();
  if(!attachment)return i.editReply({content:'I could not read the uploaded image. Please try again.'});
  if(!attachment.contentType?.startsWith('image/'))return i.editReply({content:'Please upload a valid image file.'});
  // Modal submissions in DMs have no i.guildId. Resolve the owning server from
  // the assignment itself, scoped to this user and today's Riyadh quest date.
  const context=await db.query('SELECT guild_id FROM staff_quest_assignments WHERE id=$1 AND user_id=$2 AND quest_day=$3',[id,i.user.id,dayKey()]);
  guildId=context.rows[0]?.guild_id;
  if(!guildId)return i.editReply({content:'This quest is no longer available for submission.'});
  const claim=await db.query("UPDATE staff_quest_assignments SET status='pending_review',last_feedback=NULL,updated_at=NOW() WHERE id=$1 AND guild_id=$2 AND user_id=$3 AND quest_day=$4 AND status='assigned' RETURNING *",[id,guildId,i.user.id,dayKey()]);
  const a=claim.rows[0];if(!a)return i.editReply({content:'This quest is no longer available for submission.'});claimed=true;
  const inserted=await db.query('INSERT INTO staff_quest_submissions(assignment_id,submitter_id,evidence) VALUES($1,$2,$3) RETURNING id',[id,i.user.id,attachment.url]);submissionId=inserted.rows[0].id;
  try{await postReview(submissionId);}catch(error){console.error('[Staff Quests] Submission saved; review post failed and will be recovered:',{submissionId,assignmentId:id,guildId,userId:i.user.id,code:error?.code,status:error?.status,message:error?.message,stack:error?.stack});return i.editReply({content:'◈ **Your submission was saved.** The review message could not be posted immediately, so the recovery worker will retry it automatically. You will receive a DM when it has been reviewed.',components:[new ActionRowBuilder().addComponents(btn('staffquest:mine:'+guildId,'View My Quests',ButtonStyle.Secondary))],allowedMentions:{parse:[]}});}
  await audit(guildId,i.user.id,'submission_created',{submissionId,quest:a.quest_name,imageName:attachment.name}).catch(error=>console.error('[Staff Quests] Submission audit logging failed:',error.message));
  return i.editReply({content:'◈ **Submission sent for review.** Your evidence has been delivered to the administrators. You will receive a DM when it has been reviewed.',components:[new ActionRowBuilder().addComponents(btn('staffquest:mine:'+guildId,'View My Quests',ButtonStyle.Secondary))],allowedMentions:{parse:[]}});
 }catch(error){console.error('[Staff Quests] Image evidence submission failed:',{submissionId,assignmentId:id,guildId:guildId||i.guildId,userId:i.user.id,claimed,code:error?.code,status:error?.status,message:error?.message,stack:error?.stack});if(claimed&&!submissionId)await db.query("UPDATE staff_quest_assignments SET status='assigned',updated_at=NOW() WHERE id=$1 AND status='pending_review'",[id]).catch(()=>{});return i.editReply({content:'We could not finish processing your image. Your quest has been kept safe; please try again shortly or contact an administrator if the problem continues.'}).catch(()=>{});}
}
async function approve(i,id,feedback=null){
 if(!admin(i))return i.reply({content:'Only Discord administrators can review submissions.',ephemeral:true});
 await i.deferReply({ephemeral:true});
 const claim=await db.query("UPDATE staff_quest_submissions SET status='approved',reviewer_id=$2,feedback=$3,reviewed_at=NOW() WHERE id=$1 AND status='pending' RETURNING *",[id,i.user.id,feedback]);
 if(!claim.rowCount)return i.editReply({content:'This submission has already been reviewed.'});
 const r=await db.query('SELECT s.*,a.guild_id,a.user_id,a.quest_name,a.reward,a.id AS assignment_id FROM staff_quest_submissions s JOIN staff_quest_assignments a ON a.id=s.assignment_id WHERE s.id=$1',[id]),q=r.rows[0];
 await db.query("UPDATE staff_quest_assignments SET status='completed',updated_at=NOW() WHERE id=$1",[q.assignment_id]);
 const ref='staff-quest-'+q.guild_id+'-'+id;await db.query("UPDATE staff_quest_submissions SET payout_reference_id=$2,payout_status='pending' WHERE id=$1",[id,ref]);
 await audit(q.guild_id,i.user.id,'submission_approved',{submissionId:id,userId:q.user_id,quest:q.quest_name,reward:q.reward,referenceId:ref,...(feedback?{feedback}:{})});
 let payoutStatus='pending';
 try{const result=await crust.awardStaffPoints({discordUserId:q.user_id,amount:Number(q.reward),reason:'Daily Community Staff Quest: '+q.quest_name,referenceId:ref});payoutStatus=(await crust.getAwardStatus(ref))?.status||result.status||'pending';await db.query('UPDATE staff_quest_submissions SET payout_status=$2 WHERE id=$1',[id,payoutStatus]);await audit(q.guild_id,i.user.id,'payout_status_updated',{submissionId:id,referenceId:ref,status:payoutStatus});}
 catch(e){console.error('[Staff Quests] Crust award request failed:',e.message);await db.query("UPDATE staff_quest_submissions SET payout_status='pending' WHERE id=$1",[id]);}
 await updateReviewMessage(id,'approved',i.user.id,feedback,{payoutStatus}).catch(e=>console.warn('[Staff Quests] Could not update approved review message:',e.message));
 const guild=client.guilds.cache.get(q.guild_id),user=await client.users.fetch(q.user_id).catch(()=>null);if(user)await user.send(decisionDm({status:'approved',id,assignmentId:q.assignment_id,questName:q.quest_name,reward:q.reward,feedback,guild,payoutStatus})).catch(()=>{});
 return i.editReply({content:'Approved. The review record has been updated and the Staff Points payout is '+payoutStatus+'.'});
}
async function reject(i,id,feedback){
 if(!admin(i))return i.reply({content:'Only Discord administrators can review submissions.',ephemeral:true});
 await i.deferReply({ephemeral:true});
 const f=(feedback||'This submission does not yet meet the quest requirements. Please review the quest instructions and resubmit.').trim();
 const r=await db.query("UPDATE staff_quest_submissions SET status='rejected',reviewer_id=$2,feedback=$3,reviewed_at=NOW() WHERE id=$1 AND status='pending' RETURNING assignment_id,submitter_id",[id,i.user.id,f]);
 if(!r.rowCount)return i.editReply({content:'This submission has already been reviewed.'});
 await db.query("UPDATE staff_quest_assignments SET status='assigned',last_feedback=$2,updated_at=NOW() WHERE id=$1",[r.rows[0].assignment_id,f]);
 const a=(await db.query('SELECT guild_id,quest_name,reward FROM staff_quest_assignments WHERE id=$1',[r.rows[0].assignment_id])).rows[0];
 await audit(a.guild_id,i.user.id,'submission_rejected',{submissionId:id,userId:r.rows[0].submitter_id,quest:a.quest_name,feedback:f});
 await updateReviewMessage(id,'rejected',i.user.id,f).catch(e=>console.warn('[Staff Quests] Could not update rejected review message:',e.message));
 const guild=client.guilds.cache.get(a.guild_id),user=await client.users.fetch(r.rows[0].submitter_id).catch(()=>null);if(user)await user.send(decisionDm({status:'rejected',id,assignmentId:r.rows[0].assignment_id,questName:a.quest_name,reward:a.reward,feedback:f,guild})).catch(()=>{});
 return i.editReply({content:'Rejected. Feedback recorded; resubmission is enabled.'});
}
async function requestMoreEvidence(i,id,feedback){
 if(!admin(i))return i.reply({content:'Only Discord administrators can review submissions.',ephemeral:true});
 await i.deferReply({ephemeral:true});
 const f=String(feedback||'').trim();if(!f)return i.editReply({content:'Please explain what additional evidence is required.'});
 const r=await db.query("UPDATE staff_quest_submissions SET status='needs_evidence',reviewer_id=$2,feedback=$3,reviewed_at=NOW() WHERE id=$1 AND status='pending' RETURNING assignment_id,submitter_id",[id,i.user.id,f]);
 if(!r.rowCount)return i.editReply({content:'This submission has already been reviewed.'});
 await db.query("UPDATE staff_quest_assignments SET status='assigned',last_feedback=$2,updated_at=NOW() WHERE id=$1",[r.rows[0].assignment_id,f]);
 const a=(await db.query('SELECT guild_id,quest_name,reward FROM staff_quest_assignments WHERE id=$1',[r.rows[0].assignment_id])).rows[0];
 await audit(a.guild_id,i.user.id,'submission_needs_evidence',{submissionId:id,userId:r.rows[0].submitter_id,quest:a.quest_name,feedback:f});
 await updateReviewMessage(id,'needs_evidence',i.user.id,f).catch(e=>console.warn('[Staff Quests] Could not update evidence-request review message:',e.message));
 const guild=client.guilds.cache.get(a.guild_id),user=await client.users.fetch(r.rows[0].submitter_id).catch(()=>null);if(user)await user.send(decisionDm({status:'needs_evidence',id,assignmentId:r.rows[0].assignment_id,questName:a.quest_name,reward:a.reward,feedback:f,guild})).catch(()=>{});
 return i.editReply({content:'Additional evidence requested. The staff member can now submit an updated image.'});
}
async function adminPanel(i,page=0,update=false){
 if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});
 const target=i.options?.getUser?.('user');if(target)return showHistory(i,target);
 const qs=await rows(),pageSize=20,maxPage=Math.max(0,Math.ceil(qs.length/pageSize)-1);page=Math.max(0,Math.min(page,maxPage));const pageRows=qs.slice(page*pageSize,(page+1)*pageSize),c=new ContainerBuilder().setAccentColor(0x5865f2);
 c.addTextDisplayComponents(text('# 🛠️ Staff Quests Administration'),text('Create, edit, enable, disable, and delete catalogue entries. Changes affect future assignments; existing assignments keep their saved reward and description.'));
 c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
 c.addTextDisplayComponents(text('**CATALOGUE — PAGE '+(page+1)+'/'+(maxPage+1)+' • '+qs.length+' QUESTS**'),text(pageRows.map(q=>(q.enabled?'🟢':'⚪')+' **'+q.name+'** — '+q.reward+' SP\n'+q.description).join('\n\n').slice(0,3900)));
 const nav=[btn('staffquest:add','Create quest',ButtonStyle.Success)];if(page>0)nav.push(btn('staffquest:admin-page:'+(page-1),'Previous'));if(page<maxPage)nav.push(btn('staffquest:admin-page:'+(page+1),'Next'));c.addActionRowComponents(new ActionRowBuilder().addComponents(nav));
 if(pageRows.length){const opts=pageRows.map(q=>({label:q.name.slice(0,100),value:q.id,description:q.reward+' SP • '+(q.enabled?'Enabled':'Disabled')}));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:edit-select').setPlaceholder('Select a quest to edit').addOptions(opts)));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:toggle-select').setPlaceholder('Select a quest to enable / disable').addOptions(opts)));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:delete-select').setPlaceholder('Select a quest to delete').addOptions(opts)));
 }
 const failed=await db.query("SELECT id,payout_reference_id FROM staff_quest_submissions WHERE status='approved' AND payout_status='failed' AND payout_reference_id IS NOT NULL ORDER BY reviewed_at DESC LIMIT 25");
 if(failed.rows.length)c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:retry-select').setPlaceholder('Select a failed payout to retry').addOptions(failed.rows.map(x=>({label:'Submission #'+x.id,value:x.payout_reference_id,description:'Retry failed Crust payout'})))));
 return update?i.update(v2(c,true)):i.reply(v2(c,true));
}
async function showHistory(i,target){
 const result=await db.query('SELECT a.quest_day,a.quest_name,a.reward,a.status,s.status AS submission_status,s.payout_status,s.feedback FROM staff_quest_assignments a LEFT JOIN LATERAL (SELECT status,payout_status,feedback FROM staff_quest_submissions WHERE assignment_id=a.id ORDER BY id DESC LIMIT 1) s ON TRUE WHERE a.guild_id=$1 AND a.user_id=$2 ORDER BY a.quest_day DESC,a.id DESC LIMIT 100',[i.guildId,target.id]);
 const c=new ContainerBuilder().setAccentColor(0x5865f2);c.addTextDisplayComponents(text('# 📚 Staff Quest History'),text('**Staff member:** <@'+target.id+'>\n**Records:** '+result.rows.length+' (latest 100)'));
 if(result.rows.length)c.addTextDisplayComponents(text(result.rows.map(r=>'**'+String(r.quest_day).slice(0,10)+' — '+r.quest_name+'** ('+r.reward+' SP)\nAssignment: '+r.status+' • Submission: '+(r.submission_status||'none')+' • Payout: '+(r.payout_status||'none')+(r.feedback?'\nFeedback: '+r.feedback:'')).join('\n\n').slice(0,3900)));else c.addTextDisplayComponents(text('No quest history found for this member.'));
 return i.reply(v2(c,true));
}
async function create(i){
 const name=i.fields.getTextInputValue('name').trim(),description=i.fields.getTextInputValue('description').trim(),reward=Number(i.fields.getTextInputValue('reward'));
 if(!name||name.length>90||!description||description.length>700||!Number.isInteger(reward)||reward<1||reward>100000)return i.reply({content:'Provide a name (1–90 chars), description (1–700 chars), and whole-number reward (1–100000 SP).',ephemeral:true});
 const r=await db.query('INSERT INTO staff_quest_catalogue(name,description,reward,created_by,updated_by) VALUES($1,$2,$3,$4,$4) RETURNING id',[name,description,reward,i.user.id]);
 await audit(i.guildId,i.user.id,'quest_created',{questId:r.rows[0].id,name,description,reward});return i.reply({content:'Quest created. It will be eligible for future daily assignments.',ephemeral:true});
}
async function edit(i,id){
 const name=i.fields.getTextInputValue('name').trim(),description=i.fields.getTextInputValue('description').trim(),reward=Number(i.fields.getTextInputValue('reward'));
 if(!name||name.length>90||!description||description.length>700||!Number.isInteger(reward)||reward<1||reward>100000)return i.reply({content:'Provide a name (1–90 chars), description (1–700 chars), and whole-number reward.',ephemeral:true});
 const old=(await db.query('SELECT name,description,reward FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!old)return i.reply({content:'Quest not found.',ephemeral:true});
 await db.query('UPDATE staff_quest_catalogue SET name=$2,description=$3,reward=$4,updated_by=$5,updated_at=NOW() WHERE id=$1',[id,name,description,reward,i.user.id]);
 await audit(i.guildId,i.user.id,'quest_edited',{questId:id,before:old,after:{name,description,reward}});return i.reply({content:'Quest updated. Existing assignments retain their original snapshot.',ephemeral:true});
}
async function handle(i){
 if(i.isChatInputCommand()&&i.commandName==='staff_quests')return showMine(i);
 if(i.isChatInputCommand()&&i.commandName==='staff_quests_admin')return adminPanel(i);
 if(i.isButton()&&i.customId==='staffquest:mine')return showMine(i);
 if(i.isButton()&&i.customId.startsWith('staffquest:mine:'))return showMine(i,i.customId.split(':')[2]);
 if(i.isButton()&&i.customId==='staffquest:notifications')return showNotificationSettings(i);
 if(i.isButton()&&i.customId==='staffquest:notify:dm')return updateNotificationPreference(i,i.guildId,'dm');
 if(i.isButton()&&i.customId==='staffquest:notify:none')return updateNotificationPreference(i,i.guildId,'none');
 if(i.isButton()&&i.customId==='staffquest:notify:ping')return updateNotificationPreference(i,i.guildId,'ping');
 if(i.isButton()&&i.customId.startsWith('staffquest:notify:')){
  const p=i.customId.split(':');return updateNotificationPreference(i,p[2],p[3]);
 }
 if(i.isButton()&&(i.customId.startsWith('staffquest:submit:')||i.customId.startsWith('staffquest:resubmit:'))){
  const p=i.customId.split(':'),isResubmit=p[1]==='resubmit',id=isResubmit?p[3]:p[2],guildId=isResubmit?p[2]:i.guildId;
  if(isResubmit){const available=await db.query("SELECT 1 FROM staff_quest_assignments WHERE id=$1 AND guild_id=$2 AND user_id=$3 AND quest_day=$4 AND status='assigned'",[id,guildId,i.user.id,dayKey()]);if(!available.rowCount)return i.reply({content:'This quest is no longer available for resubmission. Open your current quests to check its status.',ephemeral:true});}
  const m=new ModalBuilder().setCustomId('staffquest:submit-modal:'+id).setTitle(isResubmit?'Resubmit Quest Evidence':'Submit Quest Evidence');
  const upload=new FileUploadBuilder().setCustomId('submission_image').setMinValues(1).setMaxValues(1).setRequired(true);
  m.addLabelComponents(new LabelBuilder().setLabel('Upload your evidence image').setDescription('Upload one image showing your completed quest.').setFileUploadComponent(upload));
  return i.showModal(m);
 }
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:submit-modal:'))return submit(i,i.customId.split(':')[2]);
 if(i.isButton()&&i.customId.startsWith('staffquest:review-approve:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:review-approve-modal:'+id).setTitle('Approve submission');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('Reviewer note (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)));return i.showModal(m);}
 if(i.isButton()&&i.customId.startsWith('staffquest:review-reject:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:review-reject-modal:'+id).setTitle('Reject submission');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('Reviewer feedback (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)));return i.showModal(m);}
 if(i.isButton()&&i.customId.startsWith('staffquest:approve:'))return approve(i,i.customId.split(':')[2]);
 if(i.isButton()&&i.customId.startsWith('staffquest:approve-note:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:approve-note-modal:'+id).setTitle('Approve with reviewer note');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('Reviewer note').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));return i.showModal(m);}
 if(i.isButton()&&i.customId.startsWith('staffquest:reject:'))return reject(i,i.customId.split(':')[2],null);
 if(i.isButton()&&i.customId.startsWith('staffquest:reject-note:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:reject-note-modal:'+id).setTitle('Reject with reviewer feedback');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('Required reviewer feedback').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));return i.showModal(m);}
 if(i.isButton()&&i.customId.startsWith('staffquest:request-evidence:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:request-evidence-modal:'+id).setTitle('Request additional evidence');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('What additional evidence is needed?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));return i.showModal(m);}
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:review-approve-modal:'))return approve(i,i.customId.split(':')[2],i.fields.getTextInputValue('feedback').trim()||null);
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:review-reject-modal:'))return reject(i,i.customId.split(':')[2],i.fields.getTextInputValue('feedback').trim()||null);
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:approve-note-modal:'))return approve(i,i.customId.split(':')[2],i.fields.getTextInputValue('feedback').trim()||null);
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:reject-note-modal:'))return reject(i,i.customId.split(':')[2],i.fields.getTextInputValue('feedback').trim());
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:request-evidence-modal:'))return requestMoreEvidence(i,i.customId.split(':')[2],i.fields.getTextInputValue('feedback').trim());
 if(i.isButton()&&i.customId.startsWith('staffquest:admin-page:'))return adminPanel(i,Number(i.customId.split(':')[2]),true);
 if(i.isButton()&&i.customId==='staffquest:add'){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const m=new ModalBuilder().setCustomId('staffquest:create-modal').setTitle('Create quest');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Quest name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(700)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward').setLabel('Reward in whole Staff Points').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6)));return i.showModal(m);}
 if(i.isModalSubmit()&&i.customId==='staffquest:create-modal'){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});return create(i);}
 if(i.isStringSelectMenu()&&i.customId.startsWith('staffquest:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.values[0];
  if(i.customId==='staffquest:edit-select'){const q=(await db.query('SELECT * FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!q)return i.reply({content:'Quest not found.',ephemeral:true});const m=new ModalBuilder().setCustomId('staffquest:edit-modal:'+id).setTitle('Edit quest');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Quest name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90).setValue(q.name)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(700).setValue(q.description)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward').setLabel('Reward in whole Staff Points').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6).setValue(String(q.reward))));return i.showModal(m);}
  if(i.customId==='staffquest:toggle-select'){const q=(await db.query('SELECT name,enabled FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!q)return i.reply({content:'Quest not found.',ephemeral:true});await db.query('UPDATE staff_quest_catalogue SET enabled=NOT enabled,updated_by=$2,updated_at=NOW() WHERE id=$1',[id,i.user.id]);await audit(i.guildId,i.user.id,'quest_toggled',{questId:id,name:q.name,enabled:!q.enabled});return i.reply({content:'Quest '+(q.enabled?'disabled':'enabled')+'.',ephemeral:true});}
  if(i.customId==='staffquest:retry-select'){const result=await crust.retryAward(id);const status=result?.status||'unknown';await db.query('UPDATE staff_quest_submissions SET payout_status=$2 WHERE payout_reference_id=$1',[id,status]);await audit(i.guildId,i.user.id,'payout_manual_retry',{referenceId:id,status});return i.reply({content:'Crust retry requested. Current status: '+status+'.',ephemeral:true});}
  if(i.customId==='staffquest:delete-select'){const q=(await db.query('SELECT name FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!q)return i.reply({content:'Quest not found.',ephemeral:true});await db.query('UPDATE staff_quest_catalogue SET enabled=FALSE,deleted_at=NOW(),updated_by=$2,updated_at=NOW() WHERE id=$1',[id,i.user.id]);await audit(i.guildId,i.user.id,'quest_deleted',{questId:id,name:q.name});return i.reply({content:'Quest removed from the active catalogue. Historical assignments are preserved.',ephemeral:true});}
 }
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:edit-modal:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});return edit(i,i.customId.split(':')[2]);}
 return false;
}
async function initialize(bot){
 client=bot;await migrate();const guild=client.guilds.cache.get(config.staffGuildId);
 if(!guild){console.warn('[Staff Quests] STAFF_GUILD_ID unavailable; scheduler paused.');return;}
 await ensurePanel(guild).catch(e=>console.error('[Staff Quests] Panel setup failed:',e.message));
 const timer=setInterval(()=>tick().catch(e=>console.error('[Staff Quests] Scheduler failed:',e.message)),60000);timer.unref?.();
 console.log('[Staff Quests] Scheduler ready (Asia/Riyadh); daily generation is running asynchronously.');
 tick().catch(e=>console.error('[Staff Quests] Initial schedule failed:',e.message));
}
module.exports={staffCommand,adminCommand,handle,initialize};
