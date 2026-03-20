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
});
