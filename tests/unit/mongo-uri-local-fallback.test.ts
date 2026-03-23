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
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    delete process.env.ADMIN_X_USERNAME;
    delete process.env.ADMIN_X_USERNAMES;
    delete process.env.MONGO_ROOT_USERNAME;
    delete process.env.MONGO_ROOT_PASSWORD;
    delete process.env.MONGODB_HOST;
    delete process.env.MONGODB_NO_AUTH;
    process.env.MONGODB_DB_NAME = "atxfinancedb";
  });

  it("injects compose-aligned admin credentials for localhost when URI is unset", async () => {
    const { getMongoUriFromB64 } = await import("@/lib/env");
    const uri = getMongoUriFromB64();
    expect(uri).toMatch(/^mongodb:\/\/admin:/);
    expect(uri).toContain(encodeURIComponent("atxrocks!"));
    expect(uri).toContain("authSource=admin");
    expect(uri).toContain("localhost:27017/atxfinancedb");
  });

  it("ignores ADMIN_X_USERNAMES for Mongo; uses MONGO_ROOT_USERNAME (default admin)", async () => {
    process.env.ADMIN_X_USERNAMES = "alice,bob";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_DB_NAME = "atxfinancedb";
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    delete process.env.MONGO_ROOT_PASSWORD;
    const uri = getMongoUriFromB64();
    expect(uri).toMatch(/^mongodb:\/\/admin:/);
    expect(uri).toContain(encodeURIComponent("atxrocks!"));
  });

  it("uses explicit MONGO_ROOT_USERNAME + MONGO_ROOT_PASSWORD on localhost", async () => {
    process.env.MONGO_ROOT_USERNAME = "alice";
    process.env.MONGO_ROOT_PASSWORD = "secret";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_DB_NAME = "atxfinancedb";
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    const uri = getMongoUriFromB64();
    expect(uri).toContain(`${encodeURIComponent("alice")}:`);
    expect(uri).toContain(`${encodeURIComponent("secret")}@`);
  });

  it("injects default auth for non-local host when MONGO_ROOT_USERNAME/password unset", async () => {
    process.env.MONGODB_HOST = "mongo.internal.example";
    vi.resetModules();
    const { getMongoUriFromB64 } = await import("@/lib/env");
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_DB_NAME = "atxfinancedb";
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_URI_B4;
    delete process.env.MONGO_ROOT_USERNAME;
    delete process.env.MONGO_ROOT_PASSWORD;
    const uri = getMongoUriFromB64();
    expect(uri).toBe("mongodb://admin:atxrocks!@mongo.internal.example:27017/atxfinancedb?authSource=admin");
  });
});
