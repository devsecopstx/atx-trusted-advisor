import { APP_VERSION } from "@/lib/app-version";
import { ATX_CLUSTER_OPENAPI_SCHEMAS } from "@/lib/openapi/cluster-schemas";
import {
    CURRENT_STATE_COMPONENT_SCHEMAS,
    getCurrentStateOperationOverride
} from "@/lib/openapi/current-state-overrides";
import type {
    HttpMethod,
    OpenApiDocument,
    OpenApiOperation,
    OpenApiParameter,
    OpenApiPathItem,
    OpenApiResponse
} from "@/lib/openapi/types";

type AuthScope = "public" | "session" | "admin";
type RouteMethod = Uppercase<HttpMethod>;

type RouteOperation = {
  method: RouteMethod;
  auth: AuthScope;
  summary?: string;
  deprecated?: boolean;
  hasRequestBody?: boolean;
};

type RouteDefinition = {
  path: string;
  operations: RouteOperation[];
  tag?: string;
};

export const CURRENT_STATE_ROUTES: RouteDefinition[] = [
  { path: "/api/health", operations: [{ method: "GET", auth: "public" }] },
  { path: "/api/openapi", operations: [{ method: "GET", auth: "public" }], tag: "docs" },
  { path: "/api/auth/me", operations: [{ method: "GET", auth: "public" }], tag: "auth" },
  {
    path: "/api/auth/logout",
    operations: [{ method: "POST", auth: "public" }],
    tag: "auth"
  },
  {
    path: "/api/auth/google/callback",
    operations: [{ method: "GET", auth: "public" }],
    tag: "auth"
  },
  { path: "/api/auth/google/login", operations: [{ method: "GET", auth: "public" }], tag: "auth" },
  {
    path: "/api/auth/link-email",
    operations: [{ method: "POST", auth: "public", hasRequestBody: true }],
    tag: "auth"
  },
  { path: "/api/auth/x/login", operations: [{ method: "GET", auth: "public" }], tag: "auth" },
  {
    path: "/api/auth/x/callback",
    operations: [{ method: "GET", auth: "public" }],
    tag: "auth"
  },
  {
    path: "/api/access-requests",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }]
  },
  {
    path: "/api/access-requests/public",
    operations: [{ method: "POST", auth: "public", hasRequestBody: true }],
    tag: "access-requests"
  },
  {
    path: "/api/app-user/find-options/context",
    operations: [{ method: "GET", auth: "session" }],
    tag: "find-options"
  },
  {
    path: "/api/app-user/find-options/symbol-snapshot",
    operations: [{ method: "GET", auth: "session" }],
    tag: "find-options"
  },
  {
    path: "/api/app-user/find-options/top-holdings",
    operations: [{ method: "GET", auth: "session" }],
    tag: "find-options"
  },
  {
    path: "/api/app-user/find-options/watchlist-hot",
    operations: [{ method: "GET", auth: "session" }],
    tag: "find-options"
  },
  {
    path: "/api/app-user/symbol-chart",
    operations: [{ method: "GET", auth: "session" }],
    tag: "find-options"
  },
  {
    path: "/api/app-user/xoptions/entitlements",
    operations: [{ method: "GET", auth: "session" }],
    tag: "xoptions"
  },
  {
    path: "/api/user-feedback",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "user-feedback"
  },
  {
    path: "/api/user/workspace-portfolio",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "user"
  },
  {
    path: "/api/billing/checkout-session",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "billing"
  },
  {
    path: "/api/market/symbol-quotes",
    operations: [{ method: "GET", auth: "session" }],
    tag: "market"
  },
  {
    path: "/api/market/workspace-pulse",
    operations: [{ method: "GET", auth: "session" }],
    tag: "market"
  },
  {
    path: "/api/recommendations",
    operations: [
      { method: "GET", auth: "session" },
      { method: "POST", auth: "session", hasRequestBody: true }
    ],
    tag: "recommendations"
  },
  {
    path: "/api/recommendations/{recommendationId}",
    operations: [{ method: "GET", auth: "session" }],
    tag: "recommendations"
  },
  {
    path: "/api/admin/access-requests",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-access-requests"
  },
  {
    path: "/api/admin/access-requests/{requestId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "PUT", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-access-requests"
  },
  { path: "/api/admin/audit", operations: [{ method: "GET", auth: "admin" }], tag: "admin-audit" },
  {
    path: "/api/admin/login-audit",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "admin-audit"
  },
  {
    path: "/api/admin/bootstrap-status",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "admin-system"
  },
  {
    path: "/api/admin/scheduler/tick",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "admin-system"
  },
  {
    path: "/api/admin/task-runs",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "admin-tasks"
  },
  {
    path: "/api/admin/tasks",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-tasks"
  },
  {
    path: "/api/admin/tasks/{taskId}",
    operations: [
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-tasks"
  },
  {
    path: "/api/admin/deploy-note-configs",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/deploy-note-configs/{configId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PUT", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/delivery-channels",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/delivery-channels/{channelId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/delivery-channels/{channelId}/test",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "admin-system"
  },
  {
    path: "/api/admin/import/broker",
    operations: [{ method: "POST", auth: "admin", hasRequestBody: true }],
    tag: "admin-system"
  },
  {
    path: "/api/admin/brokers",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/brokers/{brokerId}",
    operations: [
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/options-strategy-preferences",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "admin-system"
  },
  {
    path: "/api/admin/options-strategy-preferences/{preferenceId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/options-strategy",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/options-strategy/{strategyId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-system"
  },
  {
    path: "/api/admin/portfolios",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/accounts",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}",
    operations: [
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions/{positionId}",
    operations: [{ method: "DELETE", auth: "admin" }],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/alerts",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/alerts/{alertId}",
    operations: [
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/delivery-channels",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/delivery-channels/{channelId}",
    operations: [
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/recommendations",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}",
    operations: [
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/portfolios/{portfolioId}/watchlist",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-portfolios"
  },
  {
    path: "/api/admin/tasks/{taskId}/run",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "admin-tasks"
  },
  {
    path: "/api/admin/tenants/{tenantId}/portfolio-scoring-defaults",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-tenants"
  },
  {
    path: "/api/admin/tenants/{tenantId}/workspace-limits",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-tenants"
  },
  {
    path: "/api/admin/backoffice/core-users",
    operations: [{ method: "POST", auth: "admin", hasRequestBody: true }],
    tag: "admin-backoffice"
  },
  {
    path: "/api/admin/users",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-users"
  },
  {
    path: "/api/admin/users/approved",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "admin-users"
  },
  {
    path: "/api/admin/users/{userId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PUT", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-users"
  },
  {
    path: "/api/admin/users/{userId}/email",
    operations: [{ method: "PATCH", auth: "admin", hasRequestBody: true }],
    tag: "admin-users"
  },
  {
    path: "/api/admin/users/{userId}/plan",
    operations: [{ method: "PATCH", auth: "admin", hasRequestBody: true }],
    tag: "admin-users"
  },
  {
    path: "/api/admin/users/{userId}/role",
    operations: [{ method: "PATCH", auth: "admin", hasRequestBody: true }],
    tag: "admin-users"
  },
  {
    path: "/api/admin/users/{userId}/settings",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PUT", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-users"
  },
  {
    path: "/api/admin/xchat/settings",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-xchat"
  },
  {
    path: "/api/personas",
    operations: [
      { method: "GET", auth: "session", summary: "List personas visible to current user" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "personas"
  },
  {
    path: "/api/personas/sync-from-xai",
    operations: [
      {
        method: "POST",
        auth: "admin",
        hasRequestBody: true,
        summary: "Import persona YAML/MD from xAI xpersonas collection into Mongo (global admin)"
      }
    ],
    tag: "personas"
  },
  {
    path: "/api/personas/collections",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "personas"
  },
  {
    path: "/api/personas/collections/{collectionId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PUT", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/archive",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/collection/create",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/collection/link-files",
    operations: [{ method: "POST", auth: "admin", hasRequestBody: true }],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/publish",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/rollback",
    operations: [{ method: "POST", auth: "admin", hasRequestBody: true }],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/verify-collection",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "personas"
  },
  {
    path: "/api/personas/{personaId}/versions",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "personas"
  },
  {
    path: "/api/import/broker",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "portfolios"
  },
  {
    path: "/api/import/broker/clean",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/default",
    operations: [
      { method: "GET", auth: "session" },
      { method: "POST", auth: "session" }
    ],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/current",
    operations: [{ method: "GET", auth: "session" }],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}",
    operations: [
      { method: "GET", auth: "session" },
      { method: "PATCH", auth: "session", hasRequestBody: true },
      { method: "DELETE", auth: "session" }
    ],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}/accounts",
    operations: [
      { method: "GET", auth: "session" },
      { method: "POST", auth: "session", hasRequestBody: true }
    ],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}/alerts",
    operations: [{ method: "GET", auth: "session" }],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}/recommendations",
    operations: [
      { method: "GET", auth: "session" },
      { method: "POST", auth: "session", hasRequestBody: true }
    ],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}/watchlist",
    operations: [
      { method: "GET", auth: "session" },
      { method: "PATCH", auth: "session", hasRequestBody: true }
    ],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}/accounts/{accountId}",
    operations: [
      { method: "PATCH", auth: "session", hasRequestBody: true },
      { method: "DELETE", auth: "session" }
    ],
    tag: "portfolios"
  },
  {
    path: "/api/positions",
    operations: [
      { method: "GET", auth: "session" },
      { method: "POST", auth: "session", hasRequestBody: true }
    ],
    tag: "positions"
  },
  {
    path: "/api/positions/{positionId}",
    operations: [{ method: "DELETE", auth: "session" }],
    tag: "positions"
  },
  {
    path: "/api/strategy-options",
    operations: [{ method: "GET", auth: "session" }],
    tag: "strategy-options"
  },
  {
    path: "/api/strategy-options/expirations",
    operations: [{ method: "GET", auth: "session" }],
    tag: "strategy-options"
  },
  {
    path: "/api/strategy-jobs",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "strategy-jobs"
  },
  {
    path: "/api/strategy-jobs/{jobId}",
    operations: [{ method: "GET", auth: "session" }],
    tag: "strategy-jobs"
  },
  {
    path: "/api/strategy-jobs/{jobId}/turns",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "strategy-jobs"
  },
  {
    path: "/api/rag/files",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "rag"
  },
  {
    path: "/api/rag/files/{fileId}/readiness",
    operations: [{ method: "GET", auth: "admin" }],
    tag: "rag"
  },
  {
    path: "/api/xchat/ask",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "xchat"
  },
  {
    path: "/api/xchat/collections",
    operations: [{ method: "GET", auth: "session" }],
    tag: "xchat"
  },
  {
    path: "/api/xchat/history",
    operations: [{ method: "GET", auth: "session" }],
    tag: "xchat"
  },
  {
    path: "/api/xchat/history/stats",
    operations: [{ method: "GET", auth: "session" }],
    tag: "xchat"
  },
  {
    path: "/api/xchat/history/sync-turn",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true, deprecated: true }],
    tag: "xchat"
  },
  {
    path: "/api/xchat/batch",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "xchat"
  },
  {
    path: "/api/xchat/batch/{batchId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin" }
    ],
    tag: "xchat"
  }
];

