const { randomInt, randomUUID } = require('node:crypto');
const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('./db');
const { config } = require('./config');

const CLAIM_PREFIX = 'santa:open:';
const SHAKE_DURATION_MS = 3000;
const REVEAL_DURATION_MS = 1400;
const text = content => new TextDisplayBuilder().setContent(content);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const GIFTS = [
  { id: 'golden-surprise', category: 'golden', weight: 500, emoji: '🌟', title: 'The Golden Surprise', description: 'Santa reached into the very bottom of his sack and found something extraordinary. You have officially made the nice list!' },
  { id: 'chocolates', category: 'ordinary', weight: 1000, emoji: '🍫', title: 'A Box of Chocolates', description: 'A delicious little Christmas treat. Santa says sharing is optional.' },
  { id: 'mystery-envelope', category: 'ordinary', weight: 1000, emoji: '✉️', title: 'A Mysterious Envelope', description: 'There is absolutely nothing suspicious about this envelope. Santa insists you do not ask questions.' },
  { id: 'festive-greeting', category: 'ordinary', weight: 1000, emoji: '💌', title: 'A Festive Greeting', description: 'Santa sent you his warmest wishes and a reminder to enjoy the season.' },
  { id: 'golden-bell', category: 'ordinary', weight: 1000, emoji: '🔔', title: 'A Golden Bell', description: 'A tiny golden bell. It makes a very satisfying jingle.' },
  { id: 'snow-globe', category: 'ordinary', weight: 1000, emoji: '❄️', title: 'A Tiny Snow Globe', description: 'A little winter wonderland, delivered straight from Santa’s sack.' },
  { id: 'candy-cane', category: 'ordinary', weight: 1000, emoji: '🍬', title: 'A Suspiciously Large Candy Cane', description: 'It is enormous. Santa refuses to explain why.' },
  { id: 'wrapped-present', category: 'ordinary', weight: 1000, emoji: '🎁', title: 'A Beautiful Present', description: 'A neatly wrapped Christmas present. Whatever is inside, Santa picked it just for you.' },
  { id: 'lump-of-coal', category: 'naughty', weight: 625, emoji: '🪨', title: 'A Lump of Coal', description: 'Santa checked the list twice. Apparently, this is what happens when you are on the naughty list. 💀' },
  { id: 'empty-box', category: 'naughty', weight: 625, emoji: '📦', title: 'An Empty Gift Box', description: 'The wrapping is beautiful. The contents are... missing. Santa may have forgotten something.' },
  { id: 'christmas-potato', category: 'naughty', weight: 625, emoji: '🥔', title: 'A Christmas Potato', description: 'A potato. Wrapped with care. Santa says it is a limited edition.' },
  { id: 'forgotten-gift', category: 'naughty', weight: 625, emoji: '🤷', title: 'Santa Forgot Your Gift', description: 'Santa has checked the sack, the sleigh and his list. He has absolutely no idea where your present went.' },
];

const TOTAL_WEIGHT = GIFTS.reduce((total, gift) => total + gift.weight, 0);

const command = new SlashCommandBuilder()
  .setName('santa_gift')
  .setDescription('See what Santa brought you in a public mystery gift reveal.');

function validUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function addImage(container, url, description) {
  const safeUrl = validUrl(url);
  if (!safeUrl) return;
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(safeUrl).setDescription(description)
    )
  );
}

function payload(container) {
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

function buildWaitingMessage(claim) {
  const container = new ContainerBuilder().setAccentColor(0xB71C1C);
  addImage(container, config.santaGiftSackImageUrl, 'Santa’s mysterious gift sack');
  container.addTextDisplayComponents(
    text('# 🎅 Santa’s Gift Delivery'),
    text('Ho ho ho! Santa has left something special for you. There is only one way to find out what is inside...'),
    text('## 🎁 YOUR GIFT IS WAITING\nClick below to discover your surprise!')
  );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CLAIM_PREFIX + claim.claim_id)
      .setLabel('OPEN MY GIFT')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Success)
  ));
  container.addTextDisplayComponents(text('-# NRR • Santa’s Gift Delivery'));
  return container;
}

function buildOpeningMessage() {
  const container = new ContainerBuilder().setAccentColor(0xB8860B);
  addImage(container, config.santaGiftShakeGifUrl, 'Santa’s gift sack shaking');
  container.addTextDisplayComponents(
    text('# 🎅 Santa is checking his sack...'),
    text('## 🎁 Something is moving inside!'),
    text('The ribbons are shaking, the bells are jingling... what could it be?')
  );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('santa:opening')
      .setLabel('OPENING...')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  ));
  return container;
}

