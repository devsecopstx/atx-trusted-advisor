# atx-options — strategy reference

**aTx Finance · options education & agent context**

Short-form strategy narratives (Markdown + frontmatter) plus links to **executable** Cursor skills under `.cursor/skills/atx-skill-*`. Use the **narrative** files for human-readable semantics; use the **SKILL** files when dispatching agents or validating playbook depth.

**Columns in the strategy map:** **Risk** aligns with each narrative’s **Risk Profile** (summary). **Outlook** is the implied market / regime bias for the structure (not a prediction).

---

## Table of contents

- [How this tree is organized](#how-this-tree-is-organized)
- [Strategy map (narrative ↔ risk ↔ outlook ↔ skill)](#strategy-map-narrative--risk--outlook--skill)
- [Related indexes](#related-indexes)

---

## How this tree is organized

| Layer | Location | Role |
|-------|----------|------|
| **Narrative** | [`atx-<slug>/atx-<slug>.md`](./atx-wheel/atx-wheel.md) (example) | One-pagers: usage tier, risk, guardrails. Frontmatter `id` / `name`: `xfinance-strategy-*`. |
| **Agent skills** | [`.cursor/skills/atx-skill-*/SKILL.md`](../../.cursor/skills/atx-skill-wheel-strategy/SKILL.md) (example) | Full playbooks for Cursor — strikes, rolls, assignment, checks. |
| **This index** | [`atx-options-coreskills.md`](./atx-options-coreskills.md) | Strategy ↔ narrative ↔ **risk** ↔ **outlook** ↔ automation id ↔ Cursor skill. |

**Ingest:** `npm run seed:admin` uploads this tree to xAI strategy collections via **`scripts/lib/seed-xai-rag-ingest.mjs`**. **Doc stub:** [`atx-docs/atx-options/README.md`](../../atx-docs/atx-options/README.md) (redirect for old paths).

---

## Strategy map (narrative ↔ risk ↔ outlook ↔ skill)

| Strategy | Narrative doc | Risk | Outlook | `xfinance-strategy-*` id | Cursor skill (detail) |
|----------|----------------|------|---------|---------------------------|------------------------|
| **Covered calls** | [atx-covered-calls.md](./atx-covered-calls/atx-covered-calls.md) | Moderate (capped upside) | Neutral–bullish (income on long shares) | `xfinance-strategy-covered-calls` | [`atx-skill-covered-calls`](../../.cursor/skills/atx-skill-covered-calls/SKILL.md) |
| **Cash-secured puts** | [atx-cash-secured-puts.md](./atx-cash-secured-puts/atx-cash-secured-puts.md) | Moderate (assignment obligation) | Bullish / willing to own at lower effective cost | `xfinance-strategy-cash-secured-puts` | [`atx-skill-cash-secured-puts`](../../.cursor/skills/atx-skill-cash-secured-puts/SKILL.md) |
| **Wheel** | [atx-wheel.md](./atx-wheel/atx-wheel.md) | Moderate–aggressive (volatility, assignment) | Bullish accumulation cycle (CSP → CC) | `xfinance-strategy-wheel` | [`atx-skill-wheel-strategy`](../../.cursor/skills/atx-skill-wheel-strategy/SKILL.md) |
| **Bull put credit spread** | [atx-bull-put-credit-spread.md](./atx-bull-put-credit-spread/atx-bull-put-credit-spread.md) | Moderate (limited max loss) | Bullish / mildly bullish (premium on dips) | `xfinance-strategy-bull-put-credit-spread` | [`atx-skill-bull-put-credit-spread`](../../.cursor/skills/atx-skill-bull-put-credit-spread/SKILL.md) |
| **Poor man’s covered call** | [SKILL.md](./atx-poor-mans-covered-call/SKILL.md) (legacy copy in-tree) | Moderate–aggressive (LEAP leverage) | Bullish (long LEAP + short-call income) | `xfinance-strategy-poor-mans-covered-call` | [`atx-skill-poor-mans-covered-call`](../../.cursor/skills/atx-skill-poor-mans-covered-call/SKILL.md) |
| **Diagonal spread** | [atx-diagonal-spread.md](./atx-diagonal-spread/atx-diagonal-spread.md) | Moderate–aggressive (time / vol flexibility) | Bullish with near-term theta overlay | `xfinance-strategy-diagonal-spread` | [`atx-skill-diagonal-spread`](../../.cursor/skills/atx-skill-diagonal-spread/SKILL.md) |
| **Bull call debit spread** | [atx-bull-call-debit-spread.md](./atx-bull-call-debit-spread/atx-bull-call-debit-spread.md) | Moderate (capped risk / reward) | Bullish (defined-risk leverage) | `xfinance-strategy-bull-call-debit-spread` | [`atx-skill-bull-call-debit-spread`](../../.cursor/skills/atx-skill-bull-call-debit-spread/SKILL.md) |
| **Iron condor** | [atx-iron-condor.md](./atx-iron-condor/atx-iron-condor.md) | Moderate (defined risk if range holds) | Neutral / range-bound premium | `xfinance-strategy-iron-condor` | [`atx-skill-iron-condor`](../../.cursor/skills/atx-skill-iron-condor/SKILL.md) |
| **Calendar spread** | [atx-calendar-spread.md](./atx-calendar-spread/atx-calendar-spread.md) | Moderate (volatility differential) | Neutral–directional (term structure / theta vs. long leg) | `xfinance-strategy-calendar-spread` | [`atx-skill-calendar-spread`](../../.cursor/skills/atx-skill-calendar-spread/SKILL.md) |
| **LEAP + CC overlay** | [atx-leap-call-cc-overlay.md](./atx-leap-call-cc-overlay/atx-leap-call-cc-overlay.md) | Aggressive (leverage, decay) | Bullish aggressive (LEAP + overlay income) | `xfinance-strategy-leap-call-cc-overlay` | [`atx-skill-leap-call-cc-overlay`](../../.cursor/skills/atx-skill-leap-call-cc-overlay/SKILL.md) |

Shared principles (not a single strategy): [`atx-skill-options-principles`](../../.cursor/skills/atx-skill-options-principles/SKILL.md).

---

## Related indexes

- [Documentation index (atx-docs)](../../atx-docs/README.md) — ops, xChat, options, backlog.
- [Cursor skills index](../../.cursor/skills/README.md) — all `atx-skill-*` folders.

---

*Not financial advice; educational / product context only.*
