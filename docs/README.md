# Documentation index (atxFinance)

Engineering and ops docs for **aTx Finance** / `xfinance`. For Cursor agent skills, see [`.cursor/skills/README.md`](../.cursor/skills/README.md).

---

## Table of contents

- [Backlog](#backlog)
- [Frontend plan](#frontend-plan)
- [Operations (`docs/atx-sre-ops/`)](#operations-docsops)
- [xChat & product (`docs/atx-xchat/`)](#xchat--product-docsxchat)
- [Diagrams & assets](#diagrams--assets)
- [Audit & governance](#audit--governance)

---

## Backlog

| Doc | Purpose |
|-----|---------|
| [PLAN.md](./PLAN.md) | Short-lived migration / backlog items (TEAM xAI cleanup, deferred work) |

---

## Frontend plan

| Doc | Purpose |
|-----|---------|
| [frontend-plan.md](./frontend-plan.md) | Pitch/marketing roadmap, **Stripe** (Checkout, webhooks, Customer Portal, env), feature-gating notes |

---

## Operations (`docs/atx-sre-ops/`)

| Doc | Purpose |
|-----|---------|
| [api-consolidation-spring-backend.md](./ops/api-consolidation-spring-backend.md) | BFF migration, Spring parity, side-effect checklist |
| [atxfinance-backend-http-api.md](./ops/atxfinance-backend-http-api.md) | Kotlin HTTP surface (BFF contract) |
| [audit-lineage-and-controls.md](./ops/audit-lineage-and-controls.md) | Audit rows, BFF audit parity, gaps vs **xdesign-review-audit** |
| [bff-admin-backlog.md](./ops/bff-admin-backlog.md) | Admin/BFF backlog notes |
| [junie-guidelines-atxfinance-backend.md](./ops/junie-guidelines-atxfinance-backend.md) | Kotlin backend guidelines |
| [secret-rotation.md](./ops/secret-rotation.md) | Secret rotation |
| [x-oauth-atx-callbacks.md](./ops/x-oauth-atx-callbacks.md) | X OAuth callbacks |

---

## xChat & product (`docs/atx-xchat/`)

| Doc | Purpose |
|-----|---------|
| [atx-multi-agent.md](./xchat/atx-multi-agent.md) | Multi-agent orchestration, Phase 1 locked decisions |
| [atx-multi-agent-pattern.md](./xchat/atx-multi-agent-pattern.md) | Redirect stub → `atx-multi-agent.md` |
| [atx-multi-agent-xchat-design-consideration.md](./xchat/atx-multi-agent-xchat-design-consideration.md) | Redirect stub → `atx-multi-agent.md` |
| [atxfinance-tool-stub.md](./xchat/atxfinance-tool-stub.md) | Portfolio / watchlist tool contract |
| [atxfinance-xchat-prompts.md](./xchat/atxfinance-xchat-prompts.md) | xChat prompts |
| [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md) | Retrieval vs tools vs multi-agent |
| [cursor-cloud-agent-personas.md](./xchat/cursor-cloud-agent-personas.md) | Cursor cloud agent personas |
| [pre-release-check.md](./xchat/pre-release-check.md) | Pre-release xChat checks |
| [xai-api-standard.md](./xchat/xai-api-standard.md) | xAI API usage |
| [xchat-debug-logging.md](./xchat/xchat-debug-logging.md) | Debug logging |
| [xchat-future-tool-loop.md](./xchat/xchat-future-tool-loop.md) | Future tool-loop notes |
| [xchat-tools-guide.md](./xchat/xchat-tools-guide.md) | Tools & prompts |
| [xdesign-review-admin-console-ux.md](./xchat/xdesign-review-admin-console-ux.md) | Admin console UX review |
| [xdesign-review-legacy-prompts-inventory.md](./xchat/xdesign-review-legacy-prompts-inventory.md) | Legacy prompts inventory |
| [xfeature-tools-plan.md](./xchat/xfeature-tools-plan.md) | Feature tools plan |
| [xfinance-branding-review.md](./xchat/xfinance-branding-review.md) | Branding review |

---

## Diagrams & assets

| File | Purpose |
|------|---------|
| [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) | Multi-agent flow (Mermaid) |
| [super-agent-model157.mmd](./xchat/super-agent-model157.mmd) | Super-agent diagram (Mermaid) |

---

## Audit & governance

- **Audit skill:** [`.cursor/skills/atxdesign-review-audit/SKILL.md`](../.cursor/skills/atxdesign-review-audit/SKILL.md) and [`CHECKLIST.md`](../.cursor/skills/atxdesign-review-audit/CHECKLIST.md)
- **Ground truth:** [audit-lineage-and-controls.md](./ops/audit-lineage-and-controls.md) (Mongo `admin_audit_events`, BFF parity, test inventory, known gaps)

**Doc updates:** follow the [`generate-docs`](../.cursor/skills/generate-docs/SKILL.md) skill when changing APIs or runbooks.