const TAG_DESCRIPTIONS: Record<string, string> = {
  docs: "OpenAPI / documentation meta endpoints.",
  health: "Health and runtime diagnostics endpoints.",
  auth: "Authentication and session management flows.",
  "access-requests": "User-submitted access and onboarding requests.",
  billing: "Stripe Checkout session creation for ATX subscription plans (app_user session).",
  recommendations:
    "App_user-scoped recommendations; optional Pub/Sub events for downstream agent workers (see DEVELOPMENT.md).",
  "admin-access-requests": "Global admin APIs for listing, creating, reviewing, and deleting access requests.",
  "user-feedback": "Authenticated app_user feedback submission (Slack integration when configured).",
  "admin-audit": "Admin audit and activity timeline endpoints.",
  "admin-system": "Admin system-level diagnostics and scheduled task controls.",
  "admin-tasks": "Admin task catalog and task-run controls.",
  "admin-users": "Admin management of user records, roles, plans, and settings.",
  "admin-xchat": "Platform xChat defaults (e.g. default published persona for app users).",
  personas: "Persona and collection lifecycle APIs.",
  portfolios:
    "Default portfolio, account, watchlist, and app-user broker holdings import (`POST /api/import/broker`) for signed-in users.",
  positions: "Position capture and persistence APIs.",
  "strategy-options":
    "Option expirations and chain (Yahoo + synthetic fallback) for xStrategyBuilder; aligned with xfinance-strategy GET /api/options.",
  "strategy-jobs":
    "xChat Hardcore / Phase 1 multi-agent strategy orchestrator (Mongo + Spring): slot collection and job status. See atx-docs/xchat/atx-multi-agent.md.",
  rag: "Mongo-backed scoped RAG file list/upload; xAI collection inventory is GET /api/personas/collections.",
  xchat: "xChat sync and async ask/batch workflows."
};

