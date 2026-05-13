import { getAtxfinanceBackendOrigin } from "@/lib/env";

type BffHttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

type BffRouteDefinition = {
  pathTemplate: string;
  methods: readonly BffHttpMethod[];
};

/**
 * Next.js BFF surface that can proxy to atxfinance-backend when
 * `ATXFINANCE_BACKEND_ORIGIN` is set.
 */
export const nextBffApi = {
  portfolio: {
    index: {
      pathTemplate: "/api/portfolios",
      methods: ["POST"]
    },
    byId: {
      pathTemplate: "/api/portfolios/{portfolioId}",
      methods: ["GET", "PATCH", "DELETE"]
    },
    default: {
      pathTemplate: "/api/portfolios/default",
      methods: ["GET", "POST"]
    },
    current: {
      pathTemplate: "/api/portfolios/current",
      methods: ["GET"]
    },
    accounts: {
      pathTemplate: "/api/portfolios/{portfolioId}/accounts",
      methods: ["GET", "POST"]
    },
    accountById: {
      pathTemplate: "/api/portfolios/{portfolioId}/accounts/{accountId}",
      methods: ["PATCH", "DELETE"]
    },
    watchlist: {
      pathTemplate: "/api/portfolios/{portfolioId}/watchlist",
      methods: ["GET", "PATCH"]
    },
    workspaceSnapshot: {
      pathTemplate: "/api/portfolios/{portfolioId}/workspace-snapshot",
      methods: ["GET"]
    },
    portfolioSnapshot: {
      pathTemplate: "/api/portfolios/{portfolioId}/snapshot",
      methods: ["GET"]
    },
    productShellReadFacade: {
      pathTemplate: "/api/read/product-shell-v1",
      methods: ["GET"]
    }
  },
  positions: {
    index: {
      pathTemplate: "/api/positions",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/positions/{positionId}",
      methods: ["DELETE"]
    }
  },
  recommendations: {
    index: {
      pathTemplate: "/api/recommendations",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/recommendations/{recommendationId}",
      methods: ["GET"]
    }
  },
  portfolioRecommendations: {
    index: {
      pathTemplate: "/api/portfolios/{portfolioId}/recommendations",
      methods: ["GET", "POST"]
    }
  },
  strategyOptions: {
    chain: {
      pathTemplate: "/api/strategy-options",
      methods: ["GET"]
    }
  },
  strategyJobs: {
    index: {
      pathTemplate: "/api/strategy-jobs",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/strategy-jobs/{jobId}",
      methods: ["GET"]
    },
    turns: {
      pathTemplate: "/api/strategy-jobs/{jobId}/turns",
      methods: ["POST"]
    },
    artifact: {
      pathTemplate: "/api/strategy-jobs/{jobId}/artifact",
      methods: ["GET"]
    }
  },
  strategyRecommendations: {
    generate: {
      pathTemplate: "/api/strategy-recommendations/generate",
      methods: ["POST"]
    }
  },
  userFeedback: {
    post: {
      pathTemplate: "/api/user-feedback",
      methods: ["POST"]
    }
  },
  xchat: {
    askStream: {
      pathTemplate: "/api/xchat/ask/stream",
      methods: ["POST"]
    }
  },
  admin: {
    bootstrapStatus: {
      pathTemplate: "/api/admin/bootstrap-status",
      methods: ["GET"]
    },
    audit: {
      pathTemplate: "/api/admin/audit",
      methods: ["GET"]
    },
    loginAudit: {
      pathTemplate: "/api/admin/login-audit",
      methods: ["GET"]
    },
    accessRequestsIndex: {
      pathTemplate: "/api/admin/access-requests",
      methods: ["GET", "POST"]
    },
    accessRequestsById: {
      pathTemplate: "/api/admin/access-requests/{requestId}",
      methods: ["GET", "PATCH", "PUT", "DELETE"]
    },
    usersIndex: {
      pathTemplate: "/api/admin/users",
      methods: ["GET", "POST"]
    },
    usersApproved: {
      pathTemplate: "/api/admin/users/approved",
      methods: ["GET"]
    },
    userById: {
      pathTemplate: "/api/admin/users/{userId}",
      methods: ["GET", "PUT", "DELETE"]
    },
    userRole: {
      pathTemplate: "/api/admin/users/{userId}/role",
      methods: ["PATCH"]
    },
    userPlan: {
      pathTemplate: "/api/admin/users/{userId}/plan",
      methods: ["PATCH"]
    },
    userEmail: {
      pathTemplate: "/api/admin/users/{userId}/email",
      methods: ["PATCH"]
    },
    userSettings: {
      pathTemplate: "/api/admin/users/{userId}/settings",
      methods: ["GET", "PUT"]
    },
    userMeteredUsageReset: {
      pathTemplate: "/api/admin/users/{userId}/metered-usage/reset",
      methods: ["POST"]
    },
    userResendCredentialInvite: {
      pathTemplate: "/api/admin/users/{userId}/resend-credential-invite",
      methods: ["POST"]
    },
    tasksIndex: {
      pathTemplate: "/api/admin/tasks",
      methods: ["GET", "POST"]
    },
    tasksById: {
      pathTemplate: "/api/admin/tasks/{taskId}",
      methods: ["PATCH", "DELETE"]
    },
    tasksRun: {
      pathTemplate: "/api/admin/tasks/{taskId}/run",
      methods: ["POST"]
    },
    taskRuns: {
      pathTemplate: "/api/admin/task-runs",
      methods: ["GET"]
    },
    schedulerTick: {
      pathTemplate: "/api/admin/scheduler/tick",
      methods: ["POST"]
    },
    deployNoteConfigsIndex: {
      pathTemplate: "/api/admin/deploy-note-configs",
      methods: ["GET", "POST"]
    },
    deployNoteConfigById: {
      pathTemplate: "/api/admin/deploy-note-configs/{configId}",
      methods: ["GET", "PUT", "DELETE"]
    },
    deliveryChannelsIndex: {
      pathTemplate: "/api/admin/delivery-channels",
      methods: ["GET", "POST"]
    },
    deliveryChannelById: {
      pathTemplate: "/api/admin/delivery-channels/{channelId}",
      methods: ["GET", "PATCH", "DELETE"]
    },
    deliveryChannelTest: {
      pathTemplate: "/api/admin/delivery-channels/{channelId}/test",
      methods: ["POST"]
    },
    importBroker: {
      pathTemplate: "/api/admin/import/broker",
      methods: ["POST"]
    },
    adminPortfoliosIndex: {
      pathTemplate: "/api/admin/portfolios",
      methods: ["GET", "POST"]
    },
    adminPortfolioById: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}",
      methods: ["GET", "PATCH", "DELETE"]
    },
    portfolioAccountsIndex: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/accounts",
      methods: ["GET", "POST"]
    },
    portfolioAccountById: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}",
      methods: ["PATCH", "DELETE"]
    },
    portfolioWatchlist: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/watchlist",
      methods: ["GET", "PATCH"]
    },
    portfolioAccountPositions: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions",
      methods: ["GET", "POST"]
    },
    portfolioAccountPositionById: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions/{positionId}",
      methods: ["DELETE"]
    },
    portfolioRecommendationsIndex: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/recommendations",
      methods: ["GET", "POST"]
    },
    portfolioRecommendationById: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}",
      methods: ["PATCH", "DELETE"]
    },
    portfolioAlertsIndex: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/alerts",
      methods: ["GET", "POST"]
    },
    portfolioAlertById: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/alerts/{alertId}",
      methods: ["PATCH", "DELETE"]
    },
    portfolioDeliveryChannelsIndex: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/delivery-channels",
      methods: ["GET", "POST"]
    },
    portfolioDeliveryChannelById: {
      pathTemplate: "/api/admin/portfolios/{portfolioId}/delivery-channels/{channelId}",
      methods: ["PATCH", "DELETE"]
    }
  },
  rag: {
    files: {
      pathTemplate: "/api/rag/files",
      methods: ["GET", "POST"]
    },
    fileReadiness: {
      pathTemplate: "/api/rag/files/{fileId}/readiness",
      methods: ["GET"]
    }
  },
  accessRequests: {
    self: {
      pathTemplate: "/api/access-requests",
      methods: ["POST"]
    }
  },
  personas: {
    index: {
      pathTemplate: "/api/personas",
      methods: ["GET", "POST"]
    },
    byId: {
      pathTemplate: "/api/personas/{personaId}",
      methods: ["GET", "PUT", "DELETE"]
    }
  }
} as const satisfies Record<string, Record<string, BffRouteDefinition>>;

