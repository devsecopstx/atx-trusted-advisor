import { describe, expect, it } from "vitest";

import {
    DENO_SHIM_NODE_STUB_RELATIVE,
    RAG_COLLECTION_STANDALONE_TRACE_GLOBS,
    SERVER_EXTERNAL_PACKAGES,
    STANDALONE_OUTPUT_FILE_TRACING_INCLUDES,
    buildDevOnlyAllowedOrigins
} from "@/lib/next-build-policy";

describe("buildDevOnlyAllowedOrigins", () => {
  it("returns the loopback origins outside of production", () => {
    expect(buildDevOnlyAllowedOrigins("development")).toEqual(["127.0.0.1", "localhost"]);
    expect(buildDevOnlyAllowedOrigins("test")).toEqual(["127.0.0.1", "localhost"]);
    expect(buildDevOnlyAllowedOrigins(undefined)).toEqual(["127.0.0.1", "localhost"]);
  });

  it("returns undefined in production so the field is omitted from prod Cloud Run revisions", () => {
    expect(buildDevOnlyAllowedOrigins("production")).toBeUndefined();
  });

  it("treats casing strictly — 'Production' is not the canonical NODE_ENV value", () => {
    expect(buildDevOnlyAllowedOrigins("Production")).toEqual(["127.0.0.1", "localhost"]);
  });
});

describe("SERVER_EXTERNAL_PACKAGES", () => {
  it("keeps yahoo-finance2 external; deno shim is aliased to the Node stub", () => {
    expect(SERVER_EXTERNAL_PACKAGES).toContain("yahoo-finance2");
    expect(SERVER_EXTERNAL_PACKAGES).not.toContain("@deno/shim-deno");
    expect(SERVER_EXTERNAL_PACKAGES).toContain("mongodb");
    expect(SERVER_EXTERNAL_PACKAGES).toContain("redis");
    expect(DENO_SHIM_NODE_STUB_RELATIVE).toMatch(/deno-shim-node-stub\.ts$/);
    expect(Object.isFrozen(SERVER_EXTERNAL_PACKAGES)).toBe(true);
  });
});

describe("STANDALONE_OUTPUT_FILE_TRACING_INCLUDES", () => {
  it("ships the Python report generator for options-scan and rag-collection for admin RAG routes", () => {
    expect(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES["/api/reports/options-scan"]).toEqual([
      "./services/report-service/**"
    ]);
    expect(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES["/api/admin/rag-ingest"]).toEqual([
      ...RAG_COLLECTION_STANDALONE_TRACE_GLOBS
    ]);
    expect(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES["/api/admin/rag/refresh-finance"]).toEqual([
      ...RAG_COLLECTION_STANDALONE_TRACE_GLOBS
    ]);
  });

  it("is frozen so route handlers cannot mutate the standalone bundling allowlist at runtime", () => {
    expect(Object.isFrozen(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES)).toBe(true);
    expect(
      Object.isFrozen(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES["/api/reports/options-scan"])
    ).toBe(true);
    expect(Object.isFrozen(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES["/api/admin/rag-ingest"])).toBe(
      true
    );
  });
});
