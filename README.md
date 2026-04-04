# atx Trusted Advisor — Core App

User-facing product: **atx Trusted Advisor** (Trusted Advisory lockup in header/footer). This repository is the **atxFinance** Next.js core: admin console and signed-in **app_user** surfaces, **Powered by xAI / Grok** for institutional-grade options and portfolio workflows.

## Stress-free trading — top 5 product pillars

1. **Conversational desk (xChat)** — Default **atx-trusted-advisor** persona for app roles, **advisor** for global admins; optional RAG collections and tools so answers stay grounded instead of guesswork.
2. **Portfolio + watchlist in one workspace** — Default book, linked accounts, watchlist with CSV import/export and aligned **risk / outlook** context (book, accounts, and watchlist) so execution views match how you think about risk.
3. **xStrategyBuilder & option chains** — Strategy options UI, expirations, and structured chain data to reduce tab-hopping and manual reconstruction of setups.
4. **Access you control** — Approval-based onboarding, platform roles (**viewer** / **operator** / **advisor**), and admin governance for personas, portfolios, and ops—no anonymous wild-west trading surface.
5. **Compliance-minded chrome** — Legal stubs (imprint, terms, privacy, security, vulnerability reporting), in-app disclaimers, and versioned API inventory for operators who need a serious audit trail.

Platform roles vs session: see `[atx-docs/guides/auth-and-access.md](atx-docs/guides/auth-and-access.md)`.

Branding reference for UI copy: `[atx-docs/xchat/xfinance-branding-review.md](atx-docs/xchat/xfinance-branding-review.md)` (§8 user chrome). Marketing assets, prompt/tag sources, and the sample watchlist CSV live under `**[atx-docs/branding/](atx-docs/branding/README.md)`**.

## Docs

- **Development guides** — quick start and runbooks split by domain: [Local development](atx-docs/guides/local-development.md) · [Auth and access](atx-docs/guides/auth-and-access.md) · [API endpoints](atx-docs/guides/api-endpoints.md) · [xChat and personas](atx-docs/guides/xchat-personas.md) · [Deploy and ops](atx-docs/guides/deploy-and-ops.md)
- Operator runbook: [AGENTS.md](AGENTS.md)
- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Backlog / open gaps (TODO, design TBD): `[atx-docs/PLAN.md](atx-docs/PLAN.md)` · [documentation index](atx-docs/README.md)
- **API inventory & Swagger:** `GET /api/openapi` (public JSON spec); admin Swagger UI at `/admin/api-docs` (signed-in admin). Validation steps: [API endpoint guide checklist](atx-docs/guides/api-endpoints.md#api-docs-validation-checklist).

