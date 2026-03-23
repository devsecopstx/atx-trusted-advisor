import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BFF_PROXY_ROUTES, toKotlinBffMappingNeedle } from "@/lib/bff-proxy-routes";

const REPO_ROOT = process.cwd();
const BACKEND_KOTLIN_MAIN = resolve(REPO_ROOT, "services/atxfinance-backend/src/main/kotlin");
const SPEC_PATH = resolve(REPO_ROOT, "docs/ops/atxfinance-backend-http-api.md");

/** Routes that must stay declared in Kotlin controllers and documented in the HTTP spec. */
const REQUIRED_GET_ROUTES = ["/api/health", "/api/backend/health"] as const;

const REQUIRED_PORTFOLIO_BFF_MAPPINGS = BFF_PROXY_ROUTES.map(toKotlinBffMappingNeedle);

function readTreeFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, name.name);
    if (name.isDirectory()) readTreeFiles(p, acc);
    else if (name.isFile() && name.name.endsWith(".kt")) acc.push(p);
  }
  return acc;
}

describe("atxfinance-backend HTTP API parity (docs ↔ Kotlin)", () => {
  it("spec file exists and lists required routes", () => {
    const spec = readFileSync(SPEC_PATH, "utf8");
    for (const route of REQUIRED_GET_ROUTES) {
      expect(spec).toContain(route);
    }
    expect(spec).toContain("/api/portfolios/{portfolioId}");
    expect(spec).toContain("/api/portfolios/default");
    expect(spec).toContain("/api/portfolios/current");
    expect(spec).toContain("/api/portfolios/{portfolioId}/accounts");
    expect(spec).toContain("/api/portfolios/{portfolioId}/accounts/{accountId}");
    expect(spec).toContain("/api/portfolios/{portfolioId}/watchlist");
    expect(spec).toContain("/api/positions");
    expect(spec).toContain("/api/positions/{positionId}");
    expect(spec).toContain("/api/personas");
    expect(spec).toContain("/api/personas/{personaId}");
    expect(spec).toContain("/api/access-requests");
    expect(spec).toContain("/api/recommendations");
    expect(spec).toContain("/api/recommendations/{recommendationId}");
    expect(spec).toContain("/api/portfolios/{portfolioId}/recommendations");
    expect(spec).toContain("/api/strategy-options");
    expect(spec).toContain("/api/strategy-options/expirations");
    expect(spec).toContain("/api/user-feedback");
    expect(spec).toContain("/api/admin/bootstrap-status");
    expect(spec).toContain("/api/admin/audit");
    expect(spec).toContain("/api/admin/access-requests");
    expect(spec).toContain("/api/admin/users");
    expect(spec).toContain("/api/admin/users/approved");
    expect(spec).toContain("/api/admin/users/{userId}");
    expect(spec).toContain("/api/admin/users/{userId}/role");
    expect(spec).toContain("/api/admin/users/{userId}/plan");
    expect(spec).toContain("/api/admin/users/{userId}/email");
    expect(spec).toContain("/api/admin/users/{userId}/settings");
    expect(spec).toContain("/api/admin/tasks");
    expect(spec).toContain("/api/admin/tasks/{taskId}/run");
    expect(spec).toContain("/api/admin/task-runs");
    expect(spec).toContain("/api/admin/scheduler/tick");
    expect(spec).toContain("/api/rag/files");
    expect(spec).toContain("/actuator/health");
    expect(spec).toContain("/v3/api-docs");
  });

  it("Kotlin controllers still expose required @GetMapping paths", () => {
    const files = readTreeFiles(BACKEND_KOTLIN_MAIN);
    const combined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    for (const route of REQUIRED_GET_ROUTES) {
      const needle = `@GetMapping("${route}")`;
      expect(combined.includes(needle), `Missing ${needle} under services/atxfinance-backend/src/main/kotlin`).toBe(
        true
      );
    }
  });

  it("Kotlin controllers expose BFF @*Mapping paths (portfolios + personas + access-requests)", () => {
    const files = readTreeFiles(BACKEND_KOTLIN_MAIN);
    const combined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    for (const needle of REQUIRED_PORTFOLIO_BFF_MAPPINGS) {
      expect(combined.includes(needle), `Missing ${needle} under services/atxfinance-backend/src/main/kotlin`).toBe(
        true
      );
    }
  });
});
