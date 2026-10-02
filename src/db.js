const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS event_configs (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      destination_channel_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      ended_at TIMESTAMPTZ,
      interface_channel_id TEXT,
      interface_message_id TEXT,
      stick_channel_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_event_configs_active ON event_configs(guild_id,active);

    CREATE TABLE IF NOT EXISTS event_submissions (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES event_configs(id) ON DELETE CASCADE,
      guild_id TEXT NOT NULL,
      submitter_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_name TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      auto_approve_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','auto-approved')),
      reviewed_at TIMESTAMPTZ,
      reviewer_id TEXT,
      review_channel_id TEXT,
      review_message_id TEXT,
      published_channel_id TEXT,
      published_message_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_event_submissions_due ON event_submissions(status,auto_approve_at);
    CREATE INDEX IF NOT EXISTS idx_event_submissions_event ON event_submissions(event_id,status);

    CREATE TABLE IF NOT EXISTS event_bot_messages (
      event_id BIGINT NOT NULL REFERENCES event_configs(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      message_type TEXT NOT NULL,
      PRIMARY KEY(event_id,message_id)
    );

    CREATE TABLE IF NOT EXISTS annihilate_sessions (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      runner_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      webhook_id TEXT NOT NULL,
      webhook_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      ended_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_annihilate_active_target
      ON annihilate_sessions(guild_id, target_id) WHERE active = TRUE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_annihilate_active_runner
      ON annihilate_sessions(guild_id, runner_id) WHERE active = TRUE;

    CREATE TABLE IF NOT EXISTS reputation_members (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      fame INTEGER NOT NULL DEFAULT 0 CHECK (fame >= 0),
      humiliation INTEGER NOT NULL DEFAULT 0 CHECK (humiliation >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS reputation_votes (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      vote_type TEXT NOT NULL CHECK (vote_type IN ('fame', 'humiliation')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reputation_admin_log (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_rep_votes_target ON reputation_votes (guild_id, target_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rep_votes_voter ON reputation_votes (guild_id, voter_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rep_votes_type ON reputation_votes (guild_id, vote_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rep_members_fame ON reputation_members (guild_id, fame DESC);
    CREATE INDEX IF NOT EXISTS idx_rep_members_humiliation ON reputation_members (guild_id, humiliation DESC);
    CREATE INDEX IF NOT EXISTS idx_rep_members_active ON reputation_members (guild_id, active);
  `);
}

async function ensureMember(guildId, userId, active = true) {
  await query(`
    INSERT INTO reputation_members (guild_id, user_id, active, last_seen_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET active = EXCLUDED.active, last_seen_at = NOW()
  `, [guildId, userId, active]);
}

async function setMemberActive(guildId, userId, active) {
  await ensureMember(guildId, userId, active);
}

async function getStats(guildId, userId) {
  const member = await query(`
    SELECT user_id, fame, humiliation, (fame - humiliation) AS score
    FROM reputation_members
    WHERE guild_id = $1 AND user_id = $2
  `, [guildId, userId]);

  const totals = await query(`
    SELECT
      COUNT(*) FILTER (WHERE voter_id = $2) AS given,
      COUNT(*) AS received
    FROM reputation_votes
    WHERE guild_id = $1 AND (voter_id = $2 OR target_id = $2)
  `, [guildId, userId]);

  return {
    fame: Number(member.rows[0]?.fame || 0),
    humiliation: Number(member.rows[0]?.humiliation || 0),
    score: Number(member.rows[0]?.score || 0),
    totalGiven: Number(totals.rows[0]?.given || 0),
    totalReceived: Number(totals.rows[0]?.received || 0) - Number(totals.rows[0]?.given || 0),
  };
}

async function getLastVote(guildId, voterId, targetId) {
  const result = await query(`
    SELECT vote_type, created_at
    FROM reputation_votes
    WHERE guild_id = $1 AND voter_id = $2 AND target_id = $3
    ORDER BY created_at DESC
    LIMIT 1
  `, [guildId, voterId, targetId]);
  return result.rows[0] || null;
}

async function castVote({ guildId, voterId, targetId, type, cooldownMs }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO reputation_members (guild_id, user_id)
      VALUES ($1, $2), ($1, $3)
      ON CONFLICT (guild_id, user_id) DO NOTHING
    `, [guildId, voterId, targetId]);

    const last = await client.query(`
      SELECT vote_type, created_at
      FROM reputation_votes
      WHERE guild_id = $1 AND voter_id = $2 AND target_id = $3
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `, [guildId, voterId, targetId]);

    if (last.rows[0]) {
      const elapsed = Date.now() - new Date(last.rows[0].created_at).getTime();
      if (elapsed < cooldownMs) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'cooldown', remainingMs: cooldownMs - elapsed };
      }
    }

    await client.query(`
      INSERT INTO reputation_votes (guild_id, voter_id, target_id, vote_type)
      VALUES ($1, $2, $3, $4)
    `, [guildId, voterId, targetId, type]);

    const column = type === 'fame' ? 'fame' : 'humiliation';
    const updated = await client.query(`
      UPDATE reputation_members
      SET ${column} = ${column} + 1, active = TRUE, last_seen_at = NOW()
      WHERE guild_id = $1 AND user_id = $2
      RETURNING fame, humiliation, (fame - humiliation) AS score
    `, [guildId, targetId]);

    await client.query('COMMIT');
    return { ok: true, stats: updated.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getLeaderboard(guildId, type, page, pageSize, showDeparted) {
  const offset = (page - 1) * pageSize;
  const order = type === 'fame'
    ? 'fame DESC, humiliation ASC, user_id ASC'
    : type === 'humiliation'
      ? 'humiliation DESC, fame DESC, user_id ASC'
      : '(fame - humiliation) DESC, fame DESC, user_id ASC';

  const activeClause = showDeparted ? '' : 'AND active = TRUE';
  const count = await query(`SELECT COUNT(*) FROM reputation_members WHERE guild_id = $1 ${activeClause}`, [guildId]);
  const rows = await query(`
    SELECT user_id, fame, humiliation, (fame - humiliation) AS score
    FROM reputation_members
    WHERE guild_id = $1 ${activeClause}
    ORDER BY ${order}
    LIMIT $2 OFFSET $3
  `, [guildId, pageSize, offset]);

  return { rows: rows.rows, total: Number(count.rows[0].count) };
}

async function getRank(guildId, userId, type, showDeparted) {
  const activeClause = showDeparted ? '' : 'AND active = TRUE';
  const expression = type === 'fame' ? 'fame' : type === 'humiliation' ? 'humiliation' : '(fame - humiliation)';
  const result = await query(`
    SELECT 1 + COUNT(*) AS rank
    FROM reputation_members r
    JOIN reputation_members me ON me.guild_id = r.guild_id AND me.user_id = $2
    WHERE r.guild_id = $1 ${activeClause}
      AND (${expression}) > (me.${type === 'reputation' ? 'fame - humiliation' : type})
  `, [guildId, userId]);
  return Number(result.rows[0]?.rank || 1);
}

async function getRanks(guildId, userId, showDeparted) {
  const stats = await getStats(guildId, userId);
  const activeClause = showDeparted ? '' : 'AND active = TRUE';
  const result = await query(`
    WITH me AS (
      SELECT fame, humiliation, (fame - humiliation) AS score
      FROM reputation_members WHERE guild_id = $1 AND user_id = $2
    )
    SELECT
      (SELECT 1 + COUNT(*) FROM reputation_members r, me WHERE r.guild_id = $1 ${activeClause} AND r.fame > me.fame) AS fame_rank,
      (SELECT 1 + COUNT(*) FROM reputation_members r, me WHERE r.guild_id = $1 ${activeClause} AND r.humiliation > me.humiliation) AS humiliation_rank,
      (SELECT 1 + COUNT(*) FROM reputation_members r, me WHERE r.guild_id = $1 ${activeClause} AND (r.fame-r.humiliation) > me.score) AS reputation_rank
  `, [guildId, userId]);
  return {
    ...stats,
    fameRank: Number(result.rows[0]?.fame_rank || 1),
    humiliationRank: Number(result.rows[0]?.humiliation_rank || 1),
    reputationRank: Number(result.rows[0]?.reputation_rank || 1),
  };
}

async function adminAdjust(guildId, adminId, targetId, type, amount) {
  const column = type === 'fame' ? 'fame' : 'humiliation';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO reputation_members (guild_id, user_id)
      VALUES ($1, $2) ON CONFLICT (guild_id, user_id) DO NOTHING
    `, [guildId, targetId]);
    const updated = await client.query(`
      UPDATE reputation_members
      SET ${column} = GREATEST(0, ${column} + $3)
      WHERE guild_id = $1 AND user_id = $2
      RETURNING fame, humiliation, (fame - humiliation) AS score
    `, [guildId, targetId, amount]);
    await client.query(`
      INSERT INTO reputation_admin_log (guild_id, admin_id, target_id, action, amount)
      VALUES ($1, $2, $3, $4, $5)
    `, [guildId, adminId, targetId, `${amount >= 0 ? 'add' : 'remove'}_${type}`, Math.abs(amount)]);
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function resetMember(guildId, adminId, targetId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(`
      UPDATE reputation_members SET fame = 0, humiliation = 0
      WHERE guild_id = $1 AND user_id = $2
      RETURNING fame, humiliation, (fame - humiliation) AS score
    `, [guildId, targetId]);
    await client.query(`
      INSERT INTO reputation_admin_log (guild_id, admin_id, target_id, action, amount)
      VALUES ($1, $2, $3, 'reset', 0)
    `, [guildId, adminId, targetId]);
    await client.query('COMMIT');
    return updated.rows[0] || { fame: 0, humiliation: 0, score: 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


async function createAnnihilateSession({ guildId, targetId, runnerId, channelId, webhookId, webhookToken }) {
  const result = await query(`
    INSERT INTO annihilate_sessions (guild_id, target_id, runner_id, channel_id, webhook_id, webhook_token)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `, [guildId, targetId, runnerId, channelId, webhookId, webhookToken]);
  return result.rows[0];
}

async function getAnnihilateByTarget(guildId, targetId) {
  const result = await query(`
    SELECT * FROM annihilate_sessions
    WHERE guild_id = $1 AND target_id = $2 AND active = TRUE
    LIMIT 1
  `, [guildId, targetId]);
  return result.rows[0] || null;
}

async function getAnnihilateByRunner(guildId, runnerId) {
  const result = await query(`
    SELECT * FROM annihilate_sessions
    WHERE guild_id = $1 AND runner_id = $2 AND active = TRUE
    LIMIT 1
  `, [guildId, runnerId]);
  return result.rows[0] || null;
}

async function getAnnihilateByRunnerGlobal(runnerId) {
  const result = await query(`
    SELECT * FROM annihilate_sessions
    WHERE runner_id = $1 AND active = TRUE
    ORDER BY created_at DESC
    LIMIT 1
  `, [runnerId]);
  return result.rows;
}

async function endAnnihilateSession(id) {
  await query(`
    UPDATE annihilate_sessions
    SET active = FALSE, ended_at = NOW()
    WHERE id = $1 AND active = TRUE
  `, [id]);
}

module.exports = {
  pool,
  query,
  migrate,
  ensureMember,
  setMemberActive,
  getStats,
  getLastVote,
  castVote,
  getLeaderboard,
  getRanks,
  adminAdjust,
  resetMember,
  createEvent,
  getActiveEvent,
  getEvent,
  recordEventInterface,
  getEventInterface,
  setStickChannel,
  createSubmission,
  getSubmission,
  setReviewMessage,
  rejectSubmission,
  claimSubmission,
  setPublishedMessage,
  getDueSubmissions,
  getEventBotMessages,
  endEvent,
  createAnnihilateSession,
  getAnnihilateByTarget,
  getAnnihilateByRunner,
  getAnnihilateByRunnerGlobal,
  endAnnihilateSession,
};
