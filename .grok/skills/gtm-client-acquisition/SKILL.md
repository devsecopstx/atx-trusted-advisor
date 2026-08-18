---
name: gtm-client-acquisition
description: Founder GTM for aTxFinance with zero or few clients. Use for lead research, IA outreach drafts, X/LinkedIn copy, daily /loop marketing briefs, client acquisition, or /gtm-client-acquisition.
skill_family: gtm
last_updated: 2026-08-15
---

# gtm-client-acquisition (Grok)

Same playbook as [`.cursor/skills/gtm-client-acquisition/SKILL.md`](../../../.cursor/skills/gtm-client-acquisition/SKILL.md). Prefer that file as the long source of truth.

## When this is the job

User has **no clients** (or almost none) and wants marketing agents, leads, outreach, or a daily GTM loop.

## How to run in the background

Skills are not daemons. To keep GTM alive in **this** Grok session:

```
/loop 1d Use gtm-client-acquisition. Read atx-docs/branding/marketing/gtm-pipeline.md. Search X + web for IA / options-income desk pain. Append a dated draft-only brief (2 X posts, 3 leads, 1 outreach, 1 founder send). Never publish or DM.
```

Recurring `/loop` tasks expire after 7 days — recreate. Durable scheduler is fine; still **draft-only**.

## Hard rules

- Book **intro calls**, do not optimize vanity metrics.
- **Investment Advisor / IA** in new copy — not RIA.
- Never invent testimonials, AUM, user counts, or live trading.
- Never send email, Slack DMs to prospects, or schedule `/admin/marketing` posts unless the user says send/publish.
- **Never email the user’s contacts.** Do not use SMTP, `.env.prod`, or GCP secrets to mail anyone. Draft only.
- Trial CTA: [https://fintech-advisor.ai](https://fintech-advisor.ai)

## Tools

- `x_keyword_search` / `x_semantic_search` / `x_user_search` for FinTwit + IA voices
- `web_search` for boutique IA firms and conference lists
- Edit `atx-docs/branding/marketing/gtm-pipeline.md` only (append)

## Output

Follow the Cursor skill **Output format**. Keep the chat reply short enough to act on in 10 minutes.
