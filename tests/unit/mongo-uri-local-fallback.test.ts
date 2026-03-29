import { beforeEach, describe, expect, it, vi } from "vitest";

const requiredEnv = {
  XAI_API_KEY: "test-xai",
  XAI_MANAGEMENT_API_KEY: "test-mgmt",
  X_OAUTH_CLIENT_ID: "id",
  X_OAUTH_CLIENT_SECRET: "secret"
} as const;

describe("getMongoUriFromB64 local fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, requiredEnv);
    // Isolate from developer shell / Vitest-loaded .env (Atlas/stage URIs); fallback tests need these unset.
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    delete process.env.ADMIN_X_USERNAME;
    delete process.env.ADMIN_X_USERNAMES;
    delete process.env.MONGO_ROOT_USERNAME;
    delete process.env.MONGO_ROOT_PASSWORD;
    delete process.env.MONGODB_HOST;
    delete process.env.MONGODB_NO_AUTH;
    delete process.env.ATX_DEPLOY_TARGET;
    delete process.env.DEPLOY_TARGET;
    process.env.MONGODB_DB_NAME = "atxfinance";
  });

  it("uses no-auth localhost URI when URI is unset and MONGO_ROOT_PASSWORD is unset", async () => {
    const { getMongoUriFromB64 } = await import("@/lib/env");
    const uri = getMongoUriFromB64();
    expect(uri).toBe("mongodb://localhost:27017/atxfinance");
  });

  it("ignores ADMIN_X_USERNAMES for Mongo; uses MONGO_ROOT_USERNAME (default admin)", async () => {
    process.env.ADMIN_X_USERNAMES = "alice,bob";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_DB_NAME = "atxfinance";
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    delete process.env.MONGO_ROOT_PASSWORD;
    const uri = getMongoUriFromB64();
    expect(uri).toBe("mongodb://localhost:27017/atxfinance");
  });

  it("uses explicit MONGO_ROOT_USERNAME + MONGO_ROOT_PASSWORD on localhost", async () => {
    process.env.MONGO_ROOT_USERNAME = "alice";
    process.env.MONGO_ROOT_PASSWORD = "secret";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_DB_NAME = "atxfinance";
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    const uri = getMongoUriFromB64();
    expect(uri).toContain(`${encodeURIComponent("alice")}:`);
    expect(uri).toContain(`${encodeURIComponent("secret")}@`);
  });

  it("defaults DB to atxfinance-<ATX_DEPLOY_TARGET> when MONGODB_DB_NAME is unset", async () => {
    delete process.env.MONGODB_DB_NAME;
    process.env.ATX_DEPLOY_TARGET = "stage";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    const uri = getMongoUriFromB64();
    expect(uri).toContain("localhost:27017/atxfinance-stage");
  });

  it("uses no-auth URI for non-local host when MONGO_ROOT_PASSWORD unset", async () => {
    process.env.MONGODB_HOST = "mongo.internal.example";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_DB_NAME = "atxfinance";
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    delete process.env.MONGO_ROOT_USERNAME;
    delete process.env.MONGO_ROOT_PASSWORD;
    const uri = getMongoUriFromB64();
    expect(uri).toBe("mongodb://mongo.internal.example:27017/atxfinance");
  });
});
