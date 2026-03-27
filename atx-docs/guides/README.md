# Guides

Focused operational/developer guides extracted from `DEVELOPMENT.md`.

Use this folder as the first stop. Each guide is an entrypoint that links to deeper source docs in `atx-docs/sre-ops`, `atx-docs/xchat`, and related runbooks.

| Guide | Purpose |
| --- | --- |
| [local-development.md](./local-development.md) | Local setup, env keys, Mongo/Compose, backend+frontend run order, validation gates |
| [auth-and-access.md](./auth-and-access.md) | Platform roles vs tenant membership, onboarding/access flows, OAuth and app_user troubleshooting |
| [api-endpoints.md](./api-endpoints.md) | Current API surface inventory grouped by domain |
| [xchat-personas.md](./xchat-personas.md) | xChat APIs, persona governance, plan limits, collection ops, seed and batch notes |
| [deploy-and-ops.md](./deploy-and-ops.md) | Staging/prod deploy flow, GCP/GitHub secrets model, rollback and operator checks |

## Deep-dive source docs

- Operations and migration details: `atx-docs/sre-ops/*` (optional Next.js Redis: [redis-cache-next.md](../sre-ops/redis-cache-next.md))
- xChat behavior, tools, and observability: `atx-docs/xchat/*`
- Operator quick commands and production checks: [AGENTS.md](../../AGENTS.md)
- Backlog and deferred items: `atx-docs/PLAN.md`

## Key rotation and admin seed references

### Key rotation

- [atx-docs/sre-ops/secret-rotation.md](../sre-ops/secret-rotation.md) - canonical rotation runbook
- [.cursor/skills/sre-ops-xrotate-keys/SKILL.md](../../.cursor/skills/sre-ops-xrotate-keys/SKILL.md) - rotation procedure skill
- [.cursor/skills/sre-ops-xrotate-keys/CHECKLIST.md](../../.cursor/skills/sre-ops-xrotate-keys/CHECKLIST.md) - operator checklist

### Admin seed and local bootstrap

- [atx-docs/guides/local-development.md](./local-development.md) - tight local bootstrap flow
- [AGENTS.md](../../AGENTS.md) - standard local flow and troubleshooting
- [scripts/seed-admin-user.mjs](../../scripts/seed-admin-user.mjs) - seed behavior (`seed:admin`)
- [atx-rag-collection/atx-rag-collection.md](../../atx-rag-collection/atx-rag-collection.md) - RAG source tree + ingest rules
- [atx-docs/PLAN.md](../PLAN.md) - tracked seed/RAG follow-ups
