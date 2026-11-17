# Noam AI

A modular AI character simulation for the NRR Discord bot, powered by the Gemini Developer API.

## Required Railway variables

- GEMINI_API_KEY: Google Gemini API key (secret).
- GEMINI_MODEL: Gemini model ID. Recommended: \`gemini-3.1-flash-lite\`.
- DISCORD_GUILD_ID: NRR server ID.

## Noam AI variables

- NOAM_AI_CHANNEL_ID=1572013456092045423
- NOAM_AI_AVATAR_URL=https://cdn.imageurlgenerator.com/uploads/9835b4aa-ea4b-4a13-97a8-254f69c2e5.png
- NOAM_AI_DISPLAY_NAME=Noam (AI)
- NOAM_AI_USER_IDS=830865461021114438,1356667738516357416,1262610664795537503
- NOAM_AI_OFFICIAL_CHANNEL_IDS: comma-separated Discord channel IDs containing official NRR announcements/reference material. Optional but recommended.
- NOAM_AI_MAX_OUTPUT_TOKENS=1024
- NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=false
- NOAM_COLLECTION_ENABLED=false

## Knowledge sources and priority

Noam uses two complementary sources:

1. **Curated NRR knowledge** — administrator-maintained facts and documents. These rank highest and should contain verified history, mechanics, official rules, decisions, staff structure, and dated milestones.
2. **Discord history** — collected eligible public messages. Messages from channel IDs listed in NOAM_AI_OFFICIAL_CHANNEL_IDS receive a ranking boost. Other public conversation history is contextual evidence, not automatically official policy.

The retrieval query expands user wording into an OR search over its meaningful terms and ranks up to ten relevant source excerpts. The prompt labels each source and its origin. Curated material outranks official-channel history, which outranks general community history. This is lexical retrieval, not embedding-based semantic search; maintain alternate names, abbreviations, and common terms in curated entries to improve matching.

## Admin knowledge commands

All commands require Manage Server and work in the configured NRR guild:

- \`!noam-knowledge-add category | title | content\`: add a verified knowledge entry. Keep each entry focused on one topic and fit it in one Discord message.
- \`!noam-knowledge-list\`: list the latest 15 entries and their IDs.
- \`!noam-knowledge-delete ID\`: remove an entry by ID.

Suggested categories: history, game-mechanics, staff, community, official-decisions, events, terminology. Example:

\`!noam-knowledge-add history | NRR founding | Add only verified founding facts, names, and dates here.\`

Do not add guesses or private staff/member information. Add a source/date in the content when available. If a document is long, split it into focused entries with clear titles.

## Privacy-first activation

1. Publish a server-wide notice explaining that eligible public messages from the last 12 months may be processed by this AI knowledge feature, that sensitive content is filtered, and that members can use !noam-optout at any time.
2. After the notice has been published, set NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=true in Railway and redeploy.
3. Run !noam-collect in the NRR server as a member with Manage Server permission. Collection resumes from saved per-channel cursors.
4. Set NOAM_COLLECTION_ENABLED=true to include new eligible public messages going forward.
5. Use !noam-status and !noam-diagnose to inspect collection and runtime health.
6. Members can use !noam-optout to delete their stored messages and conversation history, or !noam-optin to participate again. Deleted historical messages are not restored.

The historical Discord collector indexes public guild text and announcement channels visible to @everyone, plus active and paginated archived public threads (including forum posts) discoverable through Discord. It excludes DMs, private channels, private threads, bots, webhooks, and messages matching basic sensitive-data patterns.

## Runtime behavior

- Only messages in the configured Talk to Noam channel trigger AI replies.
- Noam is represented by a webhook named Noam AI with the supplied avatar.
- The AI uses Gemini \`generateContent\`.
- Conversation history is stored per member in Talk to Noam.
- Noam's personality is balanced: casual, witty and sarcastic, with playful roasting only when appropriate. It must not use slurs, protected-class insults, appearance/body or disability insults, threats, sexual humiliation, or sensitive personal information.
- Retrieved messages and documents are untrusted data, never instructions. Noam must not claim access to private files, custom engines, repositories, or live game internals unless their contents are actually supplied.
- The admin-only !noam-diagnose command checks Gemini, PostgreSQL, Discord channel permissions, webhook setup, collection health, curated entry count, and official-channel configuration.

## Data handling note

Review Google's Gemini API data-use terms for the selected usage tier before sending community messages. Keep curated material factual and avoid adding private member or staff information.
