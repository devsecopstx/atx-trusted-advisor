import { APP_VERSION } from "@/lib/app-version";
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
    path: "/api/feedback",
    operations: [{ method: "POST", auth: "session", hasRequestBody: true }],
    tag: "xchat"
  },
  {
    path: "/api/admin/access-requests",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "POST", auth: "admin", hasRequestBody: true }
    ],
    tag: "admin-access"
  },
  {
    path: "/api/admin/access-requests/{requestId}",
    operations: [
      { method: "GET", auth: "admin" },
      { method: "PATCH", auth: "admin", hasRequestBody: true },
      { method: "PUT", auth: "admin", hasRequestBody: true },
      { method: "DELETE", auth: "admin" }
    ],
    tag: "admin-access"
  },
  { path: "/api/admin/audit", operations: [{ method: "GET", auth: "admin" }], tag: "admin-audit" },
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
    path: "/api/admin/import/broker",
    operations: [{ method: "POST", auth: "admin", hasRequestBody: true }],
    tag: "admin-system"
  },
  {
    path: "/api/admin/tasks/{taskId}/run",
    operations: [{ method: "POST", auth: "admin" }],
    tag: "admin-tasks"
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
    path: "/api/personas",
    operations: [
      { method: "GET", auth: "session", summary: "List personas visible to current user" },
      { method: "POST", auth: "admin", hasRequestBody: true }
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
    operations: [{ method: "GET", auth: "admin" }],
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
    path: "/api/portfolios/default",
    operations: [{ method: "GET", auth: "session" }],
    tag: "portfolios"
  },
  {
    path: "/api/portfolios/{portfolioId}/accounts",
    operations: [{ method: "GET", auth: "session" }],
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
    operations: [{ method: "PATCH", auth: "session", hasRequestBody: true }],
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
  health: "Health and runtime diagnostics endpoints.",
  auth: "Authentication and session management flows.",
  "access-requests": "User-submitted access and onboarding requests.",
  "admin-access": "Admin workflows for triaging and deciding access requests.",
  "admin-audit": "Admin audit and activity timeline endpoints.",
  "admin-system": "Admin system-level diagnostics and scheduled task controls.",
  "admin-tasks": "Admin task catalog and task-run controls.",
  "admin-users": "Admin management of user records, roles, plans, and settings.",
  personas: "Persona and collection lifecycle APIs.",
  portfolios: "Default portfolio, account, and watchlist read APIs for signed-in users.",
  positions: "Position capture and persistence APIs.",
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

function toOperationId(method: RouteMethod, path: string): string {
  const raw = `${method.toLowerCase()}_${path}`
    .replace("/api/", "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return raw;
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

function buildResponses(auth: AuthScope): Record<string, OpenApiResponse> {
  const responses: Record<string, OpenApiResponse> = {
    "200": {
      description: "Successful response.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ApiSuccessPayload" }
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
          schema: { $ref: "#/components/schemas/ErrorResponse" }
        }
      }
    };
  }

  if (auth === "admin") {
    responses["403"] = {
      description: "Session is valid, but admin role is required.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" }
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
      title: "atxFinance Core API (Current State)",
      version: APP_VERSION,
      description:
        "Internal architecture snapshot generated from current Next.js route handlers. This spec prioritizes endpoint coverage, auth boundaries, and route-level inventory for review."
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
            "Broad placeholder for successful JSON payloads in current-state docs. Replace with strict per-route schemas over time."
        },
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
