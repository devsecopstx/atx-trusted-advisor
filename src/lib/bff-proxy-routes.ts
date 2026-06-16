/**
 * Routes the Next.js App Router may forward to Spring when `ATXFINANCE_BACKEND_ORIGIN` is set.
 * Handlers use gated helpers in `backend-bff.ts` (`proxyPortfolioRequestToBackend`,
 * `proxyAdminUsersRequestToBackend`, `proxyStrategyOptionsRequestToBackend`, etc.) — not raw
 * `proxyRequestToBackend` except OAuth callbacks. Keep in sync with Kotlin `@*Mapping` and
 * `atx-docs/sre-ops/atxfinance-backend-http-api.md`.
 *
 * PR 4 shipped: deploy-note-configs + import/broker on Kotlin; proxy when ATXFINANCE_BACKEND_ORIGIN set.
 * App-user portfolio CRUD; **`PATCH /api/portfolios/{portfolioId}/watchlist`** proxies when the BFF gate is on; **`GET`/`POST`**
 * for that path stay on Next (quotes / multi-watchlist). **`POST /api/portfolios/{portfolioId}/alerts`** (desk alert create) proxies when the gate is on; **`GET`/`DELETE …/alerts`** stay on Next (list/bulk clear + desk channel fan-out on local create). App-user **`/api/portfolios/{portfolioId}/price-alerts*`** (NL price rules) stay on Next (not proxied — Spring has no route). **`/api/admin/access-requests*`** write paths proxy when the gate is on.
 * **`GET`/`POST /api/personas`** and **`GET`/`PUT`/`DELETE /api/personas/{personaId}`** proxy when the admin BFF gate is on (`shouldProxyPersonasRequestsToBackend`); persona governance subroutes (publish, versions, …) stay Next-only.
 * Admin **portfolio** subtree (accounts, **`PATCH …/watchlist`**, positions list + **PATCH/DELETE** by `positionId`, recommendations, alerts) proxies per `shouldProxyAdminUsersToBackend`; **`GET …/admin/portfolios/{id}/watchlist`** stays on Next (quotes + desk enrichments).
 * **`/api/admin/delivery-channels*`** (tenant + portfolio-nested) proxies when the admin BFF gate is on. **`/api/admin/tasks*`** (except
 * **`POST …/tasks/{taskId}/run`**, which stays on Next for Yahoo-backed scanners + `bypassMarketWindow`), **`GET /api/admin/task-runs`**, and
 * **`POST /api/admin/scheduler/tick`** proxy when **`shouldProxyAdminScheduledTasksToBackend`**
 * is on (same gate as admin users BFF). Portfolio-console uses POST /api/admin/import/broker for CSV imports.
 * **`GET /api/admin/tenants`**, **`GET /api/admin/users`**, **`GET /api/admin/login-audit`**, **`GET /api/admin/audit`:**
 * Next-only when BFF is on — see `ADMIN_USERS_BFF_NEXT_ONLY_GET_PATHS` / `shouldSkipAdminUsersBffProxyForRequest` in
 * `backend-bff.ts` (tenant register, `tenantMemberships`, login-audit collection, audit `entityType` parity).
 * **`GET /api/admin/tasks`**, **`GET /api/admin/task-runs`:** Next-only via `shouldSkipAdminScheduledTasksBffProxyForRequest`
 * (system-wide job list + `window`/`status` run history — hub quick stats parity; Spring list is tenant-scoped).
 *
 * **`/api/app-user/*`:** Next-only (find-options bootstrap, xOptions entitlements, symbol-chart). Do not call
 * `proxyRequestToBackend` there — Kotlin has no matching controllers; proxying returns JVM 404 before local logic runs.
 *
 * **`GET /api/strategy-options/expirations`:** Next-only Yahoo (`expirations/route.ts`) — not listed below; Spring still
 * exposes the route for direct JVM clients, but the app does not proxy so prod matches local latency and avoids hangs.
 *
 * **`POST /api/xchat/ask/stream`:** BFF to Spring when the product gate is on (`isXchatSseProxyBackendEnabled`); set
 * **`XCHAT_SSE_PROXY_BACKEND=0|false|no|off`** to keep Next in-process streaming. See `atx-docs/sre-ops/xchat-bffparity.md`.
 * PLAN 707 adds Spring-authoritative engine recommendations for xChat tools while Next keeps ask ownership.
 */
