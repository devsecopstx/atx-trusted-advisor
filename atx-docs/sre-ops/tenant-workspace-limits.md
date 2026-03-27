# Tenant workspace limits (SRE / ops)

Per-tenant quotas for the Next.js BFF. Defaults are code-defined; overrides live on Mongo `core_tenants.workspaceLimits` (partial object, camelCase keys).

## Fields (effective = merge defaults + tenant partial)

| Key | Default | Enforcement |
|-----|---------|-------------|
| `userXoptionsLimit` | 10 | Daily UTC bucket per user+tenant; `app_feature_daily_usage` (`feature: xoptions_deck`). Signed-in app users with `canUserLogin`; `global_admin` bypass. |
| `userChatLimit` | 10 | `min(plan daily max, userChatLimit)` in `POST /api/xchat/ask`; `global_admin` bypasses daily cap. |
| `tenantPortfolioLimit` | 1 | New portfolio rows in tenant for that user (admin + app flows). |
| `portfolioAccountLimit` | 1 | New `portfolio_accounts` per portfolio. |

## Mongo collections

- **`core_tenants`**: optional `workspaceLimits` subdocument.
- **`app_feature_daily_usage`**: usage rows with TTL on `expiresAt` (~35d). Indexes: unique `key`, TTL on `expiresAt`.

Indexes are created best-effort on first use (same pattern as other identity usage helpers).

## Admin API

- `GET/PATCH /api/admin/tenants/{tenantId}/workspace-limits` — `global_admin` only.
- UI: `/admin/tenant-workspace` (session tenant id is the managed workspace for the signed-in admin).

## App user surfacing

- `/account/billing` shows **resolved** effective limits for the signed-in user’s tenant.

## Deploy / rollback

No migration required: missing `workspaceLimits` resolves to defaults. Rolling back code without removing DB fields keeps tenant overrides; ensure new code paths tolerate unknown extra keys (they are ignored by merge).

## Related errors (HTTP)

- `workspace_portfolio_account_limit_exceeded` — `403` on account create.
- `workspace_tenant_portfolio_limit_exceeded` — `403` on portfolio create when over cap.
