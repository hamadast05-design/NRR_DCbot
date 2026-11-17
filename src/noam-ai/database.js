const db = require('../db');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS noam_knowledge_messages (
      message_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL, username TEXT NOT NULL DEFAULT 'Unknown', content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL, is_noam BOOLEAN NOT NULL DEFAULT FALSE,
      search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector
    );
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_search ON noam_knowledge_messages USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_user_date ON noam_knowledge_messages(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_channel_date ON noam_knowledge_messages(channel_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS noam_ai_curated_knowledge (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector
    );
    CREATE INDEX IF NOT EXISTS idx_noam_curated_search ON noam_ai_curated_knowledge USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS idx_noam_curated_guild_date ON noam_ai_curated_knowledge(guild_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS noam_ai_member_directory (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      position TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT 'community',
      authority_rank INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'active',
      bio TEXT NOT NULL DEFAULT '',
      achievements TEXT NOT NULL DEFAULT '',
      search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(guild_id, discord_id)
    );
    CREATE INDEX IF NOT EXISTS idx_noam_directory_rank ON noam_ai_member_directory(guild_id, authority_rank, display_name);
    ALTER TABLE noam_ai_member_directory ADD COLUMN IF NOT EXISTS search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector;
    DO $migration$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='noam_knowledge_messages'::regclass AND attname='search_vector' AND attgenerated <> '') THEN
        ALTER TABLE noam_knowledge_messages ALTER COLUMN search_vector DROP EXPRESSION;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='noam_ai_curated_knowledge'::regclass AND attname='search_vector' AND attgenerated <> '') THEN
        ALTER TABLE noam_ai_curated_knowledge ALTER COLUMN search_vector DROP EXPRESSION;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='noam_ai_member_directory'::regclass AND attname='search_vector' AND attgenerated <> '') THEN
        ALTER TABLE noam_ai_member_directory ALTER COLUMN search_vector DROP EXPRESSION;
      END IF;
    END
    $migration$;
    UPDATE noam_knowledge_messages SET search_vector=to_tsvector('simple'::regconfig,coalesce(content,'')) WHERE search_vector=''::tsvector;
    UPDATE noam_ai_curated_knowledge SET search_vector=to_tsvector('simple'::regconfig,coalesce(title,'') || ' ' || coalesce(category,'') || ' ' || coalesce(content,'')) WHERE search_vector=''::tsvector;
    UPDATE noam_ai_member_directory SET search_vector=to_tsvector('simple'::regconfig,coalesce(display_name,'') || ' ' || coalesce(position,'') || ' ' || coalesce(group_name,'') || ' ' || coalesce(array_to_string(aliases,' '),'') || ' ' || coalesce(bio,'') || ' ' || coalesce(achievements,'')) WHERE search_vector=''::tsvector;
    DROP INDEX IF EXISTS idx_noam_directory_name;
    CREATE INDEX IF NOT EXISTS idx_noam_directory_name ON noam_ai_member_directory USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS idx_noam_knowledge_search ON noam_knowledge_messages USING GIN(search_vector);
    CREATE INDEX IF NOT EXISTS idx_noam_curated_search ON noam_ai_curated_knowledge USING GIN(search_vector);
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
      (message_id,guild_id,channel_id,user_id,username,content,created_at,is_noam,search_vector)
    SELECT x.message_id,x.guild_id,x.channel_id,x.user_id,x.username,x.content,x.created_at::timestamptz,x.is_noam,
      to_tsvector('simple'::regconfig,coalesce(x.content,''))
    FROM jsonb_to_recordset($1::jsonb) AS x(
      message_id text,guild_id text,channel_id text,user_id text,username text,
      content text,created_at text,is_noam boolean
    )
    WHERE NOT EXISTS (SELECT 1 FROM noam_ai_optouts o WHERE o.user_id=x.user_id)
    ON CONFLICT (message_id) DO UPDATE SET content=EXCLUDED.content, username=EXCLUDED.username, is_noam=EXCLUDED.is_noam, search_vector=EXCLUDED.search_vector
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

