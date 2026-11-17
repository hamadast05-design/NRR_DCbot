# Noam AI

A modular AI character simulation for the NRR Discord bot, powered by the Gemini Developer API.

## Required Railway variables

- GEMINI_API_KEY: Google Gemini API key (secret).
- GEMINI_MODEL: Gemini model ID. Recommended: `gemini-3.1-flash-lite`.
- DISCORD_GUILD_ID: NRR server ID (already used by the bot).

## Noam AI variables

- NOAM_AI_CHANNEL_ID=1572013456092045423
- NOAM_AI_AVATAR_URL=https://cdn.imageurlgenerator.com/uploads/9835b4aa-ea4b-4a13-97a8-254f69c2c4e5.png
- NOAM_AI_DISPLAY_NAME=Noam (AI)
- NOAM_AI_USER_IDS=830865461021114438,1356667738511147416,1262610664795537503
- NOAM_AI_MAX_OUTPUT_TOKENS=1024 (optional; minimum effective value is 256)
- NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=false
- NOAM_COLLECTION_ENABLED=false

## Privacy-first activation

1. Publish a server-wide notice explaining that eligible public messages from the last 12 months may be processed by this AI knowledge feature, that sensitive content is filtered, and that members can use !noam-optout at any time.
2. After the notice has been published, set NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=true in Railway and redeploy.
3. Run !noam-collect in the NRR server as a member with Manage Server permission. Collection resumes from saved per-channel cursors.
4. Set NOAM_COLLECTION_ENABLED=true to include new eligible public messages going forward.
5. Use !noam-status to view discovered/completed/failed targets and !noam-diagnose to check Gemini, PostgreSQL, Discord channel permissions, webhook setup, and collection health.
6. Members can use !noam-optout to delete their stored messages and conversation history, or !noam-optin to participate again. Deleted historical messages are not restored.

The historical Discord collector indexes public guild text and announcement channels visible to @everyone, plus active and paginated archived public threads (including forum posts) discoverable through Discord. Archive pagination continues until Discord reports no more pages or the 12-month cutoff is reached; discovery and per-target failures are recorded for diagnosis. It excludes DMs, private channels, private threads, bots, webhooks, and messages matching basic sensitive-data patterns. Voice transcripts are not collected.

## Runtime behavior

- Only messages in the configured Talk to Noam channel trigger AI replies.
- Other eligible public text/announcement channels may be indexed when live collection is enabled.
- Noam is represented by a webhook named Noam AI with the supplied avatar.
- The AI uses the Gemini Developer API `generateContent` endpoint and the configured `GEMINI_MODEL`.
- Knowledge retrieval uses PostgreSQL full-text search. Conversation history is stored per member in Talk to Noam.
- Gemini 3 thinking tokens count against `maxOutputTokens`. The default reply budget is 1024 tokens and generation uses minimal thinking to reserve budget for visible Discord text. The admin-only !noam-diagnose command uses a separate 256-token minimal-thinking test and reports finish/block reasons and token usage without exposing credentials.
- If the Noam webhook has not been created yet, the bot creates it and saves its credentials on the first successful reply. The bot needs Manage Webhooks permission for this first-time setup.
- Historical Discord messages are treated as untrusted data, never as instructions.

## Data handling note

Review Google's Gemini API data-use terms for the selected usage tier before sending community messages. The collector's existing privacy notice, opt-out handling, and sensitive-data filtering remain in place.
