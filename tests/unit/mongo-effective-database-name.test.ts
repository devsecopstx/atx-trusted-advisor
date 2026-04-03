import { beforeEach, describe, expect, it, vi } from "vitest";

const requiredEnv = {
  XAI_API_KEY: "test-xai",
  XAI_MANAGEMENT_API_KEY: "test-mgmt",
  X_OAUTH_CLIENT_ID: "id",
  X_OAUTH_CLIENT_SECRET: "secret"
} as const;

describe("extractMongoDatabaseNameFromConnectionString", () => {
  it("reads DB segment from mongodb:// host path", async () => {
    const { extractMongoDatabaseNameFromConnectionString } = await import("@/lib/env");
    expect(extractMongoDatabaseNameFromConnectionString("mongodb://localhost:27017/atxfinance-dev")).toBe(
      "atxfinance-dev"
    );
    expect(
      extractMongoDatabaseNameFromConnectionString("mongodb://user:pass@127.0.0.1:27017/my-db?authSource=admin")
    ).toBe("my-db");
  });

  it("reads DB segment from mongodb+srv path", async () => {
    const { extractMongoDatabaseNameFromConnectionString } = await import("@/lib/env");
    expect(
      extractMongoDatabaseNameFromConnectionString(
        "mongodb+srv://u:p@cluster0.abcd.mongodb.net/prodname?retryWrites=true"
      )
    ).toBe("prodname");
  });

  it("returns undefined when URI has no database path", async () => {
    const { extractMongoDatabaseNameFromConnectionString } = await import("@/lib/env");
    expect(extractMongoDatabaseNameFromConnectionString("mongodb://localhost:27017")).toBeUndefined();
    expect(extractMongoDatabaseNameFromConnectionString("not-mongo://x")).toBeUndefined();
  });
});

describe("resolveEffectiveMongoDatabaseName (admin + app_user getDb parity)", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, requiredEnv);
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_URI_B64;
    delete process.env.MONGODB_DB_NAME;
    delete process.env.ATX_DEPLOY_TARGET;
    delete process.env.DEPLOY_TARGET;
    delete process.env.SEED_PARENT_MONGODB_DB_NAME;
  });

  it("prefers MONGODB_DB_NAME over URI path", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/atxfinance-dev";
    process.env.MONGODB_DB_NAME = "atxfinance-override";
    const { resolveEffectiveMongoDatabaseName } = await import("@/lib/env");
    expect(resolveEffectiveMongoDatabaseName()).toBe("atxfinance-override");
  });

  it("uses database from MONGODB_URI path when MONGODB_DB_NAME unset (Compass / local -dev DB)", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/atxfinance-dev";
    const { resolveEffectiveMongoDatabaseName } = await import("@/lib/env");
    expect(resolveEffectiveMongoDatabaseName()).toBe("atxfinance-dev");
  });

  it("falls back to resolveDefaultMongoDatabaseName when URI has no path segment", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    const { resolveEffectiveMongoDatabaseName, resolveDefaultMongoDatabaseName } = await import("@/lib/env");
    expect(resolveEffectiveMongoDatabaseName()).toBe(resolveDefaultMongoDatabaseName());
  });

  it("uses atxfinance-<target> when URI unset and ATX_DEPLOY_TARGET set", async () => {
    delete process.env.MONGODB_URI;
    process.env.ATX_DEPLOY_TARGET = "stage";
    const { resolveEffectiveMongoDatabaseName } = await import("@/lib/env");
    expect(resolveEffectiveMongoDatabaseName()).toBe("atxfinance-stage");
  });

  it("resolveSyncTargetMongoDatabaseName matches Next getDb() (ops scripts + UI parity)", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/atxfinance-dev";
    const { resolveEffectiveMongoDatabaseName } = await import("@/lib/env");
    const { resolveSyncTargetMongoDatabaseName } = await import("../../scripts/lib/sync-target-mongo-db");
    expect(resolveSyncTargetMongoDatabaseName()).toBe(resolveEffectiveMongoDatabaseName());
    expect(resolveSyncTargetMongoDatabaseName()).toBe("atxfinance-dev");
  });

  it("resolveSyncTargetMongoDatabaseName prefers SEED_PARENT_MONGODB_DB_NAME", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/atxfinance-dev";
    process.env.SEED_PARENT_MONGODB_DB_NAME = "atxfinance-seed-parent";
    const { resolveSyncTargetMongoDatabaseName } = await import("../../scripts/lib/sync-target-mongo-db");
    expect(resolveSyncTargetMongoDatabaseName()).toBe("atxfinance-seed-parent");
    delete process.env.SEED_PARENT_MONGODB_DB_NAME;
  });
});

describe("getMongoConnectionLabel uses effective DB when path omitted", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, requiredEnv);
    delete process.env.MONGODB_DB_NAME;
    delete process.env.ATX_DEPLOY_TARGET;
    delete process.env.DEPLOY_TARGET;
  });

  it("shows effective database name in label", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/atxfinance-dev";
    const { getMongoConnectionLabel } = await import("@/lib/env");
    expect(getMongoConnectionLabel()).toBe("localhost:27017/atxfinance-dev");
  });
});
