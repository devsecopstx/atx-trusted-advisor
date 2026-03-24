# Documentation index (atxFinance)

Engineering and ops docs for **aTx Finance** / `xfinance`. For Cursor agent skills, see [`.cursor/skills/README.md`](../.cursor/skills/README.md).

---

## Table of contents

- [Backlog](#backlog)
- [Frontend plan](#frontend-plan)
- [Operations — atx-sre-ops](#operations--atx-sre-ops)
- [xChat and product — atx-xchat](#xchat-and-product--atx-xchat)
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

## Operations — atx-sre-ops

| Doc | Purpose |
|-----|---------|
| [api-consolidation-spring-backend.md](./atx-sre-ops/api-consolidation-spring-backend.md) | BFF migration, Spring parity, side-effect checklist |
| [atxfinance-backend-http-api.md](./atx-sre-ops/atxfinance-backend-http-api.md) | Kotlin HTTP surface (BFF contract) |
| [audit-lineage-and-controls.md](./atx-sre-ops/audit-lineage-and-controls.md) | Audit rows, BFF audit parity, gaps vs **xdesign-review-audit** |
| [auth-oauth-spring-dual-run.md](./atx-sre-ops/auth-oauth-spring-dual-run.md) | OAuth callback cutover, Next vs Spring gaps, dual-run checklist |
| [bff-admin-backlog.md](./atx-sre-ops/bff-admin-backlog.md) | Admin/BFF backlog notes |
| [bff-enable-staging-runbook.md](./atx-sre-ops/bff-enable-staging-runbook.md) | Enable BFF proxy on staging |
| [junie-guidelines-atxfinance-backend.md](./atx-sre-ops/junie-guidelines-atxfinance-backend.md) | Kotlin backend guidelines |
| [secret-rotation.md](./atx-sre-ops/secret-rotation.md) | Secret rotation |
| [x-oauth-atx-callbacks.md](./atx-sre-ops/x-oauth-atx-callbacks.md) | X OAuth callbacks |

---

## xChat and product — atx-xchat

| Doc | Purpose |
|-----|---------|
| [atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) | Multi-agent orchestration, Phase 1 locked decisions (see also [design loop diagram](./atx-xchat/atx-multi-agent-design-loop.mmd)) |
| [atxfinance-tool-stub.md](./atx-xchat/atxfinance-tool-stub.md) | Portfolio / watchlist tool contract |
| [atxfinance-xchat-prompts.md](./atx-xchat/atxfinance-xchat-prompts.md) | xChat prompts |
| [context-routing-multi-agent-policy.md](./atx-xchat/context-routing-multi-agent-policy.md) | Retrieval vs tools vs multi-agent |
| [cursor-cloud-agent-personas.md](./atx-xchat/cursor-cloud-agent-personas.md) | Cursor cloud agent personas |
| [pre-release-check.md](./atx-xchat/pre-release-check.md) | Pre-release xChat checks |
| [xai-api-standard.md](./atx-xchat/xai-api-standard.md) | xAI API usage |
| [xchat-debug-logging.md](./atx-xchat/xchat-debug-logging.md) | Debug logging |
| [xchat-future-tool-loop.md](./atx-xchat/xchat-future-tool-loop.md) | Future tool-loop notes |
| [xchat-tools-guide.md](./atx-xchat/xchat-tools-guide.md) | Tools & prompts |
| [xdesign-review-admin-console-ux.md](./atx-xchat/xdesign-review-admin-console-ux.md) | Admin console UX review |
| [xdesign-review-legacy-prompts-inventory.md](./atx-xchat/xdesign-review-legacy-prompts-inventory.md) | Legacy prompts inventory |
| [xfeature-tools-plan.md](./atx-xchat/xfeature-tools-plan.md) | Feature tools plan |
| [xfinance-branding-review.md](./atx-xchat/xfinance-branding-review.md) | Branding review |

---

## Diagrams & assets

| File | Purpose |
|------|---------|
| [atx-multi-agent-design-loop.mmd](./atx-xchat/atx-multi-agent-design-loop.mmd) | Multi-agent flow (Mermaid) |
| [super-agent-model157.mmd](./atx-xchat/super-agent-model157.mmd) | Super-agent diagram (Mermaid) |

---

## Audit & governance

- **Audit skill:** [`.cursor/skills/atxdesign-review-audit/SKILL.md`](../.cursor/skills/atxdesign-review-audit/SKILL.md) and [`CHECKLIST.md`](../.cursor/skills/atxdesign-review-audit/CHECKLIST.md)
- **Ground truth:** [audit-lineage-and-controls.md](./atx-sre-ops/audit-lineage-and-controls.md) (Mongo `admin_audit_events`, BFF parity, test inventory, known gaps)

**Doc updates:** follow the [`generate-docs`](../.cursor/skills/generate-docs/SKILL.md) skill when changing APIs or runbooks.
