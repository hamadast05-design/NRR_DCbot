# NRR Discord Bot

NRR Discord bot with the persistent Fame & Reputation system.

## Commands

- `/fame @member` — Give +1 Fame.
- `/humiliate @member` — Give +1 Humiliation.
- `/reputation [@member]` — View reputation statistics and ranks.
- `/leaderboard fame` — Fame leaderboard.
- `/leaderboard humiliation` — Humiliation leaderboard.
- `/leaderboard reputation` — Net Reputation leaderboard.
- `/reputation-admin reset @member` — Staff reset.
- `/reputation-admin add-fame @member amount`
- `/reputation-admin remove-fame @member amount`
- `/reputation-admin add-humiliation @member amount`
- `/reputation-admin remove-humiliation @member amount`

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the Discord and PostgreSQL values.
4. Run `npm run deploy:commands` to register slash commands.
5. Run `npm start`.

`DISCORD_GUILD_ID` registers commands to one server immediately. Leave it empty to register globally.

## Database

The bot uses PostgreSQL. Tables and indexes are created automatically on startup without deleting existing data. Vote history is persistent, so cooldowns survive restarts and deployments.

## Reputation rules

- Fame and Humiliation are independent persistent statistics.
- Reputation Score = Fame - Humiliation.
- Self-voting is blocked.
- Bot targets are blocked by default.
- A voter can act on the same target once per configured cooldown, regardless of vote type. Switching between Fame and Humiliation therefore cannot be used to bypass the cooldown.
- Departed members remain stored but are hidden from leaderboards by default.
- Public reputation logs are disabled by default and can be enabled with configuration.


## NRR Booster Customization Perks

- `/booster-perks` — Open the private Components V2 quota panel.
- `/booster-emoji` — Create up to two emojis per active boost session from an image attachment or pasted custom Discord emoji.
- `/booster-sticker` — Create one sticker per active boost session from a supported attachment.
- Reply shortcuts: reply to a message and send `!booster-emoji name` or `!booster-sticker name` to import its single custom emoji or sticker.
- Message context actions: **Create NRR Emoji from Message** and **Create NRR Sticker from Message** import an asset from a selected message (Apps menu), with selection support when a message contains multiple assets.

Set `DISCORD_GUILD_ID` to the NRR server ID. The bot needs **Manage Expressions** permission in NRR, and the application must have the Guild Members intent enabled. The system records boost sessions and created asset IDs in PostgreSQL, resets quotas only on a new boost session, and removes tracked assets when the member stops boosting or leaves NRR. Failed cleanup attempts are retried.

Sticker uploads support Discord's PNG, APNG, GIF, and Lottie JSON formats within Discord's size, dimension, and animation limits. Lottie uploads may additionally require the guild to meet Discord's eligibility requirements.

## Santa's Gift Delivery

- `/santa_gift` — Open a public, owner-locked seasonal mystery gift. Each member can open one gift every 24 hours.
- Gifts are cosmetic only; the feature does not modify coins, roles, inventory, or reputation.
- Unopened gift claims expire after 15 minutes. Opened outcomes are stored in PostgreSQL and survive restarts.
- Optional HTTPS artwork/GIF settings: `SANTA_GIFT_SACK_IMAGE_URL`, `SANTA_GIFT_SHAKE_GIF_URL`, `SANTA_GIFT_REVEAL_GIF_URL`, `SANTA_GIFT_GOLDEN_IMAGE_URL`, `SANTA_GIFT_ORDINARY_IMAGE_URL`, and `SANTA_GIFT_NAUGHTY_IMAGE_URL`.
- Timing can be adjusted with `SANTA_GIFT_COOLDOWN_HOURS` and `SANTA_GIFT_PENDING_MINUTES`.