function inferTag(path: string): string {
  if (path === "/api/health") {
    return "health";
  }

  const segments = path.split("/").filter(Boolean).slice(1);
  if (segments[0] === "admin") {
    const domain = segments[1] ?? "system";
    return `admin-${domain}`;
  }

  return segments[0] ?? "api";
}

function inferSummary(method: RouteMethod, path: string): string {
  const resource = path
    .replace("/api/", "")
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replaceAll("/", " ")
    .trim();

  const actionMap: Record<RouteMethod, string> = {
    GET: "Read",
    POST: "Execute",
    PUT: "Replace",
    PATCH: "Update",
    DELETE: "Delete",
    OPTIONS: "Inspect options for",
    HEAD: "Read metadata for"
  };

  return `${actionMap[method]} ${resource}`.trim();
}

/**
 * Stable operationIds for codegen: `atx_<resource>_<action>` (resource path snake, then HTTP verb role).
 * Examples: `atx_health_get`, `atx_admin_access_requests_list`, `atx_portfolio_get`, `atx_personas_create`.
 */
function toOperationId(method: RouteMethod, path: string): string {
  const hasPathParam = /{[^}]+}/.test(path);
  const action = methodToAction(method, path, hasPathParam);
  const usePlural = shouldUsePluralResourceSegment(action, path);
  const resource = pathToResource(path, usePlural);
  return `atx_${resource}_${action}`;
}

