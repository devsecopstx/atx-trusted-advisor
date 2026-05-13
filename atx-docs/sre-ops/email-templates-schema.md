# MongoDB — `email_templates` + `portfolio_email_preferences`

**Purpose:** admin-authored portfolio digest emails (weekly + daily) with tenant + per-portfolio
overrides. Templates are **Markdown** with a small fixed **Mustache** variable surface; the
renderer escapes variable values to prevent HTML injection from operator-controlled fields like
portfolio name.

Resolver precedence (matches `prompt_templates`):

1. `portfolio_email_preferences` row for `(tenantId, portfolioId, templateSlug)` — overrides on
   `subject`, `body`, `cadence`, `enabled`.
2. `email_templates` row for `(slug, tenantId)`.
3. `email_templates` row for `(slug, tenantId: null)` — global default.

When no template exists at any tier the digest task logs `no_template` for that
`(portfolio, slug)` and skips.

## Collection: `email_templates`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | auto | Primary key |
| `slug` | string | yes | One of `portfolio-digest-weekly`, `portfolio-digest-daily` |
| `version` | string | yes | Free-form label (e.g. `1.0`) |
| `tenantId` | ObjectId \| null | yes | `null` = platform default |
| `subject` | string | yes | Mustache vars allowed; **no Markdown** |
| `body` | string | yes | **Markdown** + Mustache; rendered to branded HTML at send time |
| `active` | boolean | yes | Inactive rows ignored by resolver |
| `defaultCadence` | `"daily" \| "weekly"` | yes | UI hint; cron still owns when sends fire |
| `createdAt` | Date | auto | Audit |
| `updatedAt` | Date | auto | Audit |

**Indexes** (created by `ensureEmailTemplateIndexes` on `seed:email-templates` / `seed:admin`):

- **Unique:** `{ slug: 1, tenantId: 1 }` — `uniq_email_templates_slug_tenant`
- **Lookup:** `{ slug: 1, tenantId: 1, active: 1 }` — `idx_email_templates_slug_tenant_active`

## Collection: `portfolio_email_preferences`

Per-portfolio routing + override. Preferences **never** duplicate the full template body.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | auto | Primary key |
| `tenantId` | ObjectId | yes | Tenant scope |
| `portfolioId` | ObjectId | yes | Owning `tenant_portfolio` row |
| `templateSlug` | string | yes | Same enum as `email_templates.slug` |
| `enabled` | boolean | yes | Master gate — `false` skips digest for this portfolio + template |
| `cadenceOverride` | `"daily" \| "weekly"` | optional | Falls back to `template.defaultCadence` |
| `subjectOverride` | string | optional | Falls back to template subject |
| `bodyOverride` | string | optional | Falls back to template body |
| `createdAt` | Date | auto | Audit |
| `updatedAt` | Date | auto | Audit |

**Indexes** (created by `ensurePortfolioEmailPreferenceIndexes`):

- **Unique:** `{ tenantId: 1, portfolioId: 1, templateSlug: 1 }` — `uniq_portfolio_email_preferences_scope`
- **Lookup:** `{ tenantId: 1, enabled: 1 }` — `idx_portfolio_email_preferences_tenant_enabled`

## Mustache variable surface (fixed)

Adding new variables is a **typed code change** in `src/modules/email-templates/types.ts`
(`EmailTemplateRenderContext`) — keep the surface tight so authors can't break a digest by
referencing fields that don't exist.

| Path | Type | Notes |
| --- | --- | --- |
| `{{portfolio.name}}` | string | HTML-escaped |
| `{{portfolio.id}}` | string | Hex ObjectId |
| `{{period.cadence}}` | `daily \| weekly` | |
| `{{period.start}}` | ISO date | |
| `{{period.end}}` | ISO date | |
| `{{totalValue}}` | string | Formatted USD |
| `{{weekChange}}` | string | Signed % |
| `{{dayChange}}` | string | Signed % |
| `{{narrative}}` | string | xAI-generated 2–3 paragraphs (with deterministic fallback) |
| `{{#events}} … {{/events}}` | array section | Item fields: `title`, `body`, `symbol` |
| `{{#positions}} … {{/positions}}` | array section | Item fields: `symbol`, `qty`, `marketValue` |
| `{{#topMovers}} … {{/topMovers}}` | array section | Item fields: `symbol`, `changePct` |
| `{{#hasEvents}} … {{/hasEvents}}` | boolean section | Mirrors `events.length > 0` |
| `{{#hasPositions}} … {{/hasPositions}}` | boolean section | |
| `{{#hasTopMovers}} … {{/hasTopMovers}}` | boolean section | |

Inverted sections supported via `{{^section}}…{{/section}}` (renders when value is falsy / empty
array). Comments via `{{! … }}`.

## Markdown subset (rendered server-side, no extra deps)

Headings (`#`/`##`/`###`), paragraphs, unordered + ordered lists, block quotes, horizontal rule,
inline `**bold**`, `*italic*` / `_italic_`, `` `code` ``, `[label](https://…)` links. Other
schemes (`javascript:`, `data:`) are stripped to plain text.

Plain-text fallback (for SMTP `multipart/alternative`) is derived from the same Markdown source.

## Scheduled task: `portfolio_email_digest`

- Category enum: `portfolio_email_digest` (`src/lib/scheduled-task-category-schema.ts`).
- Default cron: `30 23 * * 1-5` (Mon–Fri 23:30 UTC).
- Runner: `src/modules/email-templates/portfolio-email-digest-task.ts` (registered in
  `src/modules/core-admin/task-runner.ts`).
- Per tick: iterate `tenant_portfolio` for the task's tenant, resolve each `(portfolio, slug)`
  effective template, build context (events from `portfolio_alerts`, positions snapshot via
  `listPortfolioPositionsByAccount`, AI narrative via `chatWithXai`), render Markdown→HTML, send
  to enabled `email` rows in `portfolio_delivery_channels` via `desk-smtp`.
- SMTP not configured (`SMTP_HOST/SMTP_USER/SMTP_PASS/DESK_EMAIL_FROM` missing) → status
  `smtp_unavailable` per portfolio (no retry storm).

## Admin surfaces

- `GET/POST /api/admin/email-templates` — list (tenant + global) + create.
- `GET/PATCH/DELETE /api/admin/email-templates/{slug}?scope=tenant|global` — per-row edit. `scope=global` writes against `tenantId: null`.
- `GET/PATCH /api/admin/portfolios/{portfolioId}/email-preferences` — read effective + upsert
  override. `null` on optional patch fields **clears** the override.
- UI: `/admin/email-templates`, `/admin/email-templates/{slug}`,
  `/admin/portfolios/{portfolioId}/email-preferences`. `global_admin` only.

All four mutations write `audit_events` (`entityType: "email_template" | "portfolio_email_preference"`).

## Ops

- **Seed / upsert global rows + ensure indexes:** `npm run seed:email-templates`
- **Also runs** as part of `npm run seed:admin` unless `SKIP_SEED_EMAIL_TEMPLATES=1`
- **Local smoke:** create a portfolio, set `SMTP_*` + `DESK_EMAIL_FROM`, add an `email`
  `portfolio_delivery_channels` row, enable a `portfolio_email_preferences` row in
  `/admin/portfolios/{id}/email-preferences`, then run `POST /api/admin/tasks/{taskId}/run` on
  the `portfolio_email_digest` task.