export type AtxfinanceBackendBff = {
  getOrigin(): string | undefined;
  proxyRequest(request: Request): Promise<Response | null>;
};

function normalizeBffOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/** Set after first warn — avoid log spam when every request would self-proxy. */
let bffSelfOriginWarned = false;

/**
 * When `ATXFINANCE_BACKEND_ORIGIN` equals the incoming request's public origin, proxying would make Next
 * `fetch` itself (429, empty/wrong data). Refuse and let handlers fall back to Next + Mongo where supported.
 */
export function isBackendOriginSameAsRequestOrigin(request: Request, backendOrigin: string): boolean {
  try {
    return normalizeBffOrigin(new URL(request.url).origin) === normalizeBffOrigin(backendOrigin);
  } catch {
    return false;
  }
}

async function proxyRequestWithOrigin(
  request: Request,
  base: string | undefined
): Promise<Response | null> {
  if (!base) {
    return null;
  }
  if (isBackendOriginSameAsRequestOrigin(request, base)) {
    if (!bffSelfOriginWarned) {
      bffSelfOriginWarned = true;
      console.warn(
        "[bff] ATXFINANCE_BACKEND_ORIGIN matches this app host — refusing self-proxy. " +
          "Use the Spring Cloud Run HTTPS URL (second service), not the Next app URL (e.g. not the same as PROD_BASE_URL)."
      );
    }
    return null;
  }
  const u = new URL(request.url);
  const target = `${base}${u.pathname}${u.search}`;
  const headers = new Headers();
  headers.set("X-Forwarded-Host", u.host);
  headers.set("X-Forwarded-Proto", u.protocol.replace(":", ""));
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    headers.set("idempotency-key", idempotencyKey);
  }
  const correlationId = request.headers.get("x-correlation-id");
  if (correlationId) {
    headers.set("x-correlation-id", correlationId);
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual"
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  return fetch(target, init);
}

