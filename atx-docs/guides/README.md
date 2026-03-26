# Guides

Focused operational/developer guides extracted from `DEVELOPMENT.md`.

Use this folder as the first stop. Each guide is an entrypoint that links to deeper source docs in `atx-docs/sre-ops`, `atx-docs/xchat`, and related runbooks.

| Guide | Purpose |
|---|---|
| `local-development.md` | Local setup, env keys, Mongo/Compose, backend+frontend run order, validation gates |
| `auth-and-access.md` | Platform roles vs tenant membership, onboarding/access flows, OAuth and app_user troubleshooting |
| `api-endpoints.md` | Current API surface inventory grouped by domain |
| `xchat-personas.md` | xChat APIs, persona governance, plan limits, collection ops, seed and batch notes |
| `deploy-and-ops.md` | Staging/prod deploy flow, GCP/GitHub secrets model, rollback and operator checks |

## Deep-dive source docs

- Operations and migration details: `atx-docs/sre-ops/*`
- xChat behavior, tools, and observability: `atx-docs/xchat/*`
- Operator quick commands and production checks: `AGENTS.md`
- Backlog and deferred items: `atx-docs/PLAN.md`
