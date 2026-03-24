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

## Design & review

| Skill | |
|-------|---|
| [atxdesign-review](atxdesign-review/SKILL.md) | Core product/design review gate |
| [atxdesign-review-adversarial](atxdesign-review-adversarial/SKILL.md) | Abuse, prompt injection, containment |
| [atxdesign-review-audit](atxdesign-review-audit/SKILL.md) | Auditability, lineage, non-repudiation |
| [atxdesign-review-reliability](atxdesign-review-reliability/SKILL.md) | Cost, latency, reliability |
| [atx-xchat-rag-xai-design-review](atx-xchat-rag-xai-design-review/SKILL.md) | RAG + xAI routing review |
| [design-review-best-practices](design-review-best-practices/SKILL.md) | General repo / design practices |

---

## Platform, backend & deploy

| Skill | |
|-------|---|
| [atx-backend-architecture](atx-backend-architecture/SKILL.md) | Multi-node backend architecture |
| [atx-backend-ci](atx-backend-ci/SKILL.md) | CI validation |
| [atx-backend-deploy-prod](atx-backend-deploy-prod/SKILL.md) | Production deploy |
| [atx-backend-deploy-stage](atx-backend-deploy-stage/SKILL.md) | Staging deploy |
| [atx-backend-runbook](atx-backend-runbook/SKILL.md) | Operator runbook |
| [atx-backend-start-local](atx-backend-start-local/SKILL.md) | Local backend |
| [atx-backend-start-stage](atx-backend-start-stage/SKILL.md) | Staging session |
| [atx-sre-gcp-foundation](atx-sre-gcp-foundation/SKILL.md) | GCP foundation |
| [atx-sre-ops-gcp-gke](atx-sre-ops-gcp-gke/SKILL.md) | GKE SRE expert (GitOps, observability, AI inference) |
| [gcp-env-atx-recreate](gcp-env-atx-recreate/SKILL.md) | Recreate GCP Cloud Run |
| [atx-deploy-production](atx-deploy-production/SKILL.md) | App production deploy |
| [atx-deploy-staging](atx-deploy-staging/SKILL.md) | App staging deploy |

---

## xChat, AI & agents

| Skill | |
|-------|---|
| [atx-skill-xchat-validation-checklist](atx-skill-xchat-validation-checklist/SKILL.md) | xChat validation |
| [atx-cursor-cloud-agents](atx-cursor-cloud-agents/SKILL.md) | Cursor cloud agents |
| [ai-agent-integration](ai-agent-integration/SKILL.md) | Async agents, LangChain-style |
| [langchain-agent-executor](langchain-agent-executor/SKILL.md) | LangChain executors |
| [cloud-agents-starter](cloud-agents-starter/SKILL.md) | Cloud agent bootstrap |
| [atx-skill-yahoo-finance-tool](atx-skill-yahoo-finance-tool/SKILL.md) | Yahoo finance tool |

---

## App delivery & quality

| Skill | |
|-------|---|
| [atx-feature-delivery](atx-feature-delivery/SKILL.md) | Scoped PR delivery |
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

Ten option playbooks under **`atx-skill-*`**: core setup, guardrails, and output format. Apply TSLA/xFinance or other ticker context in the conversation when relevant — a second duplicated skill family is not maintained in-repo.

Each folder includes **`CHECKLIST.md`** (checkboxes for **Inputs (core setup)**, **Preferences / guardrails**, **Output format**) aligned with **`SKILL.md`** sections **`## Core setup`**, **`## Guardrails`**, **`## Output format`**.

| Structure | Skill |
|-----------|-------|
| Bull call debit spread | [atx-skill-bull-call-debit-spread](atx-skill-bull-call-debit-spread/SKILL.md) |
| Bull put credit spread | [atx-skill-bull-put-credit-spread](atx-skill-bull-put-credit-spread/SKILL.md) |
| Calendar spread | [atx-skill-calendar-spread](atx-skill-calendar-spread/SKILL.md) |
| Cash-secured puts | [atx-skill-cash-secured-puts](atx-skill-cash-secured-puts/SKILL.md) |
| Covered calls | [atx-skill-covered-calls](atx-skill-covered-calls/SKILL.md) |
| Diagonal spread | [atx-skill-diagonal-spread](atx-skill-diagonal-spread/SKILL.md) |
| Iron condor | [atx-skill-iron-condor](atx-skill-iron-condor/SKILL.md) |
| LEAP + CC overlay | [atx-skill-leap-call-cc-overlay](atx-skill-leap-call-cc-overlay/SKILL.md) |
| Poor man's covered call | [atx-skill-poor-mans-covered-call](atx-skill-poor-mans-covered-call/SKILL.md) |
| Wheel | [atx-skill-wheel-strategy](atx-skill-wheel-strategy/SKILL.md) |

---

## Brand, UX & content

| Skill | |
|-------|---|
| [atx-design-branding](atx-design-branding/SKILL.md) | Brand review |
| [atx-brand-generator](atx-brand-generator/SKILL.md) | Brand asset prompts |
| [atx-design-ops](atx-design-ops/SKILL.md) | Design ops |
| [atx-sre-docs-ops](atx-sre-docs-ops/SKILL.md) | Docs ops |
| [atx-runbook-navigator](atx-runbook-navigator/SKILL.md) | Runbook navigation |
| [atx-skill-learning-tutor](atx-skill-learning-tutor/SKILL.md) | Learning tutor |

---

## Other

| Skill | |
|-------|---|
| [aggresive-csp-tsla](aggresive-csp-tsla/SKILL.md) | CSP / TSLA options context |
| [atx-skill-options-principles](atx-skill-options-principles/SKILL.md) | Options principles |
| [sre-ops-xrotate-keys](sre-ops-xrotate-keys/SKILL.md) | Key rotation |
