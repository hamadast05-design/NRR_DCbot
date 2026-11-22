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



## Feature access and SuperUser

- Use `hasPermission(userId, memberPermissions, permission)` from `src/access.js` for permission-gated features.
- Use `hasFeatureAccess(userId, { memberPermissions, permission, member, roleIds })` when access can be granted by a permission or an allowed-role list.
- The configured SuperUser ID bypasses member-level feature eligibility checks, including permission and role allowlists. New restricted features should use these shared helpers instead of writing their own authorization checks.
- SuperUser access does not bypass the bot's own Discord permissions, role hierarchy, server configuration, or Discord platform restrictions.


## NRR Booster Customization Perks

- `/booster-perks` — Open the private Components V2 quota panel.
- `/booster-emoji` — Create up to two emojis per active boost session from an image attachment or pasted custom Discord emoji.
- `/booster-sticker` — Create one sticker per active boost session from a supported attachment.
- Reply shortcuts: reply to a message and send `!booster-emoji name` or `!booster-sticker name` to import its single custom emoji or sticker.
- Message context actions: **Create NRR Emoji from Message** and **Create NRR Sticker from Message** import an asset from a selected message (Apps menu), with selection support when a message contains multiple assets.

Set `DISCORD_GUILD_ID` to the NRR server ID. The bot needs **Manage Expressions** permission in NRR, and the application must have the Guild Members intent enabled. The system records boost sessions and created asset IDs in PostgreSQL, resets booster quotas only on a new boost session, and removes tracked booster-created assets when the member stops boosting or leaves NRR. SuperUser can use the same 2-emoji / 1-sticker allocation without an active boost; SuperUser-created assets are tracked separately and are not removed by booster-loss cleanup. Failed cleanup attempts are retried.

Sticker uploads support Discord's PNG, APNG, GIF, and Lottie JSON formats within Discord's size, dimension, and animation limits. Lottie uploads may additionally require the guild to meet Discord's eligibility requirements.

## Santa's Gift Delivery

- `/santa_gift` — Post a public seasonal gift reveal with Discord spoiler formatting. The gift is selected immediately and hidden until someone clicks the spoiler.
- Each use is unlimited; there is no cooldown, animation, image dependency, or button interaction.
- Gifts are cosmetic only; the feature does not modify coins, roles, inventory, or reputation.
- The 12 possible outcomes retain their original weighted odds: 5% golden, 70% ordinary, and 25% naughty-list surprises.


## Crust Staff Points API

The bot includes a durable HMAC-SHA256 client for Crust's existing Staff Points system.

### Configuration

Set these variables in the NRR Bot Railway service:

- `CRUST_INTEGRATION_URL=https://crust.wispbyte.app`
- `STAFF_POINTS_API_SECRET` — the rotated secret issued by Crust. Store it only as a Railway environment variable; never commit it or paste it into source code.

The bot requires HTTPS and refuses to send requests if the base URL is not HTTPS or the secret is missing. The database migration creates a persistent reward ledger at startup.

### Awarding points from an approved quest

The quest review handler should call the client only after an approval has been successfully claimed:

```js
const crust = require('./crust');

const result = await crust.awardStaffPoints({
  discordUserId: submission.staff_discord_id,
  amount: quest.staff_points_reward,
  reason: 'Daily Staff Quest: ' + quest.title,
  referenceId: 'nrr_quest_submission_' + submission.id,
});
```

Use one stable, unique `referenceId` per approved quest submission. Never create a new reference when retrying the same award. The module persists the exact JSON body and reuses it on retries while generating a fresh millisecond timestamp and HMAC signature for each request.

### Reliability and status

- HTTP 201 and HTTP 200 with `duplicate: true` are recorded as awarded.
- HTTP 409 is recorded as a reference conflict and is not retried.
- Network errors, HTTP 408/425/429, and HTTP 5xx responses are retried with exponential backoff (up to 12 attempts).
- Other HTTP 4xx responses are recorded as failed for investigation rather than retried indefinitely.
- Interrupted `processing` records are recovered to the retry queue on the next startup.
- Reward records and their response/error metadata are retained in PostgreSQL. Use `crust.getAwardStatus(referenceId)` to inspect a reward from the future quest review/admin workflow.

The current repository does not yet contain the Daily Community Staff Quests feature or its approval handler. This API client is the reusable integration layer; call it from that handler when the quest workflow is added. It is deliberately not connected to the unrelated Event Submission feature, to avoid awarding Staff Points for contest submissions.

Do not test against a real staff member without authorization: a successful request changes their live Crust balance. Use a Crust-provided test recipient or obtain approval for a controlled low-value test first.
