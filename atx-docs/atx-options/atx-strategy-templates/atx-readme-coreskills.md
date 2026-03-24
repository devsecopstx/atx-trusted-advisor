# Strategy skills (quick lookup)

Cursor **automation ids** use the `xfinance-strategy-*` prefix. **Narrative** files live here under `atx-<slug>/`; **full playbooks** live under [`.cursor/skills/atx-skill-*`](../../../.cursor/skills/).

**Directory readme** (TOC + full strategy ↔ skill table): [**`../README.md`](../README.md)**.

**Columns:** **Risk** matches each file’s **Risk Profile** section. **Outlook** is the implied market / regime bias for the structure (not a prediction).

| Skill id | Narrative doc | Risk | Outlook | Detail skill |
|----------|---------------|------|---------|--------------|
| `xfinance-strategy-covered-calls` | [atx-covered-calls/atx-covered-calls.md](./atx-covered-calls/atx-covered-calls.md) | Moderate (capped upside) | Neutral–bullish (income on long shares) | [atx-skill-covered-calls](../../../.cursor/skills/atx-skill-covered-calls/SKILL.md) |
| `xfinance-strategy-cash-secured-puts` | [atx-cash-secured-puts/atx-cash-secured-puts.md](./atx-cash-secured-puts/atx-cash-secured-puts.md) | Moderate (assignment obligation) | Bullish / willing to own at lower effective cost | [atx-skill-cash-secured-puts](../../../.cursor/skills/atx-skill-cash-secured-puts/SKILL.md) |
| `xfinance-strategy-wheel` | [atx-wheel/atx-wheel.md](./atx-wheel/atx-wheel.md) | Moderate–aggressive (volatility, assignment) | Bullish accumulation cycle (CSP → CC) | [atx-skill-wheel-strategy](../../../.cursor/skills/atx-skill-wheel-strategy/SKILL.md) |
| `xfinance-strategy-bull-put-credit-spread` | [atx-bull-put-credit-spread/atx-bull-put-credit-spread.md](./atx-bull-put-credit-spread/atx-bull-put-credit-spread.md) | Moderate (limited max loss) | Bullish / mildly bullish (premium on dips) | [atx-skill-bull-put-credit-spread](../../../.cursor/skills/atx-skill-bull-put-credit-spread/SKILL.md) |
| `xfinance-strategy-poor-mans-covered-call` | [atx-poor-mans-covered-call/SKILL.md](./atx-poor-mans-covered-call/SKILL.md) | Moderate–aggressive (LEAP leverage) | Bullish (long LEAP + short-call income) | [atx-skill-poor-mans-covered-call](../../../.cursor/skills/atx-skill-poor-mans-covered-call/SKILL.md) |
| `xfinance-strategy-diagonal-spread` | [atx-diagonal-spread/atx-diagonal-spread.md](./atx-diagonal-spread/atx-diagonal-spread.md) | Moderate–aggressive (time / vol flexibility) | Bullish with near-term theta overlay | [atx-skill-diagonal-spread](../../../.cursor/skills/atx-skill-diagonal-spread/SKILL.md) |
| `xfinance-strategy-bull-call-debit-spread` | [atx-bull-call-debit-spread/atx-bull-call-debit-spread.md](./atx-bull-call-debit-spread/atx-bull-call-debit-spread.md) | Moderate (capped risk / reward) | Bullish (defined-risk leverage) | [atx-skill-bull-call-debit-spread](../../../.cursor/skills/atx-skill-bull-call-debit-spread/SKILL.md) |
| `xfinance-strategy-iron-condor` | [atx-iron-condor/atx-iron-condor.md](./atx-iron-condor/atx-iron-condor.md) | Moderate (defined risk if range holds) | Neutral / range-bound premium | [atx-skill-iron-condor](../../../.cursor/skills/atx-skill-iron-condor/SKILL.md) |
| `atxfinance-strategy-calendar-spread` | [atx-calendar-spread/atx-calendar-spread.md](./atx-calendar-spread/atx-calendar-spread.md) | Moderate (volatility differential) | Neutral–directional (term structure / theta vs. long leg) | [atx-skill-calendar-spread](../../../.cursor/skills/atx-skill-calendar-spread/SKILL.md) |
| `xfinance-strategy-leap-call-cc-overlay` | [atx-leap-call-cc-overlay/atx-leap-call-cc-overlay.md](./atx-leap-call-cc-overlay/atx-leap-call-cc-overlay.md) | Aggressive (leverage, decay) | Bullish aggressive (LEAP + overlay income) | [atx-skill-leap-call-cc-overlay](../../../.cursor/skills/atx-skill-leap-call-cc-overlay/SKILL.md) |

**Also:** [atx-skill-options-principles](../../../.cursor/skills/atx-skill-options-principles/SKILL.md) · [atx-docs index](../../README.md).