function buildRevealMessage() {
  const container = new ContainerBuilder().setAccentColor(0xD4AF37);
  addImage(container, config.santaGiftRevealGifUrl, 'A magical Christmas gift reveal');
  container.addTextDisplayComponents(
    text('# ✨ THE MOMENT OF TRUTH'),
    text('Santa is revealing your surprise...')
  );
  return container;
}

function resultImageUrl(category) {
  if (category === 'golden') return config.santaGiftGoldenImageUrl;
  if (category === 'naughty') return config.santaGiftNaughtyImageUrl;
  return config.santaGiftOrdinaryImageUrl;
}

function buildResultMessage(userId, gift) {
  const colors = { golden: 0xD4AF37, ordinary: 0x287A4B, naughty: 0x8B1E1E };
  const headings = { golden: '🌟 A GOLDEN GIFT!', ordinary: '🎁 A CHRISTMAS SURPRISE!', naughty: '💀 SANTA HAS SPOKEN...' };
  const container = new ContainerBuilder().setAccentColor(colors[gift.category] || 0xB71C1C);
  addImage(container, resultImageUrl(gift.category), gift.title);
  container.addTextDisplayComponents(
    text('# ' + headings[gift.category]),
    text('Santa brought ' + '<@' + userId + '>...'),
    text('## ' + gift.emoji + ' ' + gift.title),
    text(gift.description),
    text('-# This is a purely cosmetic NRR seasonal surprise. No coins, roles or member data are changed.')
  );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('santa:opened')
      .setLabel('GIFT OPENED')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  ));
  container.addTextDisplayComponents(text('-# NRR • Santa’s Gift Delivery'));
  return container;
}

function chooseGift() {
  let ticket = randomInt(TOTAL_WEIGHT);
  for (const gift of GIFTS) {
    ticket -= gift.weight;
    if (ticket < 0) return gift;
  }
  return GIFTS[GIFTS.length - 1];
}

async function migrate() {
  await db.query(
    'CREATE TABLE IF NOT EXISTS santa_gift_claims (' +
    'claim_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, ' +
    'channel_id TEXT NOT NULL, message_id TEXT, gift_id TEXT, ' +
    "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','opening','completed','expired')), " +
    'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, ' +
    'opened_at TIMESTAMPTZ, completed_at TIMESTAMPTZ)'
  );
  await db.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_santa_gift_one_active_claim " +
    "ON santa_gift_claims (guild_id, user_id) WHERE status IN ('pending','opening')"
  );
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_santa_gift_message ON santa_gift_claims (message_id) WHERE message_id IS NOT NULL'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_santa_gift_cooldown ON santa_gift_claims (guild_id, user_id, opened_at DESC) WHERE opened_at IS NOT NULL'
  );
  await db.query(
    "UPDATE santa_gift_claims SET status = 'expired' WHERE status = 'pending' AND expires_at <= NOW()"
  );
}

