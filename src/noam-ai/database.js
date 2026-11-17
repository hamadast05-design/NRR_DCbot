const db = require('../db');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS noam_knowledge_messages (
      message_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT 'Unknown', content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL, is_noam BOOLEAN NOT NULL DEFAULT FALSE,
      search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED
    );
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_search ON noam_knowledge_messages USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_user_date ON noam_knowledge_messages(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_channel_date ON noam_knowledge_messages(channel_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS noam_ai_optouts (user_id TEXT PRIMARY KEY, opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS noam_ai_conversations (
      channel_id TEXT NOT NULL, user_id TEXT NOT NULL, history JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(channel_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS noam_ai_webhooks (
      channel_id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL, webhook_token TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS noam_ai_collection_state (
      channel_id TEXT PRIMARY KEY, before_message_id TEXT, completed BOOLEAN NOT NULL DEFAULT FALSE,
      messages_collected BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE noam_ai_collection_state ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE noam_ai_collection_state ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'public_channel';
    ALTER TABLE noam_ai_collection_state ADD COLUMN IF NOT EXISTS last_error TEXT;
    CREATE TABLE IF NOT EXISTS noam_ai_collection_errors (
      id BIGSERIAL PRIMARY KEY, parent_channel_id TEXT NOT NULL, stage TEXT NOT NULL, error TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    UPDATE noam_ai_collection_state SET status=CASE WHEN completed THEN 'completed' ELSE 'pending' END WHERE status='pending' AND completed=TRUE;
  `);
}

function hasSensitivePattern(content) {
  const text = String(content || '');
  return [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+?\d[\d\s().-]{7,}\d)/,
    /\b(?:password|passwd|api[_ -]?key|secret token)\s*[:=]\s*\S+/i,
    /\b(?:\d[ -]*?){13,19}\b/,
  ].some(pattern => pattern.test(text));
}

async function storeMessages(messages) {
  const safe = messages.filter(m => m?.messageId && m.guildId && m.channelId && m.userId &&
    String(m.content || '').trim().length >= 3 && String(m.content || '').length <= 4000 &&
    !hasSensitivePattern(m.content));
  if (!safe.length) return 0;
  const payload = safe.map(m => ({
    message_id:m.messageId, guild_id:m.guildId, channel_id:m.channelId, user_id:m.userId,
    username:String(m.username || 'Unknown').slice(0,100), content:String(m.content).slice(0,4000),
    created_at:m.createdAt, is_noam:Boolean(m.isNoam),
  }));
  const result = await db.query(`
    INSERT INTO noam_knowledge_messages
      (message_id,guild_id,channel_id,user_id,username,content,created_at,is_noam)
    SELECT x.message_id,x.guild_id,x.channel_id,x.user_id,x.username,x.content,x.created_at::timestamptz,x.is_noam
    FROM jsonb_to_recordset($1::jsonb) AS x(
      message_id text,guild_id text,channel_id text,user_id text,username text,
      content text,created_at text,is_noam boolean
    )
    WHERE NOT EXISTS (SELECT 1 FROM noam_ai_optouts o WHERE o.user_id=x.user_id)
    ON CONFLICT (message_id) DO UPDATE SET content=EXCLUDED.content, username=EXCLUDED.username, is_noam=EXCLUDED.is_noam
    RETURNING message_id
  `, [JSON.stringify(payload)]);
  return result.rowCount || 0;
}

async function isOptedOut(userId) {
  const r=await db.query('SELECT 1 FROM noam_ai_optouts WHERE user_id=$1',[userId]); return Boolean(r.rowCount);
}
async function optOut(userId) {
  await db.query(`
    WITH optout AS (
      INSERT INTO noam_ai_optouts(user_id) VALUES($1)
      ON CONFLICT(user_id) DO UPDATE SET opted_out_at=NOW()
      RETURNING user_id
    )
    DELETE FROM noam_knowledge_messages
    WHERE user_id IN (SELECT user_id FROM optout)
  `,[userId]);
  await db.query('DELETE FROM noam_ai_conversations WHERE user_id=$1',[userId]);
}
async function optIn(userId) { await db.query('DELETE FROM noam_ai_optouts WHERE user_id=$1',[userId]); }
async function deleteMessage(messageId) { await db.query('DELETE FROM noam_knowledge_messages WHERE message_id=$1',[messageId]); }

async function searchKnowledge(guildId, queryText, limit=6) {
  const normalized=String(queryText||'').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().slice(0,300);
  if(!normalized) return [];
  const r=await db.query(`
    SELECT username,user_id,content,created_at,is_noam,ts_rank(search_vector,plainto_tsquery('simple',$2)) AS relevance
    FROM noam_knowledge_messages WHERE guild_id=$1 AND search_vector @@ plainto_tsquery('simple',$2)
    ORDER BY relevance DESC,created_at DESC LIMIT $3
  `,[guildId,normalized,limit]);
  return r.rows;
}
async function recentNoamMessages(guildId,noamIds,limit=8) {
  const r=await db.query(`
    SELECT username,content,created_at FROM noam_knowledge_messages
    WHERE guild_id=$1 AND user_id=ANY($2::text[]) AND is_noam=TRUE
    ORDER BY created_at DESC LIMIT $3
  `,[guildId,noamIds,limit]);
  return r.rows;
}
async function getHistory(channelId,userId) {
  const r=await db.query('SELECT history FROM noam_ai_conversations WHERE channel_id=$1 AND user_id=$2',[channelId,userId]);
  return Array.isArray(r.rows[0]?.history)?r.rows[0].history:[];
}
async function saveHistory(channelId,userId,history) {
  await db.query(`
    INSERT INTO noam_ai_conversations(channel_id,user_id,history,updated_at) VALUES($1,$2,$3::jsonb,NOW())
    ON CONFLICT(channel_id,user_id) DO UPDATE SET history=EXCLUDED.history,updated_at=NOW()
  `,[channelId,userId,JSON.stringify(history.slice(-16))]);
}
async function getWebhookCredentials(channelId) {
  const r=await db.query('SELECT webhook_id,webhook_token FROM noam_ai_webhooks WHERE channel_id=$1',[channelId]);
  return r.rows[0]||null;
}
async function saveWebhookCredentials(channelId,webhookId,webhookToken) {
  await db.query(`
    INSERT INTO noam_ai_webhooks(channel_id,webhook_id,webhook_token,updated_at)
    VALUES($1,$2,$3,NOW())
    ON CONFLICT(channel_id) DO UPDATE SET webhook_id=EXCLUDED.webhook_id,
      webhook_token=EXCLUDED.webhook_token,updated_at=NOW()
  `,[channelId,webhookId,webhookToken]);
}
async function collectionStats() {
  const r=await db.query(`
    SELECT COUNT(*)::bigint AS total,COUNT(*) FILTER(WHERE is_noam)::bigint AS noam_messages,
      COUNT(DISTINCT channel_id)::int AS channels,MAX(created_at) AS newest FROM noam_knowledge_messages
  `);
  const s=await db.query(`
    SELECT COUNT(*)::int AS total_targets,
      COUNT(*) FILTER(WHERE status='completed' OR completed)::int AS completed_channels,
      COUNT(*) FILTER(WHERE status='failed')::int AS failed_channels,
      COUNT(*) FILTER(WHERE status='pending' OR status='running')::int AS pending_channels,
      COALESCE(SUM(messages_collected),0)::bigint AS collected
    FROM noam_ai_collection_state
  `);
  const e=await db.query(`SELECT channel_id,target_type,last_error,updated_at FROM noam_ai_collection_state WHERE status='failed' ORDER BY updated_at DESC LIMIT 8`);
  return {...(r.rows[0]||{}),...(s.rows[0]||{}),failures:e.rows};
}
async function databaseCheck() { await db.query('SELECT 1 AS ok'); return true; }
async function clearCollectionErrors() { await db.query('DELETE FROM noam_ai_collection_errors'); }
async function recordCollectionError(parentChannelId,stage,error) {
  await db.query('INSERT INTO noam_ai_collection_errors(parent_channel_id,stage,error) VALUES($1,$2,$3)',[parentChannelId,stage,String(error||'Unknown error').slice(0,500)]);
}
async function getCollectionState(channelId) {
  const r=await db.query('SELECT * FROM noam_ai_collection_state WHERE channel_id=$1',[channelId]); return r.rows[0]||null;
}
async function registerCollectionTarget(channelId,targetType='public_channel') {
  await db.query(`
    INSERT INTO noam_ai_collection_state(channel_id,target_type,status,completed,updated_at)
    VALUES($1,$2,'pending',FALSE,NOW())
    ON CONFLICT(channel_id) DO UPDATE SET target_type=EXCLUDED.target_type,
      status=CASE WHEN noam_ai_collection_state.completed THEN 'completed' ELSE noam_ai_collection_state.status END,
      updated_at=NOW()
  `,[channelId,targetType]);
}
async function updateCollectionState(channelId,beforeMessageId,completed,increment=0,error=null) {
  const status=completed?'completed':(error?'failed':'running');
  await db.query(`
    INSERT INTO noam_ai_collection_state(channel_id,before_message_id,completed,messages_collected,status,last_error,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT(channel_id) DO UPDATE SET before_message_id=COALESCE(EXCLUDED.before_message_id,noam_ai_collection_state.before_message_id),
      completed=EXCLUDED.completed,messages_collected=noam_ai_collection_state.messages_collected+EXCLUDED.messages_collected,
      status=EXCLUDED.status,last_error=EXCLUDED.last_error,updated_at=NOW()
  `,[channelId,beforeMessageId,completed,increment,status,error]);
}
module.exports={migrate,storeMessages,isOptedOut,optOut,optIn,deleteMessage,searchKnowledge,recentNoamMessages,
  getHistory,saveHistory,getWebhookCredentials,saveWebhookCredentials,collectionStats,getCollectionState,registerCollectionTarget,updateCollectionState,databaseCheck,clearCollectionErrors,recordCollectionError};
