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
  userFeedback: {
    post: {
      pathTemplate: "/api/user-feedback",
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

async function proxyRequestWithOrigin(
  request: Request,
  base: string | undefined
): Promise<Response | null> {
  if (!base) {
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

/**
 * When `ATXFINANCE_BACKEND_ORIGIN` is set, `/api/admin/users*` may proxy to Spring.
 *
 * - **Remote Spring (non-loopback host):** proxy is **on** unless `ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=false`.
 * - **Loopback (`localhost` / `127.0.0.1`) + `development` or `test`:** proxy is **off** by default so Manage Users
 *   uses the same Mongo as Next auth (avoids an empty table when the JVM sees a different DB).
 * - **Force local JVM:** set `ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=true`.
 */
export function shouldProxyAdminUsersToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  const v = process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  if (v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const devLike = nodeEnv === "development" || nodeEnv === "test";
  if (devLike && isLoopbackBackendOrigin(origin)) {
    return false;
  }
  return true;
}

/** Like {@link proxyRequestToBackend} for admin user routes; returns `null` when proxy is disabled. */
export async function proxyAdminUsersRequestToBackend(request: Request): Promise<Response | null> {
  if (!shouldProxyAdminUsersToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * App-user session data plane (portfolios, positions, recommendations, strategy-jobs, self access-request,
 * user-feedback): same gate as {@link shouldProxyAdminUsersToBackend} — **`ATXFINANCE_BACKEND_PROXY_ADMIN_USERS`**
 * (loopback + dev skips Spring by default). No portfolio-only env var.
 */
export function shouldProxyPortfolioRequestsToBackend(): boolean {
  return shouldProxyAdminUsersToBackend();
}

/** Spring BFF for {@link shouldProxyPortfolioRequestsToBackend} routes; `null` → Next Mongo handlers. */
export async function proxyPortfolioRequestToBackend(request: Request): Promise<Response | null> {
  if (!shouldProxyPortfolioRequestsToBackend()) {
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
  return "Strategy jobs proxy is off. For Spring on localhost, set ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=true so Next forwards /api/strategy-jobs to the JVM (see .env.example).";
}

/**
 * `/api/admin/tasks*`, `/api/admin/task-runs`, `/api/admin/scheduler/tick`.
 *
 * - **No origin:** never proxy.
 * - **Explicit** `ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS` (`true`/`false`/…): wins.
 * - **Unset:** follows {@link shouldProxyAdminUsersToBackend} so Admin → Tasks stays aligned with Manage Users
 *   (avoids tasks on Spring while other admin routes use Next, or the reverse).
 */
export function shouldProxyAdminScheduledTasksToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  const v = process.env.ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  if (v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
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
 * `/api/strategy-options*` (chain + expirations) — allows xOptions to stay Next-local when
 * backend strategy endpoints are unavailable or intentionally split.
 *
 * - **Remote Spring:** proxy on unless `ATXFINANCE_BACKEND_PROXY_STRATEGY_OPTIONS=false`.
 * - **Loopback + development|test:** proxy **off** unless `ATXFINANCE_BACKEND_PROXY_STRATEGY_OPTIONS=true`.
 */
export function shouldProxyStrategyOptionsToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  const v = process.env.ATXFINANCE_BACKEND_PROXY_STRATEGY_OPTIONS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  if (v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const devLike = nodeEnv === "development" || nodeEnv === "test";
  if (devLike && isLoopbackBackendOrigin(origin)) {
    return false;
  }
  return true;
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
 * `/api/admin/access-requests*`. No origin → never proxy. Explicit
 * `ATXFINANCE_BACKEND_PROXY_ACCESS_REQUESTS` wins; **unset** → {@link shouldProxyAdminUsersToBackend}.
 */
export function shouldProxyAdminAccessRequestsToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  const v = process.env.ATXFINANCE_BACKEND_PROXY_ACCESS_REQUESTS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  if (v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
  return shouldProxyAdminUsersToBackend();
}

/** Admin access-requests BFF → Spring; returns `null` when proxy disabled. */
export async function proxyAdminAccessRequestsRequestToBackend(
  request: Request
): Promise<Response | null> {
  if (!shouldProxyAdminAccessRequestsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * Tenant-level `/api/admin/delivery-channels*` (portfolio-nested uses the same helper). No origin → never proxy.
 * Explicit `ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS` wins; **unset** → {@link shouldProxyAdminUsersToBackend}.
 */
export function shouldProxyAdminDeliveryChannelsToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  const v = process.env.ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  if (v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
  return shouldProxyAdminUsersToBackend();
}

/** Tenant admin delivery-channels BFF → Spring; returns `null` when proxy disabled. */
export async function proxyAdminDeliveryChannelsRequestToBackend(
  request: Request
): Promise<Response | null> {
  if (!shouldProxyAdminDeliveryChannelsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}

/**
 * `/api/personas*` — **opt-in** proxy to Spring.
 *
 * Default is **off** so Admin Hub persona list / CRUD / seed / xAI sync use the same Mongo as Next. When origin is set,
 * Spring would otherwise answer with a different DB (empty list, broken tenant default + user assignment). Set
 * `ATXFINANCE_BACKEND_PROXY_PERSONAS=true` only when the JVM is wired to the same persona store.
 */
export function shouldProxyPersonasRequestsToBackend(): boolean {
  const origin = getAtxfinanceBackendOrigin();
  if (!origin) {
    return false;
  }
  const v = process.env.ATXFINANCE_BACKEND_PROXY_PERSONAS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Personas BFF → Spring; returns `null` unless {@link shouldProxyPersonasRequestsToBackend} is true. */
export async function proxyPersonasRequestToBackend(request: Request): Promise<Response | null> {
  if (!shouldProxyPersonasRequestsToBackend()) {
    return null;
  }
  return proxyRequestToBackend(request);
}
