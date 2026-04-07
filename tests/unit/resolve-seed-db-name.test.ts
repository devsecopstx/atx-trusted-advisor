import { afterEach, describe, expect, it } from "vitest";

describe("resolveSeedDbName (scripts/lib/resolve-mongo-uri.mjs)", () => {
  const original = { ...process.env };

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in original)) {
        delete process.env[k];
      }
    }
    for (const [k, v] of Object.entries(original)) {
      process.env[k] = v;
    }
  });

  it("uses MONGODB_DB_NAME when set (overrides URI path)", async () => {
    process.env.MONGODB_DB_NAME = "from_env";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/from_uri?authSource=admin";
    const { resolveSeedDbName } = await import("../../scripts/lib/resolve-mongo-uri.mjs");
    expect(resolveSeedDbName()).toBe("from_env");
  });

  it("uses database segment from MONGODB_URI when MONGODB_DB_NAME unset", async () => {
    delete process.env.MONGODB_DB_NAME;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/my_workspace_db?authSource=admin";
    const { resolveSeedDbName } = await import("../../scripts/lib/resolve-mongo-uri.mjs");
    expect(resolveSeedDbName()).toBe("my_workspace_db");
  });

  it("falls back to atxfinance when URI has no path db", async () => {
    delete process.env.MONGODB_DB_NAME;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/?authSource=admin";
    const { resolveSeedDbName } = await import("../../scripts/lib/resolve-mongo-uri.mjs");
    expect(resolveSeedDbName()).toBe("atxfinance");
  });
});
