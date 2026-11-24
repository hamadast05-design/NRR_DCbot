const { EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { hasPermission } = require('./access');

const CHANNEL_ID = '1523792685478051892';
const TIME_ZONE = 'Asia/Riyadh';
const MAX_PER_DAY = 3;
const MIN_GAP_MS = 60 * 60 * 1000;
const EMBED_COLOR = 0x3c3c3d;
const DISC_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/727/727218.png';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
let scheduler = null;
let schedulerBusy = false;

function astParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
function astDateKey(date = new Date()) {
  const p = astParts(date);
  return p.year + '-' + p.month + '-' + p.day;
}
function astMinuteOfDay(date = new Date()) {
  const p = astParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
}
function randomSchedule() {
  const start = 14 * 60, end = 23 * 60 + 59, times = [];
  let attempts = 0;
  while (times.length < MAX_PER_DAY && attempts++ < 10000) {
    const candidate = start + Math.floor(Math.random() * (end - start + 1));
    if (times.every(value => Math.abs(value - candidate) >= 60)) times.push(candidate);
  }
  return times.sort((a, b) => a - b);
}
async function ensureSchedule() {
  const dateKey = astDateKey();
  const existing = await db.query('SELECT scheduled_minutes FROM nrr_album_cover_schedule WHERE schedule_date=$1', [dateKey]);
  if (existing.rowCount) return existing.rows[0].scheduled_minutes;
  await db.query(
    'INSERT INTO nrr_album_cover_schedule(schedule_date, scheduled_minutes) VALUES($1,$2::jsonb) ON CONFLICT(schedule_date) DO NOTHING',
    [dateKey, JSON.stringify(randomSchedule())]
  );
  const saved = await db.query('SELECT scheduled_minutes FROM nrr_album_cover_schedule WHERE schedule_date=$1', [dateKey]);
  return saved.rows[0].scheduled_minutes;
}
function buildEmbed() {
  return new EmbedBuilder().setColor(EMBED_COLOR)
    .setAuthor({ name: '\u200B', iconURL: DISC_ICON_URL })
    .setTitle('NAME THE ALBUM COVER');
}
async function sendRandom(client, channel = null) {
  const destination = channel || await client.channels.fetch(CHANNEL_ID);
  if (!destination?.isTextBased() || typeof destination.send !== 'function') throw new Error('Album Cover destination channel is unavailable or not sendable.');
  const selected = await db.query('SELECT id, image_data, filename FROM nrr_album_cover_images ORDER BY RANDOM() LIMIT 1');
  if (!selected.rowCount) throw new Error('The Album Cover image bank is empty.');
  const image = selected.rows[0];
  const filename = (image.filename || 'album-cover-image.png').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const attachment = new AttachmentBuilder(image.image_data, { name: filename, description: 'Random Name The Album Cover image' });
  await destination.send({ embeds: [buildEmbed().setImage('attachment://' + filename)], files: [attachment] });
  return image.id;
}
async function sendScheduled(client) {
  const now = new Date(), minute = astMinuteOfDay(now);
  if (minute < 14 * 60) return;
  const dateKey = astDateKey(now), schedule = await ensureSchedule();
  const sent = await db.query('SELECT scheduled_minute, sent_at FROM nrr_album_cover_posts WHERE schedule_date=$1 ORDER BY sent_at ASC', [dateKey]);
  if (sent.rowCount >= MAX_PER_DAY) return;
  if (sent.rows.length && now.getTime() - new Date(sent.rows[sent.rows.length - 1].sent_at).getTime() < MIN_GAP_MS) return;
  const due = schedule.find(value => value <= minute && !sent.rows.some(row => Number(row.scheduled_minute) === value));
  if (due === undefined) return;
  const claim = await db.query(
    'INSERT INTO nrr_album_cover_posts(schedule_date, scheduled_minute, sent_at) VALUES($1,$2,NOW()) ON CONFLICT DO NOTHING RETURNING id',
    [dateKey, due]
  );
  if (!claim.rowCount) return;
  try { await sendRandom(client); }
  catch (error) {
    await db.query('DELETE FROM nrr_album_cover_posts WHERE id=$1', [claim.rows[0].id]).catch(() => {});
    throw error;
  }
}
function startScheduler(client) {
  if (scheduler) clearInterval(scheduler);
  const tick = async () => {
    if (schedulerBusy) return;
    schedulerBusy = true;
    try { await sendScheduled(client); }
    catch (error) { console.error('[AlbumCover] Scheduled send failed:', error); }
    finally { schedulerBusy = false; }
  };
  void tick();
  scheduler = setInterval(() => void tick(), 60 * 1000);
  console.log('[AlbumCover] Random daily scheduler started (14:00–23:59 AST, max 3/day).');
}
async function storeImage(message) {
  const attachment = message.attachments.first();
  if (!attachment) return message.reply('📷 Attach an image to !storeimg so I can add it to the Album Cover bank.');
  if (!attachment.contentType?.startsWith('image/')) return message.reply('❌ Please attach an image file.');
  if (attachment.size > MAX_IMAGE_BYTES) return message.reply('❌ That image is too large. The maximum size is 8 MB.');
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error('Could not download the attached image (HTTP ' + response.status + ').');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Image size is invalid or exceeds 8 MB.');
  await db.query('INSERT INTO nrr_album_cover_images(filename, content_type, image_data, added_by) VALUES($1,$2,$3,$4)',
    [attachment.name || 'album-cover-image', attachment.contentType, buffer, message.author.id]);
  await message.reply('✅ Image added to the Name The Album Cover bank!');
}
async function handlePrefixMessage(message) {
  if (!message.guild || message.author.bot || message.webhookId) return false;
  const raw = message.content.trim().toLowerCase();
  if (raw !== '!storeimg' && raw !== '!sendalbum') return false;
  if (!hasPermission(message.author.id, message.member?.permissions, PermissionFlagsBits.ManageGuild, message.member)) {
    await message.reply('❌ You need Manage Server permission to manage Name The Album Cover.');
    return true;
  }
  if (raw === '!storeimg') {
    try { await storeImage(message); }
    catch (error) {
      console.error('[AlbumCover] Image storage failed:', error);
      await message.reply('❌ I could not store that image. Please try again.').catch(() => {});
    }
    return true;
  }
  // Keep manual album drops discreet: remove the trigger before posting, with no success reply.
  await message.delete().catch(error => {
    console.warn('[AlbumCover] Could not delete !sendalbum command message:', error.message);
  });
  try {
    await sendRandom(message.client, message.channel);
  } catch (error) {
    console.error('[AlbumCover] Manual send failed:', error);
    await message.reply(error.message.includes('bank is empty')
      ? '📭 The Album Cover image bank is empty. Use !storeimg with an attached image first.'
      : '❌ I could not post an Album Cover right now.').catch(() => {});
  }
  return true;
}
async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS nrr_album_cover_images (
      id BIGSERIAL PRIMARY KEY, filename TEXT NOT NULL, content_type TEXT NOT NULL,
      image_data BYTEA NOT NULL, added_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS nrr_album_cover_schedule (
      schedule_date DATE PRIMARY KEY, scheduled_minutes JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nrr_album_cover_posts (
      id BIGSERIAL PRIMARY KEY, schedule_date DATE NOT NULL, scheduled_minute INTEGER NOT NULL, sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(schedule_date, scheduled_minute)
    );
    -- Upgrade installations where this table predates scheduled_minute.
    ALTER TABLE nrr_album_cover_posts
      ADD COLUMN IF NOT EXISTS scheduled_minute INTEGER;
    UPDATE nrr_album_cover_posts
      SET scheduled_minute = (EXTRACT(HOUR FROM sent_at) * 60 + EXTRACT(MINUTE FROM sent_at))::INTEGER
      WHERE scheduled_minute IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_nrr_album_cover_posts_schedule_minute
      ON nrr_album_cover_posts(schedule_date, scheduled_minute)
      WHERE scheduled_minute IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_nrr_album_cover_posts_date ON nrr_album_cover_posts(schedule_date, sent_at);
  `);
}
module.exports = { migrate, startScheduler, handlePrefixMessage, sendRandom };