/**
 * Injectable BFF client: same-origin Next routes delegate to Spring when `resolveOrigin()` returns a base URL.
 */
export function createAtxfinanceBackendBff(
  resolveOrigin: () => string | undefined = getAtxfinanceBackendOrigin
): AtxfinanceBackendBff {
  return {
    getOrigin: resolveOrigin,
    proxyRequest(request: Request) {
      return proxyRequestWithOrigin(request, resolveOrigin());
    }
  };
}

const defaultBff = createAtxfinanceBackendBff();

/**
 * When `ATXFINANCE_BACKEND_ORIGIN` is set, forward the incoming request to Spring (same path + query).
 * Browser stays same-origin on Next; session cookie is forwarded. No CORS on the backend for this path.
 *
 * **Streaming:** For `text/event-stream` or other chunked bodies, return this `Response` directly from the Route Handler
 * without reading `response.text()` / `response.json()` so the client receives chunks as the backend emits them.
 */
export async function proxyRequestToBackend(request: Request): Promise<Response | null> {
  return defaultBff.proxyRequest(request);
}

/** Cancel body of a proxied response when falling back to Next-local handling (avoid connection leaks). */
export function releaseUnusedProxyResponse(res: Response): void {
  try {
    void res.body?.cancel?.();
  } catch {
    /* ignore */
  }
}

function isLoopbackBackendOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function isDevLikeNodeEnv(): boolean {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  return nodeEnv === "development" || nodeEnv === "test";
}

/**
 * Spring BFF gate for admin users, app-user portfolios, strategy-options, admin access-requests, etc.
 *
 * - **`ATXFINANCE_BACKEND_ORIGIN` unset:** never proxy (Next + Mongo).
 * - **Loopback origin + `NODE_ENV` `development` or `test`:** never proxy (local Next uses the same Mongo as auth).
 * - **Otherwise:** proxy when origin is set (staging/prod JVM URL — must not be the Next app’s own public URL).
 *
 * No separate `ATXFINANCE_BACKEND_PROXY_*` env vars — disable BFF by unsetting **`ATXFINANCE_BACKEND_ORIGIN`** or using
 * loopback + dev above. For local JVM on `127.0.0.1:8080`, run a **production** Next build/serve or use a non-loopback
 * host in `ORIGIN` (e.g. LAN IP) if you need BFF from `next dev`.
 */
export function shouldProxyAdminUsersToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  if (isDevLikeNodeEnv() && isLoopbackBackendOrigin(origin)) {
    return false;
  }
  return true;
}

/**
 * Admin **GET** paths that must stay on Next + Mongo when BFF is on (Platform / compliance / directory UIs).
 * Spring may lack the route (404) or a narrower contract than Next (extra query enums, joins, rate limits).
 */
