const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const db = require('./db');

const STAFF_ROLE_ID = '1180415723164668044';
const COLORS = { staff: 0x24262d, member: 0x3c3c3d, accent: 0x5865f2 };

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_message_activity (
      id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL, message_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(guild_id, message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_nrr_activity_user_date ON nrr_message_activity(guild_id,user_id,created_at);
    CREATE TABLE IF NOT EXISTS nrr_punishments (
      id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL, target_id TEXT NOT NULL,
      moderator_id TEXT, action TEXT NOT NULL, reason TEXT, occurred_at TIMESTAMPTZ NOT NULL,
      source TEXT NOT NULL DEFAULT 'audit-log', audit_entry_id TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_nrr_punishments_target_date ON nrr_punishments(guild_id,target_id,occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_nrr_punishments_mod_date ON nrr_punishments(guild_id,moderator_id,occurred_at DESC);
    CREATE TABLE IF NOT EXISTS nrr_audit_scan_state (
      guild_id TEXT PRIMARY KEY, last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
async function onMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  await db.query(`INSERT INTO nrr_message_activity(guild_id,user_id,channel_id,message_id,created_at)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(guild_id,message_id) DO NOTHING`,
    [message.guild.id,message.author.id,message.channel.id,message.id,message.createdAt || new Date()]);
}
function isStaff(member) { return Boolean(member?.roles?.cache?.has(STAFF_ROLE_ID)); }
async function countMessages(guildId,userId,days) {
  const result = await db.query(`SELECT COUNT(*)::int AS count FROM nrr_message_activity
    WHERE guild_id=$1 AND user_id=$2 AND created_at >= NOW() - ($3::text || ' days')::interval`,[guildId,userId,String(days)]);
  return result.rows[0]?.count || 0;
}
async function punishmentCount(guildId,userId,days) {
  const result = await db.query(`SELECT COUNT(*)::int AS count FROM nrr_punishments
    WHERE guild_id=$1 AND moderator_id=$2 AND occurred_at >= NOW() - ($3::text || ' days')::interval`,[guildId,userId,String(days)]);
  return result.rows[0]?.count || 0;
}
async function ranking(guild, metric, userId) {
  const staffRole = guild.roles.cache.get(STAFF_ROLE_ID);
  const staffIds = staffRole ? [...staffRole.members.values()].filter(m => !m.user.bot).map(m=>m.id) : [];
  if (!staffIds.length) return null;
  const isPunishment = metric === 'punishments';
  const result = await db.query(isPunishment
    ? `SELECT moderator_id AS user_id,COUNT(*)::int AS n FROM nrr_punishments WHERE guild_id=$1 AND occurred_at >= NOW()-INTERVAL '14 days' AND moderator_id = ANY($2::text[]) GROUP BY moderator_id ORDER BY n DESC`
    : `SELECT user_id,COUNT(*)::int AS n FROM nrr_message_activity WHERE guild_id=$1 AND created_at >= NOW()-INTERVAL '14 days' AND user_id = ANY($2::text[]) GROUP BY user_id ORDER BY n DESC`,
    [guild.id,staffIds]);
  const scores = new Map(result.rows.map(r=>[r.user_id,Number(r.n)]));
  const sorted = staffIds.map(id=>({id,n:scores.get(id)||0})).sort((a,b)=>b.n-a.n || a.id.localeCompare(b.id));
  const index = sorted.findIndex(x=>x.id===userId);
  return index < 0 ? null : { rank:index+1,total:sorted.length,score:sorted[index].n };
}
function ordinal(n) { const v=n%100; if(v>=11&&v<=13)return n+'th'; return n+(n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'); }
function makeStatsEmbed(user, title, fields, self=false, staff=false) {
  const embed = new EmbedBuilder().setColor(staff?COLORS.staff:COLORS.member)
    .setTitle(self ? 'Hello ' + user.username + '!' : title)
    .setThumbnail(user.displayAvatarURL({size:256}))
    .addFields(fields).setFooter({text:'NRR • Activity is tracked from feature activation onward'});
  return embed;
}
async function statsCommand(interaction, staffOnly) {
  if (!interaction.inGuild()) return interaction.reply({content:'Use this command inside a server.',ephemeral:true});
  const target = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(target.id).catch(()=>null);
  if (!member) return interaction.reply({content:'I could not find that member in this server.',ephemeral:true});
  const staff = isStaff(member);
  if (staffOnly && !staff) return interaction.reply({content:'This member does not have the Staff Team role.',ephemeral:true});
  if (!staffOnly && staff) return interaction.reply({content:'This command is for regular members. Use /stats_staff for staff statistics.',ephemeral:true});
  const self = target.id === interaction.user.id;
  await interaction.deferReply();
  const guildId=interaction.guild.id;
  const [windows,totalR,lastR,topR,daysR] = await Promise.all([
    Promise.all([1,3,7,14].map(days=>countMessages(guildId,target.id,days))),
    db.query('SELECT COUNT(*)::int AS count FROM nrr_message_activity WHERE guild_id=$1 AND user_id=$2',[guildId,target.id]),
    db.query('SELECT MAX(created_at) AS last_active FROM nrr_message_activity WHERE guild_id=$1 AND user_id=$2',[guildId,target.id]),
    db.query('SELECT channel_id,COUNT(*)::int AS count FROM nrr_message_activity WHERE guild_id=$1 AND user_id=$2 GROUP BY channel_id ORDER BY count DESC LIMIT 3',[guildId,target.id]),
    db.query("SELECT day::date AS day,COUNT(*)::int AS count FROM (SELECT date_trunc('day',created_at AT TIME ZONE 'UTC') AS day FROM nrr_message_activity WHERE guild_id=$1 AND user_id=$2 AND created_at >= NOW()-INTERVAL '90 days') x GROUP BY day ORDER BY day DESC",[guildId,target.id])
  ]);
  let streak=0;
  const activeDays=new Map(daysR.rows.map(r=>[new Date(r.day).toISOString().slice(0,10),Number(r.count)]));
  const utcDay=d=>d.toISOString().slice(0,10);
  const today=new Date(); today.setUTCHours(0,0,0,0);
  const yesterday=new Date(today); yesterday.setUTCDate(yesterday.getUTCDate()-1);
  let cursor=activeDays.has(utcDay(today))?today:yesterday;
  while(activeDays.get(utcDay(cursor))>=15){streak++;cursor=new Date(cursor);cursor.setUTCDate(cursor.getUTCDate()-1);}
  const lastActive=lastR.rows[0]?.last_active;
  const fields = [
    {name:'Total messages',value:'**'+Number(totalR.rows[0]?.count||0).toLocaleString()+'**',inline:true},
    {name:'Last active',value:lastActive?'<t:'+Math.floor(new Date(lastActive).getTime()/1000)+':R>':'No activity recorded',inline:true},
    {name:'Daily streak',value:'**'+streak+' day'+(streak===1?'':'s')+'**\\n15+ messages/day',inline:true},
    {name:'24 Hours',value:'**'+windows[0].toLocaleString()+'**',inline:true},
    {name:'3 Days',value:'**'+windows[1].toLocaleString()+'**',inline:true},
    {name:'7 Days',value:'**'+windows[2].toLocaleString()+'**',inline:true},
    {name:'14 Days',value:'**'+windows[3].toLocaleString()+'**',inline:true},
    {name:'Top channels',value:topR.rows.length?topR.rows.map((r,i)=>(i+1)+'. <#'+r.channel_id+'> — **'+Number(r.count).toLocaleString()+'**').join('\\n'):'No channel activity recorded yet',inline:false}
  ];
  const rows=[];
  if (staffOnly) {
    const [punishments, activityRank, punishmentRank] = await Promise.all([
      punishmentCount(interaction.guild.id,target.id,14),
      ranking(interaction.guild,'activity',target.id), ranking(interaction.guild,'punishments',target.id)
    ]);
    const highest = member.roles.highest?.name;
    fields.unshift({name:'Staff member',value:highest && highest !== '@everyone' ? highest : 'Staff Team',inline:false});
    fields.push({name:'Punishments',value:'**Issued (14 days):** '+punishments,inline:true});
    fields.push({name:'Ranking',value:'**Punishments:** '+(punishmentRank?ordinal(punishmentRank.rank)+' of '+punishmentRank.total:'Unranked')+'\n**Activity:** '+(activityRank?ordinal(activityRank.rank)+' of '+activityRank.total:'Unranked'),inline:false});
    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('staffstats:punishments:'+interaction.guild.id+':'+target.id+':'+interaction.user.id).setLabel('Punishments').setStyle(ButtonStyle.Secondary)));
  }
  const embed=makeStatsEmbed(target, target.username+' • Statistics', fields,self,staffOnly);
  embed.setColor(staffOnly ? COLORS.staff : COLORS.member).setAuthor({name:'NR:R',iconURL:'https://plain-eeur-prod-public.komododecks.com/202610/24/if8DMbiGuy0pn3tIQvrO/image.jpg'}).setFooter({text:'NR:R • Server activity'});
  return interaction.editReply({embeds:[embed],components:rows,allowedMentions:{parse:[]}});
}
function validDate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value+'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value ? undefined : date;
}
async function checkPunishments(interaction) {
  if (!interaction.inGuild()) return interaction.reply({content:'Use this command inside a server.',ephemeral:true});
  const target=interaction.options.getUser('user',true);
  const bans=interaction.options.getBoolean('bans') ?? true;
  const kicks=interaction.options.getBoolean('kicks') ?? true;
  const timeouts=interaction.options.getBoolean('timeouts') ?? true;
  const startText=interaction.options.getString('start_date');
  const endText=interaction.options.getString('end_date');
  const start=validDate(startText), end=validDate(endText);
  if (start===undefined || end===undefined) return interaction.reply({content:'Dates must use YYYY-MM-DD.',ephemeral:true});
  if (start && end && start>end) return interaction.reply({content:'Start date must be on or before end date.',ephemeral:true});
  const actions=[];
  if(bans) actions.push('ban'); if(kicks) actions.push('kick'); if(timeouts) actions.push('timeout');
  if(!actions.length) return interaction.reply({content:'Select at least one punishment type.',ephemeral:true});
  await interaction.deferReply();
  const params=[interaction.guild.id,target.id,actions];
  let dateClause='';
  if(start){params.push(start);dateClause+=' AND occurred_at >= $'+params.length+'::timestamptz';}
  if(end){params.push(end);dateClause+=` AND occurred_at < ($${params.length}::timestamptz + INTERVAL '1 day')`;}
  const result=await db.query(`SELECT * FROM nrr_punishments WHERE guild_id=$1 AND target_id=$2 AND action=ANY($3::text[])${dateClause} ORDER BY occurred_at DESC LIMIT 20`,params);
  const embed=new EmbedBuilder().setColor(0x2b2d31).setTitle('Punishment history • '+target.username).setThumbnail(target.displayAvatarURL({size:256}));
  if(!result.rows.length) embed.setDescription('No recorded punishments match these filters. Note: records are collected from feature activation onward and available audit logs.');
  else embed.setDescription(result.rows.map((p,i)=>'**'+(i+1)+'. '+p.action.toUpperCase()+'** • <t:'+Math.floor(new Date(p.occurred_at).getTime()/1000)+':f>\n**Moderator:** '+(p.moderator_id?'<@'+p.moderator_id+'>':'Unknown')+'\n**Reason:** '+(p.reason||'No reason recorded')+'\n**Source:** '+p.source).join('\n\n').slice(0,4000));
  embed.setFooter({text:'Showing up to 20 records • Date format YYYY-MM-DD'});
  return interaction.editReply({embeds:[embed],allowedMentions:{parse:[]}});
}
async function handleButton(interaction) {
  if(!interaction.customId.startsWith('staffstats:punishments:')) return false;
  const [, , guildId,userId,ownerId]=interaction.customId.split(':');
  if(interaction.user.id!==ownerId) return interaction.reply({content:'Only the person who opened these stats can use this button.',ephemeral:true});
  const member=await interaction.guild?.members.fetch(userId).catch(()=>null);
  if(!member) return interaction.reply({content:'Member is no longer in this server.',ephemeral:true});
  const result=await db.query('SELECT * FROM nrr_punishments WHERE guild_id=$1 AND moderator_id=$2 AND occurred_at >= NOW()-INTERVAL \'14 days\' ORDER BY occurred_at DESC LIMIT 15',[guildId,userId]);
  const embed=new EmbedBuilder().setColor(COLORS.staff).setTitle('Punishments issued • '+member.user.username).setThumbnail(member.user.displayAvatarURL({size:256}));
  embed.setDescription(result.rows.length?result.rows.map((p,i)=>'**'+(i+1)+'. '+p.action.toUpperCase()+'** • <t:'+Math.floor(new Date(p.occurred_at).getTime()/1000)+':R>\n**Target:** <@'+p.target_id+'>\n**Reason:** '+(p.reason||'No reason recorded')).join('\n\n').slice(0,4000):'No issued punishments have been recorded in the last 14 days.');
  return interaction.update({embeds:[embed],components:[]});
}
async function recordAudit(guild, entry) {
  let action=null, targetId=entry.target?.id;
  if(entry.action===AuditLogEvent.MemberBanAdd) action='ban';
  else if(entry.action===AuditLogEvent.MemberKick) action='kick';
  else if(entry.action===AuditLogEvent.MemberUpdate && entry.changes?.some(c=>c.key==='communication_disabled_until' && c.new)) action='timeout';
  if(!action || !targetId || !entry.id) return;
  const reason=entry.reason || null, moderatorId=entry.executor?.id || null, occurredAt=entry.createdAt || new Date();
  await db.query(`INSERT INTO nrr_punishments(guild_id,target_id,moderator_id,action,reason,occurred_at,source,audit_entry_id)
    VALUES($1,$2,$3,$4,$5,$6,'audit-log',$7) ON CONFLICT(audit_entry_id) DO NOTHING`,
    [guild.id,targetId,moderatorId,action,reason,occurredAt,entry.id]);
}
async function backfillAuditLogs(client) {
  for(const guild of client.guilds.cache.values()) {
    const botMember=guild.members.me;
    if(!botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog)) { console.warn('Missing View Audit Log permission in '+guild.name); continue; }
    try {
      const logs=await guild.fetchAuditLogs({limit:100});
      for(const entry of logs.entries.values()) await recordAudit(guild,entry);
    } catch(error) { console.error('Punishment audit scan failed for '+guild.name+':',error.message); }
  }
}
module.exports={STAFF_ROLE_ID,migrate,onMessage,statsCommand,checkPunishments,handleButton,recordAudit,backfillAuditLogs,isStaff};
