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
