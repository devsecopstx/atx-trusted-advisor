import { describe, expect, it } from "vitest";

import { APP_VERSION } from "@/lib/app-version";
import { buildCurrentStateOpenApi } from "@/lib/openapi/current-state";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

describe("buildCurrentStateOpenApi", () => {
  it("produces OpenAPI 3.1 document with info, paths, servers, and cookie security", () => {
    const doc = buildCurrentStateOpenApi();

    expect(doc.openapi).toMatch(/^3\.1\./);
    expect(doc.info.title.length).toBeGreaterThan(0);
    expect(doc.info.version).toBe(APP_VERSION);
    expect(doc.servers?.length).toBeGreaterThan(0);
    expect(doc.components?.securitySchemes?.cookieAuth?.type).toBe("apiKey");
    expect(doc.components?.securitySchemes?.cookieAuth?.in).toBe("cookie");
    expect(doc.paths["/api/health"]?.get?.operationId).toBeTruthy();
    expect(doc.paths["/api/openapi"]?.get?.operationId).toBeTruthy();
    expect(Object.keys(doc.components?.schemas ?? {}).length).toBeGreaterThan(0);
  });

  it("documents each path with at least one operation and non-empty operationId + responses", () => {
    const doc = buildCurrentStateOpenApi();

    for (const [routePath, item] of Object.entries(doc.paths)) {
      const methods = HTTP_METHODS.filter((m) => item[m] !== undefined);
      expect(methods.length, `${routePath} should declare at least one HTTP method`).toBeGreaterThan(0);

      for (const m of methods) {
        const op = item[m]!;
        expect(op.operationId.trim().length).toBeGreaterThan(0);
        expect(Object.keys(op.responses ?? {}).length).toBeGreaterThan(0);
      }
    }
  });

  it("merges operation overrides for GET /api/personas (status param + envelope schema)", () => {
    const doc = buildCurrentStateOpenApi();
    const getPersonas = doc.paths["/api/personas"]?.get;

    expect(getPersonas?.summary?.toLowerCase()).toContain("persona");
    expect(getPersonas?.parameters?.some((p) => p.name === "status")).toBe(true);
    expect(getPersonas?.responses?.["200"]?.content?.["application/json"]?.schema).toEqual(
      expect.objectContaining({ $ref: "#/components/schemas/PersonaListResponseEnvelope" })
    );
  });

  it("merges operation overrides for POST /api/personas (strict body + 201 response)", () => {
    const doc = buildCurrentStateOpenApi();
    const postPersonas = doc.paths["/api/personas"]?.post;

    expect(postPersonas?.summary?.toLowerCase()).toContain("create");
    expect(postPersonas?.requestBody?.required).toBe(true);
    expect(postPersonas?.requestBody?.content?.["application/json"]?.schema).toEqual(
      expect.objectContaining({ $ref: "#/components/schemas/PersonaCreateRequest" })
    );
    expect(postPersonas?.responses?.["201"]?.content?.["application/json"]?.schema).toEqual(
      expect.objectContaining({ $ref: "#/components/schemas/PersonaResponseEnvelope" })
    );
    expect(postPersonas?.responses?.["409"]).toBeDefined();
  });

  it("uses atx_<resource>_<action> operationIds for representative routes", () => {
    const doc = buildCurrentStateOpenApi();
    expect(doc.paths["/api/health"]?.get?.operationId).toBe("atx_health_get");
    expect(doc.paths["/api/openapi"]?.get?.operationId).toBe("atx_openapi_get");
    expect(doc.paths["/api/personas"]?.get?.operationId).toBe("atx_personas_list");
    expect(doc.paths["/api/portfolios/{portfolioId}"]?.get?.operationId).toBe("atx_portfolio_get");
  });

  it("includes 401 examples on session routes (overrides and defaults)", () => {
    const doc = buildCurrentStateOpenApi();
    const personas401 = doc.paths["/api/personas"]?.get?.responses?.["401"]?.content?.["application/json"]?.examples;
    expect(personas401?.session_required).toBeDefined();
    const rec401 =
      doc.paths["/api/recommendations"]?.get?.responses?.["401"]?.content?.["application/json"]?.examples;
    expect(rec401?.session_required).toBeDefined();
  });

  it("includes 403 examples on admin routes", () => {
    const doc = buildCurrentStateOpenApi();
    const ex =
      doc.paths["/api/admin/bootstrap-status"]?.get?.responses?.["403"]?.content?.["application/json"]?.examples;
    expect(ex?.admin_role_required).toBeDefined();
  });

  it("documents GET /api/openapi with an inventory preview example (incl. 401/403 doc hints)", () => {
    const doc = buildCurrentStateOpenApi();
    const ex = doc.paths["/api/openapi"]?.get?.responses?.["200"]?.content?.["application/json"]?.examples;
    expect(ex?.inventory_preview).toBeDefined();
    const preview = ex?.inventory_preview?.value as { paths?: Record<string, unknown> };
    expect(preview?.paths?.["/api/personas"]).toBeDefined();
    expect(preview?.paths?.["/api/admin/bootstrap-status"]).toBeDefined();
  });

  it("registers cluster success schemas in components", () => {
    const doc = buildCurrentStateOpenApi();
    expect(doc.components?.schemas?.AtxSessionJsonSuccess).toBeDefined();
    expect(doc.components?.schemas?.AtxAdminJsonSuccess).toBeDefined();
    expect(doc.components?.schemas?.AtxPublicJsonSuccess).toBeDefined();
  });
});
