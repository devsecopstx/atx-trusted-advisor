# Cursor skills index (atxFinance)

Agent skills under **`.cursor/skills/`**. Each folder contains **`SKILL.md`** (and sometimes `CHECKLIST.md`). Repo docs: **[`atx-docs/README.md`](../../atx-docs/README.md)**.

---

## Table of contents

- [Design & review](#design--review)
- [Platform, backend & deploy](#platform-backend--deploy)
- [xChat, AI & agents](#xchat-ai--agents)
- [App delivery & quality](#app-delivery--quality)
- [Developer workflow](#developer-workflow)
- [Options strategies](#options-strategies)
- [Brand, UX & content](#brand-ux--content)
- [Other](#other)

---

## Default skill policy (mandatory)

- `skill-options-scan` — Use for **all** `options_scan` and report generation work (**MANDATORY**).
- `atxdesign-review-audit` — Use for any API or schema changes.
- `test-commit-push` — Run before committing report-related code.

---

## Design & review

| Skill | |
|-------|---|
| [atxdesign-review](atxdesign-review/SKILL.md) | Core product/design review gate |
| [atxdesign-review-adversarial](atxdesign-review-adversarial/SKILL.md) | Abuse, prompt injection, containment |
| [atxdesign-review-audit](atxdesign-review-audit/SKILL.md) | Auditability, lineage, non-repudiation |
| [atxdesign-review-reliability](atxdesign-review-reliability/SKILL.md) | Cost, latency, reliability |
| [xchat-rag-xai-design-review](xchat-rag-xai-design-review/SKILL.md) | RAG + xAI routing review |
| [design-review-best-practices](design-review-best-practices/SKILL.md) | General repo / design practices |

---

## Platform, backend & deploy

| Skill | |
|-------|---|
| [backend-architecture](backend-architecture/SKILL.md) | Multi-node backend architecture |
| [backend-ci](backend-ci/SKILL.md) | CI validation |
| [backend-deploy-prod](backend-deploy-prod/SKILL.md) | Production deploy |
| [backend-deploy-stage](backend-deploy-stage/SKILL.md) | Staging deploy |
| [backend-runbook](backend-runbook/SKILL.md) | Operator runbook |
| [backend-start-local](backend-start-local/SKILL.md) | Local backend |
| [backend-start-stage](backend-start-stage/SKILL.md) | Staging session |
| [sre-gcp-foundation](sre-gcp-foundation/SKILL.md) | GCP foundation |
| [sre-ops-gcp-gke](sre-ops-gcp-gke/SKILL.md) | GKE SRE expert (GitOps, observability, AI inference) |
| [gcp-env-atx-recreate](gcp-env-atx-recreate/SKILL.md) | Recreate GCP Cloud Run |
| [deploy-production](deploy-production/SKILL.md) | App production deploy |
| [deploy-staging](deploy-staging/SKILL.md) | App staging deploy |

---

## xChat, AI & agents

| Skill | |
|-------|---|
| [skill-xchat-validation-checklist](skill-xchat-validation-checklist/SKILL.md) | xChat validation |
| [cursor-cloud-agents](cursor-cloud-agents/SKILL.md) | Cursor cloud agents |
| [ai-agent-integration](ai-agent-integration/SKILL.md) | Async agents, LangChain-style |
| [langchain-agent-executor](langchain-agent-executor/SKILL.md) | LangChain executors |
| [cloud-agents-starter](cloud-agents-starter/SKILL.md) | Cloud agent bootstrap |
| [skill-yahoo-finance-tool](skill-yahoo-finance-tool/SKILL.md) | Yahoo finance tool |

---

## App delivery & quality

| Skill | |
|-------|---|
| [ios-version-bump](ios-version-bump/SKILL.md) | Capacitor iOS Version / Build bump (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) |
| [feature-delivery](feature-delivery/SKILL.md) | Scoped PR delivery |
| [skill-tenant-roadmap](skill-tenant-roadmap/SKILL.md) | Tenant roadmap: shipped slices (11/705/706), PLAN **10** provisioning/bootstrap Q&A |
| [skill-tenant-tasks](skill-tenant-tasks/SKILL.md) | Tenant workspace automations (`/workspace/tasks`, `ownerKind: tenant_user`) |
| [generate-docs](generate-docs/SKILL.md) | Docs & OpenAPI hygiene |
| [test-commit-push](test-commit-push/SKILL.md) | Pre-commit validation |
| [test-automation](test-automation/SKILL.md) | Tests |
| [test-lint](test-lint/SKILL.md) | Lint / typecheck |
| [test-ui](test-ui/SKILL.md) | UI smoke |
| [ci-failure](ci-failure/SKILL.md) | CI triage |
| [pre-merge-secret-update](pre-merge-secret-update/SKILL.md) | Secret hygiene |
| [fix-current-file](fix-current-file/SKILL.md) | Fix current file |

---

## Developer workflow

| Skill | |
|-------|---|
| [setup-development](setup-development/SKILL.md) | Fresh machine bootstrap |
| [development-devtest](development-devtest/SKILL.md) | Dev test loop |
| [docker-setup](docker-setup/SKILL.md) | Docker |
| [fullstack-js-ts-pwa](fullstack-js-ts-pwa/SKILL.md) | Full-stack patterns |
| [mobile-first-responsive-ux](mobile-first-responsive-ux/SKILL.md) | Responsive UX |

---

## Options strategies

Ten option playbooks under **`skill-*`**: core setup, guardrails, and output format. Apply TSLA/xFinance or other ticker context in the conversation when relevant — a second duplicated skill family is not maintained in-repo.

Each folder includes **`CHECKLIST.md`** (checkboxes for **Inputs (core setup)**, **Preferences / guardrails**, **Output format**) aligned with **`SKILL.md`** sections **`## Core setup`**, **`## Guardrails`**, **`## Output format`**.

| Structure | Skill |
|-----------|-------|
| Bull call debit spread | [skill-bull-call-debit-spread](skill-bull-call-debit-spread/SKILL.md) |
| Bull put credit spread | [skill-bull-put-credit-spread](skill-bull-put-credit-spread/SKILL.md) |
| Calendar spread | [skill-calendar-spread](skill-calendar-spread/SKILL.md) |
| Cash-secured puts | [skill-cash-secured-puts](skill-cash-secured-puts/SKILL.md) |
| Covered calls | [skill-covered-calls](skill-covered-calls/SKILL.md) |
| Diagonal spread | [skill-diagonal-spread](skill-diagonal-spread/SKILL.md) |
| Iron condor | [skill-iron-condor](skill-iron-condor/SKILL.md) |
| LEAP + CC overlay | [skill-leap-call-cc-overlay](skill-leap-call-cc-overlay/SKILL.md) |
| Poor man's covered call | [skill-poor-mans-covered-call](skill-poor-mans-covered-call/SKILL.md) |
| Wheel | [skill-wheel-strategy](skill-wheel-strategy/SKILL.md) |

---

## Brand, UX & content

| Skill | |
|-------|---|
| [design-branding](design-branding/SKILL.md) | Brand review |
| [brand-generator](brand-generator/SKILL.md) | Brand asset prompts |
| [design-ops](design-ops/SKILL.md) | Design ops |
| [sre-docs-ops](sre-docs-ops/SKILL.md) | Docs ops |
| [runbook-navigator](runbook-navigator/SKILL.md) | Runbook navigation |
| [skill-learning-tutor](skill-learning-tutor/SKILL.md) | Learning tutor |

---

## Other

| Skill | |
|-------|---|
| [aggresive-csp-tsla](aggresive-csp-tsla/SKILL.md) | CSP / TSLA options context |
| [skill-options-principles](skill-options-principles/SKILL.md) | Options principles |
| [sre-ops-xrotate-keys](sre-ops-xrotate-keys/SKILL.md) | Key rotation |
| [skill-xstrategy](skill-xstrategy/options-core.md) | Options narrative reference (`options-core.md` only; no `SKILL.md` yet) |
