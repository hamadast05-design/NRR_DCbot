# Noam AI

A modular AI character simulation for the NRR Discord bot.

## Required Railway variables

- OPENAI_API_KEY: OpenAI API key (secret).
- OPENAI_MODEL: model ID enabled for the API project. Recommended initial value: gpt-6.1-sol.
- DISCORD_GUILD_ID: NRR server ID (already used by the bot).

## Noam AI variables

- NOAM_AI_CHANNEL_ID=1572013456092045423
- NOAM_AI_AVATAR_URL=https://cdn.imageurlgenerator.com/uploads/9835b4aa-ea4b-4a13-97a8-254f69c2c4e5.png
- NOAM_AI_DISPLAY_NAME=Noam (AI)
- NOAM_AI_USER_IDS=830865461021114438,1356667738516357416,1262610664795537503
- NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=false
- NOAM_COLLECTION_ENABLED=false

## Privacy-first activation

1. Publish a server-wide notice explaining that eligible public messages from the last 12 months may be processed by this AI knowledge feature, that sensitive content is filtered, and that members can use !noam-optout at any time.
2. After the notice has been published, set NOAM_COLLECTION_NOTICE_ACKNOWLEDGED=true in Railway and redeploy.
3. Run !noam-collect in the NRR server as a member with Manage Server permission. Collection resumes from saved per-channel cursors.
4. Set NOAM_COLLECTION_ENABLED=true to include new eligible public messages going forward.
5. Use !noam-status to view discovered/completed/failed targets and !noam-diagnose to check OpenAI, PostgreSQL, Discord channel permissions, webhook setup, and collection health.
6. Members can use !noam-optout to delete their stored messages and conversation history, or !noam-optin to participate again. Deleted historical messages are not restored.

The historical collector indexes public guild text and announcement channels visible to @everyone, plus active and paginated archived public threads (including forum posts) discoverable through Discord. Archive pagination continues until Discord reports no more pages or the 12-month cutoff is reached; discovery and per-target failures are recorded for diagnosis. It excludes DMs, private channels, private threads, bots, webhooks, and messages matching basic sensitive-data patterns. Voice transcripts are not collected.

## Runtime behavior

- Only messages in the configured Talk to Noam channel trigger AI replies.
- Other eligible public text/announcement channels may be indexed when live collection is enabled.
- Noam is represented by a webhook named Noam AI with the supplied avatar.
- The bot uses the OpenAI Responses API and configured OPENAI_MODEL; it does not assume a model ID.
- Knowledge retrieval uses PostgreSQL full-text search. Conversation history is stored per member in Talk to Noam.
- API calls use store:false, a 30-second timeout, and capped generated output. The admin-only !noam-diagnose command makes a small API health request and reports common billing, key, model, network, database, and Discord permission problems without exposing credentials.
- Historical Discord messages are treated as untrusted data, never as instructions.
