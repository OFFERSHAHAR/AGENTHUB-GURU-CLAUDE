---
name: Telegram test-env guard
description: Why every Telegram sender must short-circuit under NODE_ENV=test
---

All Telegram senders must early-return when `process.env.NODE_ENV === "test"`.

**Why:** `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are shared secrets across every
work environment (including parallel task agents). Any test that fires a real
webhook or exercises a Telegram route otherwise spams the live ops chat — this
was the root cause of the "Webhook Triggered" flood.

**How to apply:** The guard lives in each sender, not one place, because the
codebase has THREE independent senders that do NOT share a helper:
`lib/telegram-notify.ts` (sendTelegramMessage → notifyWebhookFired /
notifyModelFallback), `routes/telegram.ts` (bot replies + web-app button), and
`routes/maintenance.ts` (daily health alerts). Add the guard to any new sender
too. The api-server `test` script sets `NODE_ENV=test`; keep it that way.

Separately, ops can mute live webhook notifications via the persisted global
setting `webhook_telegram_notifications_enabled` (default ON), checked in the
triggers.ts fire path before notifyWebhookFired (fire-and-forget).