function shouldUsePluralResourceSegment(action: string, path: string): boolean {
  if (action === "list") {
    return true;
  }
  if (action !== "create") {
    return false;
  }
  const stripped = path.replace("/api/", "").replace(/\{[^}]+}/g, "");
  const last =
    stripped
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/-/g, "_") ?? "";
  if (!last) {
    return false;
  }
  return toSingular(last) !== last;
}

function methodToAction(method: RouteMethod, path: string, hasPathParam: boolean): string {
  switch (method) {
    case "GET":
      if (hasPathParam) {
        return "get";
      }
      {
        const last = path.split("/").filter(Boolean).pop()?.replace(/-/g, "_") ?? "";
        const sing = toSingular(last);
        return sing !== last ? "list" : "get";
      }
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    case "OPTIONS":
      return "options";
    case "HEAD":
      return "head";
    default:
      return String(method).toLowerCase();
  }
}

function pathToResource(path: string, usePlural: boolean): string {
  const p = path.replace("/api/", "").replace(/\{[^}]+}/g, "");
  const parts = p.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "resource";
  const normalized = last.replace(/-/g, "_");
  const singular = toSingular(normalized);
  const plural = toPlural(singular);
  const base = parts.length > 1 ? parts.slice(0, -1).map((s) => s.replace(/-/g, "_")) : [];
  const resource = usePlural ? [...base, plural] : [...base, singular];
  return resource.join("_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "resource";
}

