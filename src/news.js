const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');

const NEWS_CHANNEL_ID = '1557292924113256489';
const NEWS_FEED_URL = 'https://feeds.bbci.co.uk/news/rss.xml';
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const MAX_POSTS_PER_CHECK = 3;

const parser = new Parser({ timeout: 15_000 });

const seenIds = new Set();
let initialized = false;
let polling = false;

function normalizeText(value, maxLength = 500) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function storyId(item) {
  return String(item.guid || item.id || item.link || item.title || '').trim();
}

function buildEmbed(item) {
  const title = normalizeText(item.title, 256) || 'New World News';
  const summary = normalizeText(item.contentSnippet || item.content || item.description, 900);
  const embed = new EmbedBuilder()
    .setTitle(`🌍 ${title}`)
    .setURL(item.link)
    .setColor(0x5865f2)
    .setFooter({ text: 'BBC News • NRR World News' })
    .setTimestamp(item.isoDate ? new Date(item.isoDate) : new Date());

  if (summary) embed.setDescription(summary);
  embed.addFields({ name: '📰 Full Article', value: `[Read the full article](${item.link})` });

  return embed;
}

async function fetchFeed() {
  const feed = await parser.parseURL(NEWS_FEED_URL);
  return (feed.items || [])
    .filter(item => item.link && storyId(item))
    .sort((a, b) => {
      const aTime = Date.parse(a.isoDate || a.pubDate || '') || 0;
      const bTime = Date.parse(b.isoDate || b.pubDate || '') || 0;
      return bTime - aTime;
    });
}

async function poll(client, { initial = false } = {}) {
  if (polling) return;
  polling = true;

  try {
    const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) {
      console.error(`News channel ${NEWS_CHANNEL_ID} is unavailable or not text-based.`);
      return;
    }

    const items = await fetchFeed();

    if (initial) {
      for (const item of items) seenIds.add(storyId(item));
      initialized = true;
      console.log(`News system initialized with ${Math.min(items.length, 10)} current BBC stories.`);
      return;
    }

    if (!initialized) {
      for (const item of items) seenIds.add(storyId(item));
      initialized = true;
      return;
    }

    const fresh = items
      .filter(item => !seenIds.has(storyId(item)))
      .reverse()
      .slice(-MAX_POSTS_PER_CHECK);

    for (const item of fresh) {
      seenIds.add(storyId(item));
      await channel.send({ embeds: [buildEmbed(item)] });
    }

    if (seenIds.size > 500) {
      const keep = new Set(items.map(storyId));
      for (const id of seenIds) {
        if (!keep.has(id)) seenIds.delete(id);
      }
    }

    if (fresh.length) {
      console.log(`Posted ${fresh.length} new world news stor${fresh.length === 1 ? 'y' : 'ies'}.`);
    }
  } catch (error) {
    console.error('World news polling failed:', error);
  } finally {
    polling = false;
  }
}

function start(client) {
  poll(client, { initial: true }).catch(error => console.error('Initial world news sync failed:', error));
  setInterval(() => poll(client), POLL_INTERVAL_MS);
  console.log('World news system started. Polling BBC News every 5 minutes.');
}

module.exports = { start };