async function createClaim({ guildId, userId, channelId, claimId }) {
  await db.query(
    "UPDATE santa_gift_claims SET status = 'expired' " +
    "WHERE guild_id = $1 AND user_id = $2 AND status = 'pending' AND expires_at <= NOW()",
    [guildId, userId]
  );

  const pending = await db.query(
    "SELECT claim_id, channel_id, message_id, expires_at FROM santa_gift_claims " +
    "WHERE guild_id = $1 AND user_id = $2 AND status = 'pending' AND expires_at > NOW() " +
    'ORDER BY created_at DESC LIMIT 1',
    [guildId, userId]
  );
  if (pending.rows[0]) return { ok: false, reason: 'pending', claim: pending.rows[0] };

  const recent = await db.query(
    "SELECT opened_at FROM santa_gift_claims " +
    "WHERE guild_id = $1 AND user_id = $2 AND status IN ('opening','completed') " +
    "AND opened_at > NOW() - ($3::bigint * INTERVAL '1 millisecond') " +
    'ORDER BY opened_at DESC LIMIT 1',
    [guildId, userId, config.santaGiftCooldownMs]
  );
  if (recent.rows[0]) {
    const elapsed = Date.now() - new Date(recent.rows[0].opened_at).getTime();
    return { ok: false, reason: 'cooldown', remainingMs: Math.max(0, config.santaGiftCooldownMs - elapsed) };
  }

  try {
    const inserted = await db.query(
      "INSERT INTO santa_gift_claims (claim_id, guild_id, user_id, channel_id, status, expires_at) " +
      "VALUES ($1, $2, $3, $4, 'pending', NOW() + ($5::bigint * INTERVAL '1 millisecond')) RETURNING *",
      [claimId, guildId, userId, channelId, config.santaGiftPendingMs]
    );
    return { ok: true, claim: inserted.rows[0] };
  } catch (error) {
    if (error.code !== '23505') throw error;
    const active = await db.query(
      "SELECT claim_id, channel_id, message_id, expires_at FROM santa_gift_claims " +
      "WHERE guild_id = $1 AND user_id = $2 AND status = 'pending' AND expires_at > NOW() " +
      'ORDER BY created_at DESC LIMIT 1',
      [guildId, userId]
    );
    if (active.rows[0]) return { ok: false, reason: 'pending', claim: active.rows[0] };
    const cooldown = await db.query(
      "SELECT opened_at FROM santa_gift_claims WHERE guild_id = $1 AND user_id = $2 " +
      "AND status IN ('opening','completed') ORDER BY opened_at DESC LIMIT 1",
      [guildId, userId]
    );
    if (cooldown.rows[0]) {
      const elapsed = Date.now() - new Date(cooldown.rows[0].opened_at).getTime();
      return { ok: false, reason: 'cooldown', remainingMs: Math.max(0, config.santaGiftCooldownMs - elapsed) };
    }
    throw error;
  }
}

function formatRemaining(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? hours + 'h ' + remainingMinutes + 'm' : minutes + 'm';
}

async function handleCommand(interaction) {
  if (!interaction.inGuild() || !interaction.guildId) {
    return interaction.reply({ content: '❌ Santa’s Gift Delivery can only be used inside NRR.', ephemeral: true });
  }
  if (!interaction.channel?.isTextBased?.()) {
    return interaction.reply({ content: '❌ I cannot post Santa’s gift in this channel.', ephemeral: true });
  }

  const claimId = randomUUID();
  let claimResult;
  try {
    claimResult = await createClaim({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      channelId: interaction.channelId,
      claimId,
    });
  } catch (error) {
    console.error('[SantaGift] Could not create claim:', error);
    return interaction.reply({ content: '❌ Santa could not prepare your gift right now. Please try again later.', ephemeral: true });
  }

  if (!claimResult.ok && claimResult.reason === 'cooldown') {
    return interaction.reply({
      content: '🎅 Santa already visited you recently! You can open another gift in **' + formatRemaining(claimResult.remainingMs) + '**.',
      ephemeral: true,
    });
  }
  if (!claimResult.ok && claimResult.reason === 'pending') {
    const existing = claimResult.claim;
    const link = existing.message_id
      ? '\n[Jump to your waiting gift](https://discord.com/channels/' + interaction.guildId + '/' + existing.channel_id + '/' + existing.message_id + ')'
      : '\nSanta is still preparing your gift. Please wait a moment.';
    return interaction.reply({
      content: '🎁 You already have an unopened Santa gift waiting for you.' + link,
      ephemeral: true,
    });
  }

  try {
    await interaction.reply(payload(buildWaitingMessage(claimResult.claim)));
    const message = await interaction.fetchReply();
    await db.query(
      "UPDATE santa_gift_claims SET message_id = $2 WHERE claim_id = $1 AND status = 'pending'",
      [claimId, message.id]
    );
  } catch (error) {
    console.error('[SantaGift] Could not publish the gift message:', error);
    await db.query(
      "UPDATE santa_gift_claims SET status = 'expired' WHERE claim_id = $1 AND status = 'pending'",
      [claimId]
    ).catch(() => {});
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content: '❌ Santa could not deliver the gift message. Please try again later.', ephemeral: true }).catch(() => {});
    }
    return interaction.reply({ content: '❌ Santa could not deliver the gift message. Please try again later.', ephemeral: true }).catch(() => {});
  }
}

