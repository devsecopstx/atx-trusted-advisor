---
name: gtm-client-acquisition
description: Founder GTM for aTxFinance when there are few or zero clients. Use for lead research, IA outreach, X/LinkedIn drafts, waitlist/trial conversion, daily marketing loops, or /gtm-client-acquisition.
skill_family: gtm
last_updated: 2026-08-15
---

# gtm-client-acquisition

Get **named conversations** with Investment Advisors (IA) and HNWI operators. Skills and `is_background` agents do **not** hunt clients by themselves — this playbook is the work.

## Goal

Book 5 intro calls in 14 days. Proof of demand is a booked call or an approved trial user — not post volume.

**Product:** [https://fintech-advisor.ai](https://fintech-advisor.ai) · 30-day Basic trial, no card · **Start 30-Day Free Trial**

## ICP (in order)

1. **Primary — boutique IA / RIA-firm desks** (use **Investment Advisor** / **IA** in copy): 1–20 person shops that already run covered calls, CSPs, wheel, or overlays and waste time in Thinkorswim / Excel / chatbots with no book context.
2. **Secondary — HNWI / family-office operators** who want defined-risk income with low daily screen time.
3. **Tertiary — Series 7 / 65 / 66** candidates and FinTwit options operators (awareness, not first revenue).

**Do not chase:** retail “get rich with options,” prop-firm gamblers, or anyone asking for trade signals.

**Buyer job:** “Show me defined-risk income ideas on **my** book without babysitting a terminal.”

**Offer (honest):** early access + founder onboarding + Grok xChat on their portfolio + xOptions desk. Not a live broker. Not a performance track record.

## Week-1 motion (zero clients)

Do this **before** a content calendar:

1. Build a **20-name list** (firm, person, channel, why they fit). Austin / Texas + remote boutiques first.
2. Send **10 personal notes** (email or X/LinkedIn DM). Founder voice. One ask: 20-minute desk walkthrough.
3. Publish **3 proof posts** (real product screenshot or specific workflow — never fake P/L).
4. Invite every yes to the **30-day trial** and stay on the intro call.
5. After each call, log outcome in [`atx-docs/branding/marketing/gtm-pipeline.md`](../../../atx-docs/branding/marketing/gtm-pipeline.md).

Warm > cold. Ask existing network: “Who runs options for clients or their own book?”

## Daily loop (draft-only)

When running as `/loop 1d` or a background marketing agent:

1. Read this skill + the pipeline file + `.cursor/rules/xfinance-branding.mdc`.
2. Search X + web for **today’s** IA / options-income pain (time waste, overlay ops, concentrated-stock income).
3. Append a dated brief to the pipeline file (do not rewrite history).
4. Output **only**:
   - 2 X posts (hook + 3–5 lines + low-pressure CTA)
   - 3 named or highly specific lead notes (who / where / why / first line)
   - 1 outreach draft (email or DM)
   - 1 founder action for **today** (send, not “think”)
5. **Never email anyone** unless the user names the exact recipient and says approve/send for that draft. Cold notes need a short intro (who you are, why this desk) — no ask-in-the-first-line.
6. **Never email the user’s contacts** from SMTP / `.env.prod` / GCP. Slack `#xfinance-tasks` (`C0B584AH6ER`) is the weekly newsletter destination — not email.
7. Never invent testimonials, AUM, user counts, or live-trading claims.

Product scheduler for **approved** posts: Admin → **Marketing** (`/admin/marketing`, category `marketing_post`).

## Copy rules

- Tagline: **No Atoms Moved. Just Gains Earned.**
- Subline: **xAI-Powered Options Intelligence for Serious Portfolios**
- Surfaces: **xChat**, **xOptions**, **xFinance** (portfolios). Lockup **aTx⚡Finance**.
- Say **Investment Advisor** / **IA**, not RIA, in new copy.
- Outcome first (time saved, defined risk, book-aware ideas), then features.
- Always educational / not financial advice when strategy examples appear.
- CTA: trial at fintech-advisor.ai **or** “reply and I’ll walk your book” — not “join the waitlist” if trial is live.

Canonical briefs: [`atx-docs/product/README.md`](../../../atx-docs/product/README.md).

## Outreach skeleton (draft only — wait for named approval)

```
Subject: intro — aTxFinance (Austin) / options desk on the book

{first_name} —

I’m Sam Perez, founder of aTxFinance in Austin. We built a workspace
where Grok (xChat) sees the actual book and xOptions is the defined-risk
desk (covered calls, CSPs, wheel) — not a generic chatbot.

Sharing in case it’s useful for your overlay work. 30-day trial, no card:
https://fintech-advisor.ai

Happy to intro properly if you want a look.

Samuel Perez
support@atxtrustedadvisory.com
```

## Channels

| Channel | Use |
|---|---|
| Warm intro / email | Highest conversion. Default. |
| X (FinTwit) | Proof posts + replies under IA / options operators. Handle in beta template: `@AtxBogart`. |
| LinkedIn | IA / Series 65–66. Same tone, longer. |
| `/admin/marketing` | Only after human approval of copy. |
| Slack `#xfinance-tasks` (`C0B584AH6ER`) | Weekly newsletter (internal). Never a substitute for emailing contacts. |

## Guardrails

- Draft-only unless explicitly told to send/publish.
- **Do not email contacts** — not even if SMTP / `.env.prod` / GCP secrets are available.
- No spray-and-pray, purchased lists, or engagement pods.
- No guaranteed yield, “daily gains,” or fake case studies.
- No unsolicited mass DMs.
- Strategy numbers must be labeled illustrative unless pulled from a real (user-owned) book.

## Output format

```markdown
## Today
- Founder action: <one send / one post / one follow-up>

## Leads (3)
| Who | Firm / context | Channel | First line |

## Drafts
### X 1
### X 2
### Outreach
```

Checklist: [`CHECKLIST.md`](CHECKLIST.md).
