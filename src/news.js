const { EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');

const NEWS_CHANNEL_ID = '1557292924113256489';
const NEWS_FEED_URL = 'https://feeds.bbci.co.uk/news/rss.xml';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_NEWS_MODEL || 'gpt-6-luna';
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

async function judgeNewsImportance(items) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured; AI news filtering is unavailable.');
  }

  const stories = items.map((item, index) => ({
    index,
    headline: normalizeText(item.title, 300),
    summary: normalizeText(item.contentSnippet || item.content || item.description, 700),
  }));

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: `You are the editorial gatekeeper for an international Discord world-news channel.

Judge whether each BBC Top Stories item is genuinely important enough to post as major world news.

POST stories that have substantial public or international significance, such as:
- major wars, conflicts, military escalations, terrorism, or major security developments
- major elections, government decisions, diplomatic developments, or leadership changes
- major international economic, financial, energy, or trade developments
- major natural disasters, accidents, outbreaks, or humanitarian crises
- major scientific, technological, space, or environmental developments with broad significance
- major legal or institutional developments with national/international consequences
- exceptionally significant human-interest events that are clearly major news

REJECT routine, minor, local, entertainment, celebrity, lifestyle, sports, travel, consumer, quirky, or human-interest stories unless their significance is clearly major.

Do not decide based on whether a story is political. Non-political stories can qualify when their real-world impact is substantial.

Be selective. The goal is to cut low-value BBC Top Stories substantially while still catching genuinely major breaking news.

Return ONLY valid JSON in this exact shape:
{"selected_indices":[0,2]}

The indices must refer to the supplied stories. Include only stories worth posting.`,
        },
        {
          role: 'user',
          content: JSON.stringify(stories),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI news filter failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const output = String(data.output_text || '').trim();
  const parsed = JSON.parse(output);

  if (!Array.isArray(parsed.selected_indices)) {
    throw new Error('OpenAI news filter returned an invalid selection.');
  }

  const validIndices = new Set(
    parsed.selected_indices.filter(index => Number.isInteger(index) && index >= 0 && index < items.length)
  );

  return items.filter((_, index) => validIndices.has(index));
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
      .reverse();

    if (!fresh.length) return;

    const selected = await judgeNewsImportance(fresh);
    const selectedIds = new Set(selected.map(storyId));

    for (const item of fresh) {
      seenIds.add(storyId(item));
    }

    const posts = selected.slice(-MAX_POSTS_PER_CHECK);

    for (const item of posts) {
      await channel.send({ embeds: [buildEmbed(item)] });
    }

    console.log(`AI news filter evaluated ${fresh.length} new stories and selected ${selected.length}; posted ${posts.length}.`);

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
    console.error('World news polling/filtering failed:', error);
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