export type BffProxyHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type BffProxyRoute = {
  readonly method: BffProxyHttpMethod;
  /** Path as in Spring/Kotlin, e.g. `/api/portfolios/{portfolioId}` */
  readonly path: string;
};

export const BFF_PROXY_ROUTES: readonly BffProxyRoute[] = [
  { method: "POST", path: "/api/portfolios" },
  { method: "GET", path: "/api/portfolios/{portfolioId}" },
  { method: "PATCH", path: "/api/portfolios/{portfolioId}" },
  { method: "DELETE", path: "/api/portfolios/{portfolioId}" },
  { method: "GET", path: "/api/portfolios/default" },
  { method: "POST", path: "/api/portfolios/default" },
  { method: "GET", path: "/api/portfolios/current" },
  { method: "GET", path: "/api/portfolios/hot-picks" },
  { method: "GET", path: "/api/portfolios/{portfolioId}/accounts" },
  { method: "POST", path: "/api/portfolios/{portfolioId}/accounts" },
  { method: "PATCH", path: "/api/portfolios/{portfolioId}/accounts/{accountId}" },
  { method: "DELETE", path: "/api/portfolios/{portfolioId}/accounts/{accountId}" },
  { method: "GET", path: "/api/portfolios/{portfolioId}/watchlist" },
  { method: "PATCH", path: "/api/portfolios/{portfolioId}/watchlist" },
  { method: "GET", path: "/api/portfolios/{portfolioId}/workspace-snapshot" },
  { method: "GET", path: "/api/portfolios/{portfolioId}/snapshot" },
  { method: "GET", path: "/api/read/product-shell-v1" },
  { method: "GET", path: "/api/positions" },
  { method: "POST", path: "/api/positions" },
  { method: "PATCH", path: "/api/positions/{positionId}" },
  { method: "DELETE", path: "/api/positions/{positionId}" },
  { method: "GET", path: "/api/recommendations" },
  { method: "POST", path: "/api/recommendations" },
  { method: "GET", path: "/api/recommendations/{recommendationId}" },
  { method: "GET", path: "/api/portfolios/{portfolioId}/recommendations" },
  { method: "POST", path: "/api/portfolios/{portfolioId}/recommendations" },
  { method: "POST", path: "/api/portfolios/{portfolioId}/alerts" },
  { method: "GET", path: "/api/strategy-options" },
  { method: "GET", path: "/api/strategy-jobs" },
  { method: "POST", path: "/api/strategy-jobs" },
  { method: "GET", path: "/api/strategy-jobs/{jobId}" },
  { method: "POST", path: "/api/strategy-jobs/{jobId}/turns" },
  { method: "GET", path: "/api/strategy-jobs/{jobId}/artifact" },
  { method: "POST", path: "/api/strategy-recommendations/generate" },
  { method: "POST", path: "/api/profit-finder/scan" },
  { method: "POST", path: "/api/user-feedback" },
  { method: "POST", path: "/api/xchat/ask/stream" },
  { method: "GET", path: "/api/admin/bootstrap-status" },
  { method: "GET", path: "/api/admin/audit" },
  { method: "GET", path: "/api/admin/access-requests" },
  { method: "POST", path: "/api/admin/access-requests" },
  { method: "GET", path: "/api/admin/access-requests/{requestId}" },
  { method: "PATCH", path: "/api/admin/access-requests/{requestId}" },
  { method: "PUT", path: "/api/admin/access-requests/{requestId}" },
  { method: "DELETE", path: "/api/admin/access-requests/{requestId}" },
  { method: "GET", path: "/api/admin/users" },
  { method: "POST", path: "/api/admin/users" },
  { method: "GET", path: "/api/admin/users/approved" },
  { method: "GET", path: "/api/admin/users/{userId}" },
  { method: "PUT", path: "/api/admin/users/{userId}" },
  { method: "DELETE", path: "/api/admin/users/{userId}" },
  { method: "PATCH", path: "/api/admin/users/{userId}/role" },
  { method: "PATCH", path: "/api/admin/users/{userId}/plan" },
  { method: "PATCH", path: "/api/admin/users/{userId}/email" },
  { method: "GET", path: "/api/admin/users/{userId}/settings" },
  { method: "PUT", path: "/api/admin/users/{userId}/settings" },
  { method: "GET", path: "/api/admin/tasks" },
  { method: "POST", path: "/api/admin/tasks" },
  { method: "PATCH", path: "/api/admin/tasks/{taskId}" },
  { method: "DELETE", path: "/api/admin/tasks/{taskId}" },
  { method: "POST", path: "/api/admin/tasks/{taskId}/run" },
  { method: "GET", path: "/api/admin/task-runs" },
  { method: "POST", path: "/api/admin/scheduler/tick" },
  { method: "GET", path: "/api/admin/deploy-note-configs" },
  { method: "POST", path: "/api/admin/deploy-note-configs" },
  { method: "GET", path: "/api/admin/deploy-note-configs/{configId}" },
  { method: "PUT", path: "/api/admin/deploy-note-configs/{configId}" },
  { method: "DELETE", path: "/api/admin/deploy-note-configs/{configId}" },
  { method: "GET", path: "/api/admin/delivery-channels" },
  { method: "POST", path: "/api/admin/delivery-channels" },
  { method: "GET", path: "/api/admin/delivery-channels/{channelId}" },
  { method: "PATCH", path: "/api/admin/delivery-channels/{channelId}" },
  { method: "DELETE", path: "/api/admin/delivery-channels/{channelId}" },
  { method: "POST", path: "/api/admin/delivery-channels/{channelId}/test" },
  { method: "POST", path: "/api/admin/import/broker" },
  { method: "GET", path: "/api/admin/portfolios" },
  { method: "POST", path: "/api/admin/portfolios" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}" },
  { method: "DELETE", path: "/api/admin/portfolios/{portfolioId}" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}/accounts" },
  { method: "POST", path: "/api/admin/portfolios/{portfolioId}/accounts" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}" },
  { method: "DELETE", path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}/watchlist" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}/watchlist" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions" },
  { method: "POST", path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions/{positionId}" },
  { method: "DELETE", path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions/{positionId}" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}/recommendations" },
  { method: "POST", path: "/api/admin/portfolios/{portfolioId}/recommendations" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}" },
  { method: "DELETE", path: "/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}/alerts" },
  { method: "POST", path: "/api/admin/portfolios/{portfolioId}/alerts" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}/alerts/{alertId}" },
  { method: "DELETE", path: "/api/admin/portfolios/{portfolioId}/alerts/{alertId}" },
  { method: "GET", path: "/api/admin/portfolios/{portfolioId}/delivery-channels" },
  { method: "POST", path: "/api/admin/portfolios/{portfolioId}/delivery-channels" },
  { method: "PATCH", path: "/api/admin/portfolios/{portfolioId}/delivery-channels/{channelId}" },
  { method: "DELETE", path: "/api/admin/portfolios/{portfolioId}/delivery-channels/{channelId}" },
  { method: "GET", path: "/api/rag/files" },
  { method: "POST", path: "/api/rag/files" },
  { method: "GET", path: "/api/rag/files/{fileId}/readiness" },
  { method: "GET", path: "/api/personas" },
  { method: "POST", path: "/api/personas" },
  { method: "GET", path: "/api/personas/{personaId}" },
  { method: "PUT", path: "/api/personas/{personaId}" },
  { method: "DELETE", path: "/api/personas/{personaId}" },
  { method: "POST", path: "/api/access-requests" },
  { method: "GET", path: "/api/auth/x/callback" }
] as const;

function kotlinMappingAnnotation(method: BffProxyHttpMethod): string {
  switch (method) {
    case "GET":
      return "GetMapping";
    case "POST":
      return "PostMapping";
    case "PUT":
      return "PutMapping";
    case "PATCH":
      return "PatchMapping";
    case "DELETE":
      return "DeleteMapping";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

/** `@GetMapping("/api/...")` string as stored in Kotlin sources — for smoke parity with controllers. */
export function toKotlinBffMappingNeedle(route: BffProxyRoute): string {
  return `@${kotlinMappingAnnotation(route.method)}("${route.path}")`;
}
