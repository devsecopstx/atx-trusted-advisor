---
name: weekly-gtm-newsletter
description: Weekly aTxFinance GTM newsletter posted to Slack #xfinance-tasks (C0B584AH6ER). Use for weekly newsletter, Slack digest, or /weekly-gtm-newsletter. Never email contacts.
skill_family: gtm
last_updated: 2026-08-17
---

# weekly-gtm-newsletter

Internal weekly brief for [trusted-advisory Slack `#xfinance-tasks`](https://trustedadvisory.slack.com/archives/C0B584AH6ER) (`C0B584AH6ER`).

## Rules

- **Post to Slack only.** Never SMTP, never `.env.prod` mail, never the user’s contacts.
- External email drafts may appear as “for approval” copy. Do not send them.
- No fake testimonials, AUM, or live-trading claims.
- From-address if a draft email is shown: `support@atxtrustedadvisory.com`.
- Tone: calm, intro-first. Not a hard ask in line one.

## Cadence

Monday (or when asked). One message in `C0B584AH6ER`.

## Issue shape

```markdown
# aTxFinance weekly — <date>

## Shipped
- X / product / ops (links)

## Pipeline
- Scoreboard one-liner. No new outbound email unless Sam approved a named draft.

## For approval (do not send)
- At most one warmer intro email draft, or “none this week.”

## Next
- One founder action (screenshot, reply, calendar). Not “email the list.”

Trial: https://fintech-advisor.ai
Not financial advice.
```

## How to post

Use Slack `slack_send_message` to `channel_id=C0B584AH6ER`.
