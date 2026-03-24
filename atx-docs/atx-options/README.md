# atx-options — strategy reference

**aTx Finance · options education & agent context**

Short-form strategy narratives (Markdown + frontmatter) plus links to **executable** Cursor skills under `.cursor/skills/atx-skill-*`. Use the **narrative** files for human-readable semantics; use the **SKILL** files when dispatching agents or validating playbook depth.

---

## Table of contents

- [How this tree is organized](#how-this-tree-is-organized)
- [Strategy map (narrative ↔ Cursor skill)](#strategy-map-narrative--cursor-skill)
- [Related indexes](#related-indexes)

---

## How this tree is organized

| Layer | Location | Role |
|-------|----------|------|
| **Narrative** | [`atx-strategy-templates/atx-<slug>/atx-<slug>.md`](./atx-strategy-templates/atx-wheel/atx-wheel.md) (example) | One-pagers: usage tier, risk, guardrails. Frontmatter `id` / `name`: `xfinance-strategy-*`. |
| **Agent skills** | [`.cursor/skills/atx-skill-*/SKILL.md`](../../.cursor/skills/atx-skill-wheel-strategy/SKILL.md) (example) | Full playbooks for Cursor — strikes, rolls, assignment, checks. |
| **Skill id index** | [`atx-strategy-templates/atx-readme-coreskills.md`](./atx-strategy-templates/atx-readme-coreskills.md) | Compact table: automation id ↔ path. |

Paths are from **repo root** in prose elsewhere (`atx-docs/atx-options/...`).

---

## Strategy map (narrative ↔ Cursor skill)

| Strategy | Narrative doc | Cursor skill (detail) | `xfinance-strategy-*` id |
|----------|---------------|-------------------------|---------------------------|
| **Covered calls** | [atx-covered-calls.md](./atx-strategy-templates/atx-covered-calls/atx-covered-calls.md) | [`atx-skill-covered-calls`](../../.cursor/skills/atx-skill-covered-calls/SKILL.md) | `xfinance-strategy-covered-calls` |
| **Cash-secured puts** | [atx-cash-secured-puts.md](./atx-strategy-templates/atx-cash-secured-puts/atx-cash-secured-puts.md) | [`atx-skill-cash-secured-puts`](../../.cursor/skills/atx-skill-cash-secured-puts/SKILL.md) | `xfinance-strategy-cash-secured-puts` |
| **Wheel** | [atx-wheel.md](./atx-strategy-templates/atx-wheel/atx-wheel.md) | [`atx-skill-wheel-strategy`](../../.cursor/skills/atx-skill-wheel-strategy/SKILL.md) | `xfinance-strategy-wheel` |
| **Bull put credit spread** | [atx-bull-put-credit-spread.md](./atx-strategy-templates/atx-bull-put-credit-spread/atx-bull-put-credit-spread.md) | [`atx-skill-bull-put-credit-spread`](../../.cursor/skills/atx-skill-bull-put-credit-spread/SKILL.md) | `xfinance-strategy-bull-put-credit-spread` |
| **Poor man’s covered call** | [SKILL.md](./atx-strategy-templates/atx-poor-mans-covered-call/SKILL.md) (legacy copy in-tree) | [`atx-skill-poor-mans-covered-call`](../../.cursor/skills/atx-skill-poor-mans-covered-call/SKILL.md) | `xfinance-strategy-poor-mans-covered-call` |
| **Diagonal spread** | [atx-diagonal-spread.md](./atx-strategy-templates/atx-diagonal-spread/atx-diagonal-spread.md) | [`atx-skill-diagonal-spread`](../../.cursor/skills/atx-skill-diagonal-spread/SKILL.md) | `xfinance-strategy-diagonal-spread` |
| **Bull call debit spread** | [atx-bull-call-debit-spread.md](./atx-strategy-templates/atx-bull-call-debit-spread/atx-bull-call-debit-spread.md) | [`atx-skill-bull-call-debit-spread`](../../.cursor/skills/atx-skill-bull-call-debit-spread/SKILL.md) | `xfinance-strategy-bull-call-debit-spread` |
| **Iron condor** | [atx-iron-condor.md](./atx-strategy-templates/atx-iron-condor/atx-iron-condor.md) | [`atx-skill-iron-condor`](../../.cursor/skills/atx-skill-iron-condor/SKILL.md) | `xfinance-strategy-iron-condor` |
| **Calendar spread** | [atx-calendar-spread.md](./atx-strategy-templates/atx-calendar-spread/atx-calendar-spread.md) | [`atx-skill-calendar-spread`](../../.cursor/skills/atx-skill-calendar-spread/SKILL.md) | `xfinance-strategy-calendar-spread` |
| **LEAP + CC overlay** | [atx-leap-call-cc-overlay.md](./atx-strategy-templates/atx-leap-call-cc-overlay/atx-leap-call-cc-overlay.md) | [`atx-skill-leap-call-cc-overlay`](../../.cursor/skills/atx-skill-leap-call-cc-overlay/SKILL.md) | `xfinance-strategy-leap-call-cc-overlay` |

Shared principles (not a single strategy): [`atx-skill-options-principles`](../../.cursor/skills/atx-skill-options-principles/SKILL.md).

---

## Related indexes

- [atx-readme-coreskills.md](./atx-strategy-templates/atx-readme-coreskills.md) — skill id ↔ path (quick lookup).
- [Documentation index (atx-docs)](../README.md) — ops, xChat, options, backlog.
- [Cursor skills index](../../.cursor/skills/README.md) — all `atx-skill-*` folders.

---

*Not financial advice; educational / product context only.*