const ADMIN_USERS_BFF_NEXT_ONLY_GET_PATHS = new Set([
  "/api/admin/tenants",
  "/api/admin/users",
  /** No `AdminLoginAuditController` on Spring — proxied → 404. */
  "/api/admin/login-audit",
  /**
   * Next allows **`entityType=admin_portfolio`**; Spring `AdminAuditController` historically omitted it → 400.
   * Keep audit list + rate limits on Next for one contract.
   */
  "/api/admin/audit"
]);

/**
 * When BFF is on, some admin **GET**s must stay on Next + Mongo:
 * - **`/api/admin/tenants`** — not implemented on Spring (proxied → 404); tenant create remains Next-only.
 * - **`/api/admin/users`** — Next enriches with **`tenantMemberships`**; Spring `listUsers` does not.
 * - **`/api/admin/login-audit`** — not implemented on Spring.
 * - **`/api/admin/audit`** — Next **`entityType`** / rate-limit contract must match the explorer UI.
 */
export function shouldSkipAdminUsersBffProxyForRequest(request: Request): boolean {
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method.toUpperCase() !== "GET") {
      return false;
    }
    return ADMIN_USERS_BFF_NEXT_ONLY_GET_PATHS.has(path);
  } catch {
    return false;
  }
}

/**
 * Mongo-only admin user subresource POSTs (Spring BFF must not absorb these).
 * - Metered usage reset
 * - Credential invite resend (desk SMTP + Mongo token)
 */
export function shouldSkipAdminUsersBffProxyForMongoOnlyUserSubresourcePosts(request: Request): boolean {
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method.toUpperCase() !== "POST") {
      return false;
    }
    return /^\/api\/admin\/users\/[^/]+\/(?:metered-usage\/reset|resend-credential-invite)$/.test(path);
  } catch {
    return false;
  }
}

/**
 * Admin **`GET /api/admin/portfolios/{id}/watchlist`** — stay on **Next + Mongo** (desk fields, Yahoo quotes,
 * `rowStatus` parity). **`PATCH`** for the same path forwards via {@link proxyAdminUsersRequestToBackend} when the
 * admin BFF gate is on (Spring `AdminPortfolioWatchlistController`).
 */
export function shouldSkipAdminUsersBffProxyForAdminPortfolioWatchlistGet(request: Request): boolean {
  try {
    if (request.method.toUpperCase() !== "GET") {
      return false;
    }
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    return /^\/api\/admin\/portfolios\/[^/]+\/watchlist$/.test(path);
  } catch {
    return false;
  }
}

