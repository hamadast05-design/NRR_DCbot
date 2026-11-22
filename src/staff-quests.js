const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
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
const adminCommand = new SlashCommandBuilder().setName('staff_quests_admin').setDescription('Open the administrator-only Staff Quests management panel.');
let client;
const dayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const admin = i => Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
const v2 = (c,ephemeral=false) => ({components:[c],flags:MessageFlags.IsComponentsV2|(ephemeral?MessageFlags.Ephemeral:0),allowedMentions:{parse:[]}});
const audit = async (guildId,actor,action,details) => {
  await db.query('INSERT INTO staff_quest_audit_logs(guild_id,actor_id,action,details) VALUES($1,$2,$3,$4::jsonb)',[guildId,actor,action,JSON.stringify(details||{})]);
  const guild=client?.guilds.cache.get(guildId), channel=await guild?.channels.fetch(CHANNELS.audit).catch(()=>null);
  if(channel?.send) await channel.send({content:'🧾 **Staff Quests Audit**\n**Action:** '+action+'\n**Actor:** <@'+actor+'>\n**Details:** '+JSON.stringify(details||{}).slice(0,1200),allowedMentions:{parse:[]}}).catch(()=>{});
};
async function migrate(){
 await db.query(
 'CREATE TABLE IF NOT EXISTS staff_quest_catalogue(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,reward INTEGER NOT NULL CHECK(reward BETWEEN 1 AND 100000),enabled BOOLEAN NOT NULL DEFAULT TRUE,deleted_at TIMESTAMPTZ,created_by TEXT,updated_by TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'+
 'CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_quest_name ON staff_quest_catalogue(LOWER(name)) WHERE deleted_at IS NULL;'+
 'CREATE TABLE IF NOT EXISTS staff_quest_daily_runs(guild_id TEXT NOT NULL,quest_day DATE NOT NULL,generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(guild_id,quest_day));'+
 'CREATE TABLE IF NOT EXISTS staff_quest_assignments(id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,quest_day DATE NOT NULL,user_id TEXT NOT NULL,quest_id BIGINT NOT NULL REFERENCES staff_quest_catalogue(id),quest_name TEXT NOT NULL,quest_description TEXT NOT NULL,reward INTEGER NOT NULL,status TEXT NOT NULL DEFAULT \'assigned\' CHECK(status IN (\'assigned\',\'pending_review\',\'completed\',\'expired\')),last_feedback TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(guild_id,quest_day,user_id,quest_id));'+
 'CREATE INDEX IF NOT EXISTS idx_staff_quest_assignments_day ON staff_quest_assignments(guild_id,user_id,quest_day);'+
 'CREATE TABLE IF NOT EXISTS staff_quest_submissions(id BIGSERIAL PRIMARY KEY,assignment_id BIGINT NOT NULL REFERENCES staff_quest_assignments(id),submitter_id TEXT NOT NULL,evidence TEXT NOT NULL,status TEXT NOT NULL DEFAULT \'pending\' CHECK(status IN (\'pending\',\'approved\',\'rejected\')),reviewer_id TEXT,feedback TEXT,review_channel_id TEXT,review_message_id TEXT,payout_reference_id TEXT UNIQUE,payout_status TEXT,submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ);'+
 'CREATE INDEX IF NOT EXISTS idx_staff_quest_pending ON staff_quest_submissions(status,submitted_at);'+
 'CREATE TABLE IF NOT EXISTS staff_quest_audit_logs(id BIGSERIAL PRIMARY KEY,guild_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,details JSONB NOT NULL DEFAULT \'{}\'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'+
 'CREATE TABLE IF NOT EXISTS staff_quest_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);'
 );
 const n=await db.query('SELECT COUNT(*)::int AS n FROM staff_quest_catalogue');
 if(!n.rows[0].n) for(const q of seed) await db.query('INSERT INTO staff_quest_catalogue(name,description,reward,created_by) VALUES($1,$2,$3,$4)',[q[0],q[1],q[2],'system-seed']);
}
async function rows(){const r=await db.query('SELECT id,name,description,reward,enabled FROM staff_quest_catalogue WHERE deleted_at IS NULL ORDER BY id');return r.rows.map(x=>({...x,id:String(x.id),reward:Number(x.reward)}));}
function mainPanel(){
 const c=new ContainerBuilder().setAccentColor(0xffffff);
 c.addTextDisplayComponents(text('# 🏆 NR:R Daily Community Staff Quests'),text('You receive **3 individual quests every day**. Complete at least one to meet the daily requirement, or complete all three to earn every reward. Each approved quest pays its own Staff Points reward.'));
 c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
 c.addTextDisplayComponents(text('**HOW IT WORKS**'),text('1. View your privately assigned quests.\n2. Complete a quest and submit evidence.\n3. An administrator reviews it.\n4. Approval triggers the Crust Staff Points payout.\n\nQuests refresh at **00:00 Riyadh time**. Unfinished quests expire at reset.'));
 c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:mine','View my quests',ButtonStyle.Primary)));
 return c;
}
async function ensurePanel(guild){
 const ch=await guild.channels.fetch(CHANNELS.panel).catch(()=>null); if(!ch?.send) throw new Error('Quest panel channel unavailable.');
 const saved=await db.query("SELECT value FROM staff_quest_settings WHERE key='main_panel'");
 if(saved.rows[0]){const [cid,mid]=saved.rows[0].value.split(':');const old=await guild.channels.fetch(cid).catch(()=>null);const msg=await old?.messages.fetch(mid).catch(()=>null);if(msg)return;}
 const msg=await ch.send(v2(mainPanel()));
 await db.query("INSERT INTO staff_quest_settings(key,value) VALUES('main_panel',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[ch.id+':'+msg.id]);
}
async function getMine(guildId,userId,day){
 const r=await db.query('SELECT a.id,a.quest_name,a.quest_description,a.reward,a.status,a.last_feedback,(SELECT s.payout_status FROM staff_quest_submissions s WHERE s.assignment_id=a.id AND s.status=\'approved\' ORDER BY s.id DESC LIMIT 1) AS payout_status FROM staff_quest_assignments a WHERE a.guild_id=$1 AND a.user_id=$2 AND a.quest_day=$3 ORDER BY a.id',[guildId,userId,day]);
 return r.rows;
}
function progress(rows,day){
 const c=new ContainerBuilder().setAccentColor(0x16a34a),done=rows.filter(x=>x.status==='completed').length,pending=rows.filter(x=>x.status==='pending_review').length;
 c.addTextDisplayComponents(text('# 📋 Your Daily Quests'),text('**Date:** '+day+' (Riyadh)\n**Progress:** '+done+'/3 completed • '+pending+' awaiting review\n**Daily requirement:** Complete at least 1. You can complete all 3 for additional rewards.'));
 for(const q of rows){c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));c.addTextDisplayComponents(text('**'+q.quest_name+'** — '+q.reward+' SP\n'+q.quest_description+'\n**Status:** '+({assigned:'📝 Available',pending_review:'🕒 Awaiting review',completed:'✅ Completed',expired:'⌛ Expired'}[q.status]||q.status)));if(q.status==='assigned')c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:submit:'+q.id,'Submit evidence',ButtonStyle.Primary)));if(q.last_feedback)c.addTextDisplayComponents(text('**Reviewer feedback:** '+q.last_feedback));}
 c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
 c.addTextDisplayComponents(text('**Payout status**'),text(rows.map(q=>q.quest_name+': '+(q.payout_status||'Not yet payable')).join('\n')));
 return c;
}
async function showMine(i){
 const d=dayKey(),rs=await getMine(i.guildId,i.user.id,d);
 if(!rs.length)return i.reply({content:'You do not have quests assigned today. Daily assignments are generated at 00:00 Riyadh time for eligible NR:R Branch members.',ephemeral:true});
 return i.reply(v2(progress(rs,d),true));
}
async function generate(guild){
 const d=dayKey(),run=await db.query('INSERT INTO staff_quest_daily_runs(guild_id,quest_day) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING quest_day',[guild.id,d]);
 if(!run.rowCount)return;
 const [members,active]=await Promise.all([guild.members.fetch(),db.query('SELECT id,name,description,reward FROM staff_quest_catalogue WHERE enabled=TRUE AND deleted_at IS NULL')]);
 if(active.rows.length<3){await db.query('DELETE FROM staff_quest_daily_runs WHERE guild_id=$1 AND quest_day=$2',[guild.id,d]);throw new Error('At least three enabled quests are required.');}
 const eligible=[...members.values()].filter(m=>!m.user.bot&&m.roles.cache.has(STAFF_ROLE));
 for(const m of eligible){
  const pool=[...active.rows];for(let k=pool.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[pool[k],pool[j]]=[pool[j],pool[k]];}
  for(const q of pool.slice(0,3))await db.query('INSERT INTO staff_quest_assignments(guild_id,quest_day,user_id,quest_id,quest_name,quest_description,reward) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[guild.id,d,m.id,q.id,q.name,q.description,q.reward]);
  const mine=await getMine(guild.id,m.id,d);await m.send(v2(progress(mine,d),true)).catch(()=>{});
 }
 console.log('[Staff Quests] Assigned daily quests to '+eligible.length+' eligible staff members for '+d+'.');
}
async function tick(){
 const g=client?.guilds.cache.get(config.staffGuildId);if(!g)return;const d=dayKey();
 await db.query("UPDATE staff_quest_assignments SET status='expired',updated_at=NOW() WHERE guild_id=$1 AND quest_day<$2 AND status IN ('assigned','pending_review')",[g.id,d]);
 await generate(g);
}
async function postReview(id){
 const r=await db.query('SELECT s.*,a.guild_id,a.quest_name,a.quest_description,a.reward FROM staff_quest_submissions s JOIN staff_quest_assignments a ON a.id=s.assignment_id WHERE s.id=$1',[id]);const q=r.rows[0];if(!q)return;
 const g=client.guilds.cache.get(q.guild_id),ch=await g?.channels.fetch(CHANNELS.submissions).catch(()=>null);if(!ch?.send)throw new Error('Submission channel unavailable.');
 const c=new ContainerBuilder().setAccentColor(0xe0a526);
 c.addTextDisplayComponents(text('# 📨 Quest Submission #'+id),text('**Staff:** <@'+q.submitter_id+'>\n**Quest:** '+q.quest_name+'\n**Reward:** '+q.reward+' SP\n**Description:** '+q.quest_description+'\n\n**Evidence:**\n'+q.evidence));
 c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:approve:'+id,'Approve',ButtonStyle.Success),btn('staffquest:reject:'+id,'Reject',ButtonStyle.Danger)));
 const m=await ch.send(v2(c));await db.query('UPDATE staff_quest_submissions SET review_channel_id=$2,review_message_id=$3 WHERE id=$1',[id,ch.id,m.id]);
}
async function submit(i,id){
 const r=await db.query('SELECT * FROM staff_quest_assignments WHERE id=$1 AND guild_id=$2 AND user_id=$3',[id,i.guildId,i.user.id]),a=r.rows[0];
 if(!a||String(a.quest_day).slice(0,10)!==dayKey()||a.status!=='assigned')return i.reply({content:'This quest is no longer available for submission.',ephemeral:true});
 const evidence=i.fields.getTextInputValue('evidence').trim();if(!evidence)return i.reply({content:'Evidence is required.',ephemeral:true});
 const s=await db.query('INSERT INTO staff_quest_submissions(assignment_id,submitter_id,evidence) VALUES($1,$2,$3) RETURNING id',[id,i.user.id,evidence]);
 await db.query("UPDATE staff_quest_assignments SET status='pending_review',updated_at=NOW() WHERE id=$1",[id]);
 await postReview(s.rows[0].id);await audit(i.guildId,i.user.id,'submission_created',{submissionId:s.rows[0].id,quest:a.quest_name});
 return i.reply({content:'✅ Evidence submitted. An administrator will review it shortly.',ephemeral:true});
}
async function approve(i,id){
 if(!admin(i))return i.reply({content:'Only Discord administrators can review submissions.',ephemeral:true});
 const claim=await db.query("UPDATE staff_quest_submissions SET status='approved',reviewer_id=$2,reviewed_at=NOW() WHERE id=$1 AND status='pending' RETURNING *",[id,i.user.id]);
 if(!claim.rowCount)return i.reply({content:'This submission has already been reviewed.',ephemeral:true});
 const r=await db.query('SELECT s.*,a.guild_id,a.user_id,a.quest_name,a.reward,a.id AS assignment_id FROM staff_quest_submissions s JOIN staff_quest_assignments a ON a.id=s.assignment_id WHERE s.id=$1',[id]),q=r.rows[0];
 await db.query("UPDATE staff_quest_assignments SET status='completed',updated_at=NOW() WHERE id=$1",[q.assignment_id]);
 const ref='staff-quest-'+q.guild_id+'-'+id;await db.query("UPDATE staff_quest_submissions SET payout_reference_id=$2,payout_status='pending' WHERE id=$1",[id,ref]);
 await audit(q.guild_id,i.user.id,'submission_approved',{submissionId:id,userId:q.user_id,quest:q.quest_name,reward:q.reward,referenceId:ref});
 await i.update({components:[new ContainerBuilder().setAccentColor(0x16a34a).addTextDisplayComponents(text('# ✅ Quest approved'),text('**'+q.quest_name+'** for <@'+q.user_id+'>. Crust payout of **'+q.reward+' SP** is being processed.'))],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}});
 try{const result=await crust.awardStaffPoints({discordUserId:q.user_id,amount:Number(q.reward),reason:'Daily Community Staff Quest: '+q.quest_name,referenceId:ref});const status=(await crust.getAwardStatus(ref))?.status||result.status||'pending';await db.query('UPDATE staff_quest_submissions SET payout_status=$2 WHERE id=$1',[id,status]);await audit(q.guild_id,i.user.id,'payout_status_updated',{submissionId:id,referenceId:ref,status});}
 catch(e){console.error('[Staff Quests] Crust award request failed:',e.message);await db.query("UPDATE staff_quest_submissions SET payout_status='pending' WHERE id=$1",[id]);}
}
async function reject(i,id){
 if(!admin(i))return i.reply({content:'Only Discord administrators can review submissions.',ephemeral:true});
 const f=i.fields.getTextInputValue('feedback').trim();if(!f)return i.reply({content:'Feedback is required.',ephemeral:true});
 const r=await db.query("UPDATE staff_quest_submissions SET status='rejected',reviewer_id=$2,feedback=$3,reviewed_at=NOW() WHERE id=$1 AND status='pending' RETURNING assignment_id,submitter_id",[id,i.user.id,f]);
 if(!r.rowCount)return i.reply({content:'This submission has already been reviewed.',ephemeral:true});
 await db.query("UPDATE staff_quest_assignments SET status='assigned',last_feedback=$2,updated_at=NOW() WHERE id=$1",[r.rows[0].assignment_id,f]);
 const a=(await db.query('SELECT guild_id,quest_name FROM staff_quest_assignments WHERE id=$1',[r.rows[0].assignment_id])).rows[0];
 await audit(a.guild_id,i.user.id,'submission_rejected',{submissionId:id,userId:r.rows[0].submitter_id,feedback:f});
 const u=await client.users.fetch(r.rows[0].submitter_id).catch(()=>null);if(u)await u.send('Your submission for **'+a.quest_name+'** was rejected.\nFeedback: '+f+'\nYou may revise and resubmit.').catch(()=>{});
 return i.reply({content:'Rejected. Feedback recorded; resubmission is enabled.',ephemeral:true});
}
async function adminPanel(i){
 if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});
 const qs=await rows(),c=new ContainerBuilder().setAccentColor(0x5865f2);
 c.addTextDisplayComponents(text('# 🛠️ Staff Quests Administration'),text('Create, edit, enable, disable, and delete catalogue entries. Changes affect future assignments; existing assignments keep their saved reward and description.'));
 c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
 c.addTextDisplayComponents(text('**CATALOGUE**'),text(qs.map(q=>(q.enabled?'🟢':'⚪')+' **'+q.name+'** — '+q.reward+' SP\n'+q.description).join('\n\n').slice(0,3900)));
 c.addActionRowComponents(new ActionRowBuilder().addComponents(btn('staffquest:add','Create quest',ButtonStyle.Success)));
 if(qs.length){const opts=qs.slice(0,25).map(q=>({label:q.name.slice(0,100),value:q.id,description:q.reward+' SP • '+(q.enabled?'Enabled':'Disabled')}));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:edit-select').setPlaceholder('Select a quest to edit').addOptions(opts)));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:toggle-select').setPlaceholder('Select a quest to enable / disable').addOptions(opts)));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('staffquest:delete-select').setPlaceholder('Select a quest to delete').addOptions(opts)));
 }
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
 if(i.isButton()&&i.customId.startsWith('staffquest:submit:')){const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:submit-modal:'+id).setTitle('Submit Quest Evidence');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('evidence').setLabel('Evidence: message link, explanation, or screenshot link').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500)));return i.showModal(m);}
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:submit-modal:'))return submit(i,i.customId.split(':')[2]);
 if(i.isButton()&&i.customId.startsWith('staffquest:approve:'))return approve(i,i.customId.split(':')[2]);
 if(i.isButton()&&i.customId.startsWith('staffquest:reject:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.customId.split(':')[2],m=new ModalBuilder().setCustomId('staffquest:reject-modal:'+id).setTitle('Reject submission');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('feedback').setLabel('Required reviewer feedback').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));return i.showModal(m);}
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:reject-modal:'))return reject(i,i.customId.split(':')[2]);
 if(i.isButton()&&i.customId==='staffquest:add'){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const m=new ModalBuilder().setCustomId('staffquest:create-modal').setTitle('Create quest');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Quest name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(700)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward').setLabel('Reward in whole Staff Points').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6)));return i.showModal(m);}
 if(i.isModalSubmit()&&i.customId==='staffquest:create-modal'){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});return create(i);}
 if(i.isStringSelectMenu()&&i.customId.startsWith('staffquest:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});const id=i.values[0];
  if(i.customId==='staffquest:edit-select'){const q=(await db.query('SELECT * FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!q)return i.reply({content:'Quest not found.',ephemeral:true});const m=new ModalBuilder().setCustomId('staffquest:edit-modal:'+id).setTitle('Edit quest');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Quest name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90).setValue(q.name)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(700).setValue(q.description)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward').setLabel('Reward in whole Staff Points').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6).setValue(String(q.reward))));return i.showModal(m);}
  if(i.customId==='staffquest:toggle-select'){const q=(await db.query('SELECT name,enabled FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!q)return i.reply({content:'Quest not found.',ephemeral:true});await db.query('UPDATE staff_quest_catalogue SET enabled=NOT enabled,updated_by=$2,updated_at=NOW() WHERE id=$1',[id,i.user.id]);await audit(i.guildId,i.user.id,'quest_toggled',{questId:id,name:q.name,enabled:!q.enabled});return i.reply({content:'Quest '+(q.enabled?'disabled':'enabled')+'.',ephemeral:true});}
  if(i.customId==='staffquest:delete-select'){const q=(await db.query('SELECT name FROM staff_quest_catalogue WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0];if(!q)return i.reply({content:'Quest not found.',ephemeral:true});await db.query('UPDATE staff_quest_catalogue SET enabled=FALSE,deleted_at=NOW(),updated_by=$2,updated_at=NOW() WHERE id=$1',[id,i.user.id]);await audit(i.guildId,i.user.id,'quest_deleted',{questId:id,name:q.name});return i.reply({content:'Quest removed from the active catalogue. Historical assignments are preserved.',ephemeral:true});}
 }
 if(i.isModalSubmit()&&i.customId.startsWith('staffquest:edit-modal:')){if(!admin(i))return i.reply({content:'Administrators only.',ephemeral:true});return edit(i,i.customId.split(':')[2]);}
 return false;
}
async function initialize(bot){
 client=bot;await migrate();const guild=client.guilds.cache.get(config.staffGuildId);
 if(!guild){console.warn('[Staff Quests] STAFF_GUILD_ID unavailable; scheduler paused.');return;}
 await ensurePanel(guild).catch(e=>console.error('[Staff Quests] Panel setup failed:',e.message));
 await tick().catch(e=>console.error('[Staff Quests] Initial schedule failed:',e.message));
 const timer=setInterval(()=>tick().catch(e=>console.error('[Staff Quests] Scheduler failed:',e.message)),60000);timer.unref?.();
 console.log('[Staff Quests] Scheduler ready (Asia/Riyadh).');
}
module.exports={staffCommand,adminCommand,handle,initialize};