function toSingular(word: string): string {
  const irregular: Record<string, string> = {
    access_requests: "access_request",
    recommendations: "recommendation",
    personas: "persona",
    portfolios: "portfolio",
    positions: "position",
    collections: "collection",
    tasks: "task",
    users: "user",
    files: "file",
    configs: "config"
  };
  if (irregular[word]) return irregular[word];
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes"))
    return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function toPlural(singular: string): string {
  const irregular: Record<string, string> = {
    access_request: "access_requests",
    persona: "personas",
    portfolio: "portfolios",
    position: "positions",
    collection: "collections",
    task: "tasks",
    user: "users",
    file: "files",
    config: "configs"
  };
  if (irregular[singular]) return irregular[singular];
  if (singular.endsWith("y") && !/^[aeiou]/.test(singular.slice(-2, -1)))
    return singular.slice(0, -1) + "ies";
  if (singular.endsWith("s") || singular.endsWith("x") || singular.endsWith("z"))
    return singular + "es";
  return singular + "s";
}

function extractPathParameters(path: string): OpenApiParameter[] {
  const matches = path.matchAll(/{([^/{}]+)}/g);
  const params: OpenApiParameter[] = [];

  for (const match of matches) {
    params.push({
      name: match[1],
      in: "path",
      required: true,
      description: `Path parameter: ${match[1]}`,
      schema: { type: "string" }
    });
  }

  return params;
}

const SESSION_401_EXAMPLES = {
  session_required: {
    summary: "No valid session (session-scoped route)",
    description:
      "Typical when the caller is unauthenticated or `xf_core_session` is missing/expired. Exact `error` strings vary by route.",
    value: { error: "Unauthorized" }
  }
} as const;

const ADMIN_403_EXAMPLES = {
  admin_role_required: {
    summary: "Authenticated but not allowed (admin route)",
    description:
      "Session cookie accepted; caller lacks `global_admin` or the route-specific admin gate. Exact `error` strings vary.",
    value: { error: "Forbidden" }
  }
} as const;

function successSchemaRefForAuth(auth: AuthScope): string {
  if (auth === "public") {
    return "#/components/schemas/AtxPublicJsonSuccess";
  }
  if (auth === "admin") {
    return "#/components/schemas/AtxAdminJsonSuccess";
  }
  return "#/components/schemas/AtxSessionJsonSuccess";
}

function buildResponses(auth: AuthScope): Record<string, OpenApiResponse> {
  const responses: Record<string, OpenApiResponse> = {
    "200": {
      description: "Successful response.",
      content: {
        "application/json": {
          schema: { $ref: successSchemaRefForAuth(auth) }
        }
      }
    },
    "400": {
      description: "Validation or request-shape error.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" }
        }
      }
    },
    "500": {
      description: "Unhandled server error.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" }
        }
      }
    }
  };

  if (auth !== "public") {
    responses["401"] = {
      description: "Missing or invalid session cookie.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
          examples: SESSION_401_EXAMPLES
        }
      }
    };
  }

  if (auth === "admin") {
    responses["403"] = {
      description: "Session is valid, but admin role is required.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
          examples: ADMIN_403_EXAMPLES
        }
      }
    };
  }

  return responses;
}