/** Like {@link proxyRequestToBackend} for admin user routes; returns `null` when proxy is disabled. */
export async function proxyAdminUsersRequestToBackend(request: Request): Promise<Response | null> {
  if (!shouldProxyAdminUsersToBackend()) {
    return null;
  }
  if (shouldSkipAdminUsersBffProxyForAdminPortfolioWatchlistGet(request)) {
    return null;
  }
  if (shouldSkipAdminUsersBffProxyForRequest(request)) {
    return null;
  }
  if (shouldSkipAdminUsersBffProxyForMongoOnlyUserSubresourcePosts(request)) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * App-user session data plane (portfolios, positions, recommendations, strategy-jobs, self access-request,
 * user-feedback): same gate as {@link shouldProxyAdminUsersToBackend}.
 */
export function shouldProxyPortfolioRequestsToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/**
 * App-user **`PATCH /api/portfolios/{portfolioId}/watchlist`** — forward to Spring when the portfolio BFF gate is on.
 *
 * **`GET`** / **`POST`** for that path stay on Next (Yahoo quotes, `watchlistId` picker, multi-watchlist create, and
 * read-time desk enrichments). **`GET`/`DELETE …/alerts`** stay on Next — see {@link isAppUserPortfolioAlertsPath}.
 */
export function shouldProxyAppUserPortfolioWatchlistPatchToBackend(): boolean {
  return shouldProxyPortfolioRequestsToBackend();
}

/** @deprecated Use {@link shouldProxyAppUserPortfolioWatchlistPatchToBackend}; GET/POST watchlist stay Next-only. */
export function shouldProxyAppUserPortfolioWatchlistToBackend(): boolean {
  return false;
}

function isAppUserPortfolioWatchlistPath(pathname: string): boolean {
  return /^\/api\/portfolios\/[^/]+\/watchlist\/?$/.test(pathname);
}

function isAppUserPortfolioAlertsPath(pathname: string): boolean {
  return /^\/api\/portfolios\/[^/]+\/alerts\/?$/.test(pathname);
}

/** Spring BFF for {@link shouldProxyPortfolioRequestsToBackend} routes; `null` → Next Mongo handlers. */
export async function proxyPortfolioRequestToBackend(request: Request): Promise<Response | null> {
  if (!shouldProxyPortfolioRequestsToBackend()) {
    return null;
  }
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (isAppUserPortfolioWatchlistPath(pathname)) {
    if (request.method.toUpperCase() !== "PATCH") {
      return null;
    }
    if (!shouldProxyAppUserPortfolioWatchlistPatchToBackend()) {
      return null;
    }
  }
  /** Alerts list + bulk delete stay on Next (Mongo); Spring parity not required for app-user bulk clear / CSV flow. */
  if (isAppUserPortfolioAlertsPath(pathname)) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * User-facing hint when `/api/strategy-jobs*` cannot reach Spring (orchestrator is JVM-only; Next has no Mongo fallback).
 */
export function getStrategyJobsBffUnavailableMessage(): string {
  if (!getAtxfinanceBackendOrigin()) {
    return "Strategy orchestrator runs in atxfinance-backend (Spring). Set ATXFINANCE_BACKEND_ORIGIN to the JVM base URL (e.g. http://127.0.0.1:8080).";
  }
  return "Strategy jobs BFF is off: with ATXFINANCE_BACKEND_ORIGIN on localhost/127.0.0.1, Next skips proxy in development/test so local Mongo matches auth. Use a production Next run, a non-loopback ORIGIN, or a remote backend URL to hit Spring from this app.";
}

/**
 * **`/api/admin/tasks*`**, **`/api/admin/task-runs`**, **`/api/admin/scheduler/tick`** — forward to Spring when
 * {@link shouldProxyAdminUsersToBackend} is true (same BFF gate as admin portfolios, personas, access-requests).
 * Next route handlers remain the fallback when the gate is off (unset origin or loopback + dev/test).
 */
export function shouldProxyAdminScheduledTasksToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/** Admin scheduled-task BFF → Spring; returns `null` when proxy disabled. */
export async function proxyAdminScheduledTasksRequestToBackend(
  request: Request
): Promise<Response | null> {
  if (!shouldProxyAdminScheduledTasksToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * `/api/strategy-options*` — same BFF gate as {@link shouldProxyAdminUsersToBackend}.
 */
export function shouldProxyStrategyOptionsToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/** Strategy-options BFF → Spring; returns `null` when proxy disabled. */
export async function proxyStrategyOptionsRequestToBackend(
  request: Request
): Promise<Response | null> {
  if (!shouldProxyStrategyOptionsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * `/api/admin/access-requests*` — same BFF gate as {@link shouldProxyAdminUsersToBackend}.
 */
export function shouldProxyAdminAccessRequestsToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/** Admin **`/api/admin/access-requests*`** — forward to Spring when {@link shouldProxyAdminAccessRequestsToBackend} is on. */
export async function proxyAdminAccessRequestsRequestToBackend(
  request: Request
): Promise<Response | null> {
  if (!shouldProxyAdminAccessRequestsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * Tenant + portfolio-nested **`/api/admin/delivery-channels*`** — forward to Spring when
 * {@link shouldProxyAdminUsersToBackend} is on (same gate as other admin BFF routes).
 */
export function shouldProxyAdminDeliveryChannelsToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/** Admin delivery-channels BFF → Spring; returns `null` when proxy disabled. */
export async function proxyAdminDeliveryChannelsRequestToBackend(
  request: Request
): Promise<Response | null> {
  if (!shouldProxyAdminDeliveryChannelsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * **`/api/personas`** and **`/api/personas/{personaId}`** (GET/POST/PUT/DELETE) — forward to Spring when
 * {@link shouldProxyAdminUsersToBackend} is true (`ATXFINANCE_BACKEND_ORIGIN` set; loopback + dev/test skips proxy).
 *
 * Next-only persona routes (publish, archive, versions, collections, sync-from-xai, etc.) do not call this helper.
 */
export function shouldProxyPersonasRequestsToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/** Personas BFF → Spring; returns `null` unless {@link shouldProxyPersonasRequestsToBackend} is true. */
export async function proxyPersonasRequestToBackend(request: Request): Promise<Response | null> {
  if (!shouldProxyPersonasRequestsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}