function buildSearchQuery(queryText) {
  return String(queryText || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 12).join(' | ');
}
async function searchKnowledge(guildId, queryText, limit=10, officialChannelIds=[]) {
  const tsQuery=buildSearchQuery(queryText);
  if(!tsQuery) return [];
  const r=await db.query(`
    WITH q AS (SELECT to_tsquery('simple',$2) AS tsq),
    message_hits AS (
      SELECT m.username,m.user_id,m.content,m.created_at,m.is_noam,
        CASE WHEN m.channel_id=ANY($4::text[]) THEN 'official_discord' ELSE 'community_history' END AS source_type,
        CASE WHEN m.channel_id=ANY($4::text[]) THEN 'Official NRR Discord channel' ELSE 'Public Discord history' END AS source_label,
        ts_rank(m.search_vector,q.tsq) *
          CASE WHEN m.channel_id=ANY($4::text[]) THEN 2.5 ELSE 1.0 END AS relevance
      FROM noam_knowledge_messages m CROSS JOIN q
      WHERE m.guild_id=$1 AND m.search_vector @@ q.tsq
      ORDER BY relevance DESC,m.created_at DESC LIMIT 30
    ),
    curated_hits AS (
      SELECT 'NRR Knowledge Base'::text AS username,NULL::text AS user_id,k.content,
        k.updated_at AS created_at,FALSE AS is_noam,'curated_document'::text AS source_type,
        (k.category || ' — ' || k.title) AS source_label,
        ts_rank(k.search_vector,q.tsq)*5.0 AS relevance
      FROM noam_ai_curated_knowledge k CROSS JOIN q
      WHERE k.guild_id=$1 AND k.search_vector @@ q.tsq
      ORDER BY relevance DESC,k.updated_at DESC LIMIT 30
    )
    SELECT * FROM (
      SELECT * FROM curated_hits
      UNION ALL
      SELECT * FROM message_hits
    ) results
    ORDER BY CASE source_type WHEN 'curated_document' THEN 1 WHEN 'official_discord' THEN 2 ELSE 3 END, relevance DESC,created_at DESC LIMIT $3
  `,[guildId,tsQuery,limit,officialChannelIds]);
  return r.rows;
}
async function addCuratedKnowledge(guildId,category,title,content,createdBy) {
  const result=await db.query(`
    INSERT INTO noam_ai_curated_knowledge(guild_id,category,title,content,created_by,search_vector)
    VALUES($1,$2,$3,$4,$5,to_tsvector('simple'::regconfig,$3 || ' ' || $2 || ' ' || $4)) RETURNING id,category,title,created_at
  `,[guildId,String(category).slice(0,60),String(title).slice(0,120),String(content).slice(0,3500),createdBy]);
  return result.rows[0];
}
async function listCuratedKnowledge(guildId,limit=15) {
  const result=await db.query(`
    SELECT id,category,title,updated_at FROM noam_ai_curated_knowledge
    WHERE guild_id=$1 ORDER BY updated_at DESC LIMIT $2
  `,[guildId,limit]);
  return result.rows;
}
async function deleteCuratedKnowledge(guildId,id) {
  const result=await db.query('DELETE FROM noam_ai_curated_knowledge WHERE guild_id=$1 AND id=$2 RETURNING id',[guildId,id]);
  return Boolean(result.rowCount);
}
async function upsertDirectoryMember(guildId,record,createdBy) {
  const result=await db.query(`
    INSERT INTO noam_ai_member_directory
      (guild_id,discord_id,display_name,aliases,position,group_name,authority_rank,status,bio,achievements,created_by,search_vector)
    VALUES($1,$2,$3,$4::text[],$5,$6,$7,$8,$9,$10,$11,to_tsvector('simple'::regconfig,coalesce($3,'') || ' ' || coalesce($5,'') || ' ' || coalesce($6,'') || ' ' || coalesce(array_to_string($4::text[],' '),'') || ' ' || coalesce($9,'') || ' ' || coalesce($10,''))
    ON CONFLICT(guild_id,discord_id) DO UPDATE SET
      display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,position=EXCLUDED.position,
      group_name=EXCLUDED.group_name,authority_rank=EXCLUDED.authority_rank,status=EXCLUDED.status,
      bio=EXCLUDED.bio,achievements=EXCLUDED.achievements,search_vector=EXCLUDED.search_vector,updated_at=NOW()
    RETURNING discord_id,display_name,position,group_name,authority_rank,status
  `,[guildId,record.discordId,record.displayName,record.aliases,record.position,record.groupName,
    record.authorityRank,record.status,record.bio,record.achievements,createdBy]);
  return result.rows[0];
}
async function listDirectoryMembers(guildId,limit=30) {
  const r=await db.query(`
    SELECT discord_id,display_name,position,group_name,authority_rank,status
    FROM noam_ai_member_directory WHERE guild_id=$1
    ORDER BY authority_rank ASC,display_name ASC LIMIT $2
  `,[guildId,limit]);
  return r.rows;
}
async function deleteDirectoryMember(guildId,discordId) {
  const r=await db.query('DELETE FROM noam_ai_member_directory WHERE guild_id=$1 AND discord_id=$2 RETURNING discord_id',[guildId,discordId]);
  return Boolean(r.rowCount);
}
function buildDirectoryQuery(value) {
  return String(value||'').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,12).join(' | ');
}
async function searchDirectory(guildId,queryText,limit=12) {
  const terms=buildDirectoryQuery(queryText);
  const ids=[...String(queryText||'').matchAll(/\b\d{17,20}\b/g)].map(match=>match[0]);
  const r=await db.query(`
    SELECT discord_id,display_name,aliases,position,group_name,authority_rank,status,bio,achievements,
      CASE WHEN discord_id=ANY($3::text[]) THEN 100 ELSE ts_rank(search_vector,
        to_tsquery('simple',NULLIF($2,''))) END AS relevance
    FROM noam_ai_member_directory
    WHERE guild_id=$1 AND (
      discord_id=ANY($3::text[]) OR
      (NULLIF($2,'') IS NOT NULL AND search_vector @@ to_tsquery('simple',$2))
    )
    ORDER BY relevance DESC,authority_rank ASC LIMIT $4
  `,[guildId,terms,ids,limit]);
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
  const k=await db.query('SELECT COUNT(*)::int AS curated_count FROM noam_ai_curated_knowledge WHERE guild_id=$1',[process.env.DISCORD_GUILD_ID || '']);
  return {...(r.rows[0]||{}),...(s.rows[0]||{}),failures:e.rows,curated_count:k.rows[0]?.curated_count||0};
}
async function databaseDiagnostics() {
  const result = await db.query(`
    SELECT current_database() AS database_name,
      current_schema() AS schema_name,
      to_regclass('noam_knowledge_messages')::text AS knowledge_table,
      to_regclass('noam_ai_curated_knowledge')::text AS curated_table,
      to_regclass('noam_ai_member_directory')::text AS directory_table,
      to_regclass('noam_ai_conversations')::text AS conversations_table,
      to_regclass('noam_ai_optouts')::text AS optouts_table
  `);
  const schema = result.rows[0] || {};
  const checks = [
    ['knowledge', schema.knowledge_table],
    ['curated', schema.curated_table],
    ['member_directory', schema.directory_table],
    ['conversations', schema.conversations_table],
    ['optouts', schema.optouts_table],
  ];
  const missing = checks.filter(([, table]) => !table).map(([name]) => name);
  let searchVectors = {};
  if (!missing.length) {
    const vectors = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM noam_knowledge_messages WHERE search_vector IS NULL) AS knowledge_null_vectors,
        (SELECT COUNT(*)::int FROM noam_ai_curated_knowledge WHERE search_vector IS NULL) AS curated_null_vectors,
        (SELECT COUNT(*)::int FROM noam_ai_member_directory WHERE search_vector IS NULL) AS directory_null_vectors
    `);
    searchVectors = vectors.rows[0] || {};
  }
  return { ...schema, missing, searchVectors, ok: missing.length === 0 };
}
async function databaseCheck() {
  await db.query('SELECT 1 AS ok');
  const result = await databaseDiagnostics();
  if (!result.ok) {
    const error = new Error('Noam database schema is incomplete: ' + result.missing.join(', '));
    error.code = 'NOAM_SCHEMA_INCOMPLETE';
    error.diagnostics = result;
    throw error;
  }
  return result;
}
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
module.exports={migrate,storeMessages,isOptedOut,optOut,optIn,deleteMessage,searchKnowledge,addCuratedKnowledge,
  listCuratedKnowledge,deleteCuratedKnowledge,recentNoamMessages,getHistory,saveHistory,getWebhookCredentials,
  saveWebhookCredentials,collectionStats,getCollectionState,registerCollectionTarget,updateCollectionState,
  databaseCheck,databaseDiagnostics,clearCollectionErrors,recordCollectionError,upsertDirectoryMember,listDirectoryMembers,
  deleteDirectoryMember,searchDirectory};