async function handleButton(interaction) {
  const claimId = interaction.customId.slice(CLAIM_PREFIX.length);
  if (!interaction.inGuild() || !interaction.guildId) {
    return interaction.reply({ content: '❌ This Santa gift can only be opened inside the server.', ephemeral: true });
  }

  const found = await db.query('SELECT * FROM santa_gift_claims WHERE claim_id = $1 LIMIT 1', [claimId]);
  const claim = found.rows[0];
  if (!claim) return interaction.reply({ content: '🎅 This gift is no longer available.', ephemeral: true });
  if (claim.user_id !== interaction.user.id) {
    return interaction.reply({ content: '🎁 This gift belongs to the member who summoned Santa. You can open your own with /santa_gift!', ephemeral: true });
  }
  if (claim.message_id !== interaction.message.id) {
    return interaction.reply({ content: '❌ This gift button is not attached to its original message.', ephemeral: true });
  }
  if (claim.status === 'opening' || claim.status === 'completed') {
    return interaction.reply({ content: '🎁 Your gift has already been opened. The surprise is right above!', ephemeral: true });
  }
  if (claim.status !== 'pending' || new Date(claim.expires_at).getTime() <= Date.now()) {
    await db.query(
      "UPDATE santa_gift_claims SET status = 'expired' WHERE claim_id = $1 AND status = 'pending'",
      [claimId]
    );
    return interaction.reply({ content: '⌛ This unopened gift has expired. Run /santa_gift to summon Santa again.', ephemeral: true });
  }

  const gift = chooseGift();
  const claimed = await db.query(
    "UPDATE santa_gift_claims SET status = 'opening', gift_id = $2, opened_at = NOW() " +
    "WHERE claim_id = $1 AND user_id = $3 AND status = 'pending' AND expires_at > NOW() RETURNING *",
    [claimId, gift.id, interaction.user.id]
  );
  if (!claimed.rowCount) {
    return interaction.reply({ content: '🎁 This gift is already being opened or has expired. Please check the original message.', ephemeral: true });
  }

  try {
    await interaction.update(payload(buildOpeningMessage()));
  } catch (error) {
    console.error('[SantaGift] Could not start the opening animation:', error);
    return interaction.reply({ content: '❌ I could not animate this gift. Your result has been safely saved and will be recovered.', ephemeral: true }).catch(() => {});
  }

  const finalPayload = payload(buildResultMessage(interaction.user.id, gift));
  try {
    await delay(SHAKE_DURATION_MS);
    if (config.santaGiftRevealGifUrl) {
      await interaction.message.edit(payload(buildRevealMessage()));
      await delay(REVEAL_DURATION_MS);
    }
    await interaction.message.edit(finalPayload);
    await db.query(
      "UPDATE santa_gift_claims SET status = 'completed', completed_at = NOW() WHERE claim_id = $1 AND status = 'opening'",
      [claimId]
    );
  } catch (error) {
    console.error('[SantaGift] Reveal transition failed; attempting to publish the saved result:', error);
    try {
      await interaction.message.edit(finalPayload);
      await db.query(
        "UPDATE santa_gift_claims SET status = 'completed', completed_at = NOW() WHERE claim_id = $1 AND status = 'opening'",
        [claimId]
      );
    } catch (recoveryError) {
      console.error('[SantaGift] Result remains saved for startup recovery:', recoveryError);
    }
  }
}

async function recover(client) {
  const result = await db.query(
    "SELECT claim_id, user_id, channel_id, message_id, gift_id FROM santa_gift_claims " +
    "WHERE status = 'opening' AND message_id IS NOT NULL ORDER BY opened_at ASC LIMIT 100"
  );
  let recovered = 0;
  for (const claim of result.rows) {
    const gift = GIFTS.find(item => item.id === claim.gift_id);
    if (!gift) {
      console.error('[SantaGift] Unknown saved gift for claim ' + claim.claim_id + '.');
      continue;
    }
    try {
      const channel = await client.channels.fetch(claim.channel_id).catch(() => null);
      const message = channel?.isTextBased() ? await channel.messages.fetch(claim.message_id).catch(() => null) : null;
      if (message) await message.edit(payload(buildResultMessage(claim.user_id, gift)));
      await db.query(
        "UPDATE santa_gift_claims SET status = 'completed', completed_at = NOW() WHERE claim_id = $1 AND status = 'opening'",
        [claim.claim_id]
      );
      recovered += 1;
    } catch (error) {
      console.error('[SantaGift] Could not recover claim ' + claim.claim_id + ':', error);
    }
  }
  if (recovered) console.log('[SantaGift] Recovered ' + recovered + ' interrupted gift reveal(s).');
}

module.exports = { command, migrate, handleCommand, handleButton, recover, GIFTS };
