import { beforeEach, describe, expect, it, vi } from "vitest";

const requiredEnv = {
  XAI_API_KEY: "test-xai",
  XAI_MANAGEMENT_API_KEY: "test-mgmt",
  X_OAUTH_CLIENT_ID: "id",
  X_OAUTH_CLIENT_SECRET: "secret"
} as const;

describe("redactMongoUriCredentials", () => {
  it("masks user:pass before @", async () => {
    const { redactMongoUriCredentials } = await import("@/lib/env");
    expect(redactMongoUriCredentials("mongodb://u:p@localhost:27017/db")).toBe(
      "mongodb://***:***@localhost:27017/db"
    );
    expect(redactMongoUriCredentials("mongodb+srv://alice:secret@cluster0.x.mongodb.net/mydb?retryWrites=true")).toBe(
      "mongodb+srv://***:***@cluster0.x.mongodb.net/mydb?retryWrites=true"
    );
  });

  it("returns unchanged when no credentials", async () => {
    const { redactMongoUriCredentials } = await import("@/lib/env");
    expect(redactMongoUriCredentials("mongodb://localhost:27017/atxfinance")).toBe(
      "mongodb://localhost:27017/atxfinance"
    );
  });
});

describe("getMongoEnvVarDiagnostics", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, requiredEnv);
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_URI_B64;
  });

  it("detects plain vs base64-shaped MONGODB_URI", async () => {
    process.env.MONGODB_URI = "mongodb+srv://h/x";
    const { getMongoEnvVarDiagnostics } = await import("@/lib/env");
    expect(getMongoEnvVarDiagnostics()).toEqual({
      mongodbUriEnvPresent: true,
      mongodbUriB64LegacyEnvPresent: false,
      mongodbUriValueShape: "mongodb_scheme"
    });

    vi.resetModules();
    Object.assign(process.env, requiredEnv);
    process.env.MONGODB_URI = Buffer.from("mongodb://localhost:27017/db").toString("base64");
    const d2 = (await import("@/lib/env")).getMongoEnvVarDiagnostics();
    expect(d2.mongodbUriValueShape).toBe("base64_payload");
    expect(d2.mongodbUriEnvPresent).toBe(true);
  });

  it("reports legacy MONGODB_URI_B64 when set", async () => {
    process.env.MONGODB_URI_B64 = "e30=";
    const { getMongoEnvVarDiagnostics } = await import("@/lib/env");
    expect(getMongoEnvVarDiagnostics().mongodbUriB64LegacyEnvPresent).toBe(true);
  });
});