function buildOperation(path: string, op: RouteOperation, tag: string): OpenApiOperation {
  const pathParams = extractPathParameters(path);
  const methodHasBody = op.hasRequestBody ?? ["POST", "PUT", "PATCH"].includes(op.method);

  const baseOperation: OpenApiOperation = {
    operationId: toOperationId(op.method, path),
    summary: op.summary ?? inferSummary(op.method, path),
    description:
      "Current-state operation captured from route handlers. Payload schemas are intentionally broad for architecture review and should be tightened before external publication.",
    tags: [tag],
    parameters: pathParams.length > 0 ? pathParams : undefined,
    requestBody: methodHasBody
      ? {
          required: false,
          description:
            "Route accepts JSON payload. See route implementation for strict runtime validation details.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenericRequestBody" }
            }
          }
        }
      : undefined,
    deprecated: op.deprecated ?? false,
    responses: buildResponses(op.auth),
    security: op.auth === "public" ? undefined : [{ cookieAuth: [] }]
  };

  const operationOverride = getCurrentStateOperationOverride(op.method, path);

  if (!operationOverride) {
    return baseOperation;
  }

  return {
    ...baseOperation,
    ...operationOverride,
    parameters: operationOverride.parameters ?? baseOperation.parameters,
    requestBody: operationOverride.requestBody ?? baseOperation.requestBody,
    responses: operationOverride.responses ?? baseOperation.responses
  };
}

function buildPaths(): Record<string, OpenApiPathItem> {
  const paths: Record<string, OpenApiPathItem> = {};

  for (const route of CURRENT_STATE_ROUTES) {
    const tag = route.tag ?? inferTag(route.path);
    const pathItem: OpenApiPathItem = {};

    for (const op of route.operations) {
      const method = op.method.toLowerCase() as HttpMethod;
      pathItem[method] = buildOperation(route.path, op, tag);
    }

    paths[route.path] = pathItem;
  }

  return paths;
}

function collectTags(): Array<{ name: string; description?: string }> {
  const names = new Set<string>();

  for (const route of CURRENT_STATE_ROUTES) {
    names.add(route.tag ?? inferTag(route.path));
  }

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, description: TAG_DESCRIPTIONS[name] }));
}

export function buildCurrentStateOpenApi(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "atxFinance HTTP API — current-state inventory",
      version: APP_VERSION,
      description: [
        "Machine-generated inventory of Next.js `src/app/api` routes (auth scopes, methods).",
        "Use for architecture review and parity with Spring BFF migration — not a substitute for per-route request/response schemas yet.",
        "",
        "**Naming / review notes**",
        "- Tags use `kebab-case`; admin areas are grouped as `admin-*` by domain.",
        "- `user-feedback` is separate from `xchat` (user feedback was previously mis-tagged).",
        "- Prefer tag `admin-access-requests` over a generic “admin-access” label for `/api/admin/access-requests`.",
        "- Canonical product name in titles: **atxFinance** (camelCase).",
        "- **operationId** convention: `atx_<resource>_<action>` (snake_case resource path from `/api`, then `get` | `list` | `create` | `update` | `delete` | …).",
        "",
        "**Success schemas (route clusters)**",
        "- `AtxPublicJsonSuccess`, `AtxSessionJsonSuccess`, `AtxAdminJsonSuccess` replace the old `ApiSuccessPayload` placeholder; Zod mirrors live in `src/lib/openapi/cluster-schemas.ts`.",
        "- Session vs admin **401** / **403** responses include `examples` for codegen and doc tools (see built spec under `GET /api/openapi`)."
      ].join("\n")
    },
    servers: [
      { url: "https://staging.atx.fintech-advisor.ai", description: "Staging server" },
      { url: "https://atx.fintech-advisor.ai", description: "Production server" }
    ],
    tags: collectTags(),
    paths: buildPaths(),
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "xf_core_session",
          description: "Signed session cookie established by auth flow."
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", description: "Error identifier or message." }
          }
        },
        ApiSuccessPayload: {
          type: "object",
          additionalProperties: true,
          description:
            "Legacy alias for loosely documented successes; prefer `AtxPublicJsonSuccess` / `AtxSessionJsonSuccess` / `AtxAdminJsonSuccess`."
        },
        ...ATX_CLUSTER_OPENAPI_SCHEMAS,
        GenericRequestBody: {
          type: "object",
          additionalProperties: true,
          description:
            "Broad placeholder request body schema for architecture-level documentation."
        },
        ...CURRENT_STATE_COMPONENT_SCHEMAS
      }
    }
  };
}
