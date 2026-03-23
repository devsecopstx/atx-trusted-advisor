import { describe, expect, it } from "vitest";

import { nextBffApi } from "@/lib/backend-bff";

type ExpectedRoute = {
  pathTemplate: string;
  methods: readonly string[];
};

const expectedRoutes: readonly ExpectedRoute[] = [
  { pathTemplate: "/api/portfolios/{portfolioId}", methods: ["GET", "PATCH"] },
  { pathTemplate: "/api/portfolios/default", methods: ["GET", "POST"] },
  { pathTemplate: "/api/portfolios/current", methods: ["GET"] },
  { pathTemplate: "/api/portfolios/{portfolioId}/accounts", methods: ["GET", "POST"] },
  { pathTemplate: "/api/portfolios/{portfolioId}/accounts/{accountId}", methods: ["PATCH"] },
  { pathTemplate: "/api/portfolios/{portfolioId}/watchlist", methods: ["GET", "PATCH"] },
  { pathTemplate: "/api/positions", methods: ["GET", "POST"] },
  { pathTemplate: "/api/positions/{positionId}", methods: ["DELETE"] },
  { pathTemplate: "/api/recommendations", methods: ["GET", "POST"] },
  { pathTemplate: "/api/recommendations/{recommendationId}", methods: ["GET"] },
  { pathTemplate: "/api/portfolios/{portfolioId}/recommendations", methods: ["GET", "POST"] },
  { pathTemplate: "/api/strategy-options", methods: ["GET"] },
  { pathTemplate: "/api/strategy-options/expirations", methods: ["GET"] },
  { pathTemplate: "/api/user-feedback", methods: ["POST"] },
  { pathTemplate: "/api/admin/bootstrap-status", methods: ["GET"] },
  { pathTemplate: "/api/admin/audit", methods: ["GET"] },
  { pathTemplate: "/api/admin/access-requests", methods: ["GET", "POST"] },
  { pathTemplate: "/api/admin/access-requests/{requestId}", methods: ["GET", "PATCH", "PUT", "DELETE"] },
  { pathTemplate: "/api/admin/users", methods: ["GET", "POST"] },
  { pathTemplate: "/api/admin/users/approved", methods: ["GET"] },
  { pathTemplate: "/api/admin/users/{userId}", methods: ["GET", "PUT", "DELETE"] },
  { pathTemplate: "/api/admin/users/{userId}/role", methods: ["PATCH"] },
  { pathTemplate: "/api/admin/users/{userId}/plan", methods: ["PATCH"] },
  { pathTemplate: "/api/admin/users/{userId}/email", methods: ["PATCH"] },
  { pathTemplate: "/api/admin/users/{userId}/settings", methods: ["GET", "PUT"] },
  { pathTemplate: "/api/admin/tasks", methods: ["GET", "POST"] },
  { pathTemplate: "/api/admin/tasks/{taskId}/run", methods: ["POST"] },
  { pathTemplate: "/api/admin/task-runs", methods: ["GET"] },
  { pathTemplate: "/api/admin/scheduler/tick", methods: ["POST"] },
  { pathTemplate: "/api/rag/files", methods: ["GET", "POST"] },
  { pathTemplate: "/api/access-requests", methods: ["POST"] },
  { pathTemplate: "/api/personas", methods: ["GET", "POST"] },
  { pathTemplate: "/api/personas/{personaId}", methods: ["GET", "PUT", "DELETE"] }
] as const;

function flattenRouteDefinitions(): ExpectedRoute[] {
  return Object.values(nextBffApi).flatMap((group) =>
    Object.values(group).map((route) => ({
      pathTemplate: route.pathTemplate,
      methods: [...route.methods]
    }))
  );
}

describe("nextBffApi", () => {
  it("declares the expected Next BFF route contracts", () => {
    const actual = flattenRouteDefinitions();
    expect(actual).toEqual(expectedRoutes);
  });

  it("does not contain duplicate path templates", () => {
    const paths = flattenRouteDefinitions().map((route) => route.pathTemplate);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("uses only supported HTTP methods", () => {
    const allowed = new Set(["GET", "POST", "PATCH", "DELETE", "PUT"]);
    const methods = flattenRouteDefinitions().flatMap((route) => route.methods);
    for (const method of methods) {
      expect(allowed.has(method)).toBe(true);
    }
  });
});
