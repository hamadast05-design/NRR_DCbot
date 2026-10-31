const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const db = require('./db');

const NEWS_CHANNEL_ID = '1566053538843328512';
const FEEDS = ['https://feeds.bbci.co.uk/news/world/rss.xml','https://feeds.bbci.co.uk/news/rss.xml'];
const POLL_MS = 15 * 60 * 1000;
const SLOT_MS = 4 * 60 * 60 * 1000;
const MAX_DAILY = 6;
const parser = new Parser({timeout:15000,headers:{'User-Agent':'NRR-World-News/1.0'}});
let queue=[],busy=false,timer=null;

function clean(v,n=900){return String(v||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim().slice(0,n);}
function key(x){return String(x.guid||x.id||x.link||x.title||'').trim();}
function score(x){
 const t=(clean(x.title,300)+' '+clean(x.contentSnippet||x.content||x.description,900)).toLowerCase();
 const rules=[
  [/war|invasion|airstrike|missile|military escalation|ceasefire|hostage|terror attack|terrorism|coup|nuclear/i,5],
  [/earthquake|tsunami|hurricane|cyclone|wildfire|flood|volcano|major disaster|outbreak|pandemic|epidemic/i,4],
  [/president|prime minister|election|parliament|government|sanction|summit|diplomatic|treaty|supreme court|resign|impeach/i,3],
  [/economy|inflation|central bank|oil prices|energy crisis|trade deal|global market|recession/i,3],
  [/killed|death toll|injured|evacuated|humanitarian|refugee crisis|major scientific|space mission|climate agreement|cyberattack/i,2],
  [/international|worldwide|global|nationwide|historic|unprecedented|major/i,1]
 ];
 let n=0; for(const [re,p] of rules)if(re.test(t))n+=p;
 if(/sport|football|celebrity|entertainment|movie|music|fashion|recipe|travel|quiz|crossword|weather forecast/i.test(t))n-=6;
 if(t.length<100)n--;
 return n;
}
function embed(x,manual=false){
 return new EmbedBuilder().setColor(0x3c3c3d).setTitle(clean(x.title,240)||'World News Update')
 .setDescription(clean(x.contentSnippet||x.content||x.description,900)||'Read the full report from BBC News.')
 .addFields({name:'SOURCE',value:'[Read the BBC article]('+x.link+')',inline:true},{name:'COVERAGE',value:'World News',inline:true})
 .setFooter({text:manual?'NRR • World News • Manual update':'NRR • World News • BBC'})
 .setTimestamp(x.isoDate?new Date(x.isoDate):new Date());
}
async function fetchStories(){
 const feeds=await Promise.all(FEEDS.map(u=>parser.parseURL(u).catch(e=>{console.error('BBC feed failed:',u,e.message);return null;})));
 const m=new Map(); for(const f of feeds)for(const x of f?.items||[])if(x.link&&x.title)m.set(key(x),x);
 return [...m.values()].sort((a,b)=>(Date.parse(b.isoDate||b.pubDate||'')||0)-(Date.parse(a.isoDate||a.pubDate||'')||0));
}
async function sent(k){const r=await db.query('SELECT 1 FROM nrr_news_sent WHERE story_key=$1',[k]);return !!r.rows[0];}
async function post(client,x,manual=false){
 const ch=await client.channels.fetch(NEWS_CHANNEL_ID).catch(()=>null);
 if(!ch?.isTextBased())throw new Error('World News channel is unavailable.');
 const m=await ch.send({embeds:[embed(x,manual)]});
 await db.query('INSERT INTO nrr_news_sent(story_key,title,channel_id,message_id,sent_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(story_key) DO NOTHING',[key(x),clean(x.title,240),ch.id,m.id]);
 return m;
}
async function dailyCount(){const r=await db.query("SELECT COUNT(*)::int AS n FROM nrr_news_sent WHERE sent_at >= date_trunc('day',NOW())");return Number(r.rows[0]?.n||0);}
async function collect(){
 const items=await fetchStories(), fresh=[];
 for(const x of items){const d=Date.parse(x.isoDate||x.pubDate||'')||0;if(d&&Date.now()-d>30*60*60*1000)continue;if(!(await sent(key(x)))&&score(x)>=4)fresh.push(x);}
 queue=fresh.sort((a,b)=>score(b)-score(a)||(Date.parse(b.isoDate||b.pubDate||'')||0)-(Date.parse(a.isoDate||a.pubDate||'')||0));
 console.log('World News: '+queue.length+' high-priority BBC stories available.');
}
async function publishNext(client,manual=false){
 if(busy)return {ok:false,reason:'busy'};busy=true;
 try{
  const items=await fetchStories();let x=queue.find(s=>items.some(y=>key(y)===key(s))&&!false);
  if(!x||await sent(key(x))){x=null;for(const s of items){const d=Date.parse(s.isoDate||s.pubDate||'')||0;if(d&&Date.now()-d>30*60*60*1000)continue;if(!(await sent(key(s)))){if(!x||score(s)>score(x))x=s;}}}
  if(!x)return {ok:false,reason:'empty'};
  if(!manual&&await dailyCount()>=MAX_DAILY)return {ok:false,reason:'limit'};
  const m=await post(client,x,manual);queue=queue.filter(s=>key(s)!==key(x));return {ok:true,message:m};
 }finally{busy=false;}
}
async function start(client){
 await db.query(`CREATE TABLE IF NOT EXISTS nrr_news_sent(story_key TEXT PRIMARY KEY,title TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL,sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_nrr_news_sent_date ON nrr_news_sent(sent_at DESC);`);
 await collect();
 if(timer)clearInterval(timer);
 timer=setInterval(async()=>{
  try{
   await collect();const n=await dailyCount();if(n>=MAX_DAILY)return;
   const now=Date.now(),slot=Math.floor(now/SLOT_MS),slotStart=slot*SLOT_MS;
   if(now-slotStart<POLL_MS)return;
   const last=await db.query("SELECT MAX(sent_at) AS last FROM nrr_news_sent WHERE sent_at >= date_trunc('day',NOW())");
   const lastAt=last.rows[0]?.last?new Date(last.rows[0].last).getTime():0;
   if(!lastAt||now-lastAt>=SLOT_MS-POLL_MS){const r=await publishNext(client,false);if(r.ok)console.log('Scheduled BBC story posted.');}
  }catch(e){console.error('News scheduler error:',e);}
 },POLL_MS);
 console.log('World News scheduler active: BBC feeds checked every 15 minutes.');
}
async function sendLatest(client,message){
 const r=await publishNext(client,true);
 if(r.ok)await message.reply('✅ Posted the latest available BBC news story.');
 else await message.reply('ℹ️ There are no new BBC stories available to post right now.');
}
async function sendCustom(interaction) {
 const { isSuperuser } = require('./access');
 const { config } = require('./config');
 const roleAllowed = config.eventManagerRoleIds?.some(id => interaction.member?.roles?.cache?.has(id));
 const allowed = isSuperuser(interaction.user?.id) || roleAllowed || interaction.memberPermissions?.has(require('discord.js').PermissionFlagsBits.ManageGuild);
 if (!allowed) return interaction.reply({content:'❌ You do not have permission to publish staff-made news posts.',ephemeral:true});
 const title=interaction.options.getString('topic',true).trim();
 const body=interaction.options.getString('message',true).trim();
 const image=interaction.options.getAttachment('image');
 if (image && !image.contentType?.startsWith('image/')) return interaction.reply({content:'❌ Please upload a valid image file.',ephemeral:true});
 const ch=await interaction.client.channels.fetch(NEWS_CHANNEL_ID).catch(()=>null);
 if(!ch?.isTextBased()) return interaction.reply({content:'❌ The World News channel is unavailable.',ephemeral:true});
 const e=new EmbedBuilder()
  .setColor(0x3c3c3d)
  .setTitle('📰 [PARODY] '+clean(title,220))
  .setDescription('**STAFF-MADE PARODY — NOT REAL NEWS**\\n\\n'+clean(body,3500))
  .addFields({name:'NOTICE',value:'This is a fictional / edited post created for entertainment. It is not verified reporting.',inline:false})
  .setFooter({text:'NRR • Staff-made parody • Not real news'})
  .setTimestamp();
 if(image) e.setImage(image.url);
 await ch.send({embeds:[e],allowedMentions:{parse:[]}});
 return interaction.reply({content:'✅ Your clearly labelled parody post has been published in <#'+NEWS_CHANNEL_ID+'>.',ephemeral:true});
}
module.exports={start,sendLatest,sendCustom,NEWS_CHANNEL_ID,score};
