import { MongoServerError, ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

const identityMocks = vi.hoisted(() => ({
  ensureCoreUserByEmail: vi.fn(),
  updateCoreUserAccountStatus: vi.fn()
}));

const credMocks = vi.hoisted(() => ({
  setInitialPasswordFromPublicSignup: vi.fn()
}));

vi.mock("@/lib/distributed-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distributed-rate-limit")>();
  return {
    ...actual,
    checkDistributedRateLimit: limitMocks.checkDistributedRateLimit,
    extractClientRateLimitKey: limitMocks.extractClientRateLimitKey
  };
});

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    ensureCoreUserByEmail: identityMocks.ensureCoreUserByEmail,
    updateCoreUserAccountStatus: identityMocks.updateCoreUserAccountStatus
  };
});

vi.mock("@/modules/identity/email-credentials-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/email-credentials-repository")>();
  return {
    ...actual,
    setInitialPasswordFromPublicSignup: credMocks.setInitialPasswordFromPublicSignup
  };
});

import { POST } from "@/app/api/access-requests/public/route";

const validBody = () =>
  JSON.stringify({
    name: "ReSignupUser",
    email: "resignup@example.com",
    password: "abcdabcdabcd"
  });

describe("POST /api/access-requests/public signup errors", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAtMs: Date.now() + 60_000,
      retryAfterSeconds: 0,
      source: "memory" as const
    });
    process.env = { ...prevEnv };
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("returns 409 username_taken when ensure hits duplicate username index", async () => {
    identityMocks.ensureCoreUserByEmail.mockRejectedValueOnce(
      new MongoServerError({
        message: "E11000 duplicate key error index: uniq_core_user_username dup key: { username: \"taken\" }",
        code: 11000,
        keyPattern: { username: 1 }
      })
    );

    const response = await POST(
      new Request("http://test/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: validBody()
      })
    );
    const payload = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(409);
    expect(payload.code).toBe("username_taken");
    expect(payload.error).toMatch(/username is already taken/i);
    expect(credMocks.setInitialPasswordFromPublicSignup).not.toHaveBeenCalled();
  });

  it("returns 503 when password step reports not_found", async () => {
    identityMocks.ensureCoreUserByEmail.mockResolvedValueOnce({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      email: "resignup@example.com",
      roles: [],
      status: "active",
      accountStatus: "pending_approval",
      subscriptionPlan: "basic",
      country: "US",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    credMocks.setInitialPasswordFromPublicSignup.mockResolvedValueOnce({ ok: false, code: "not_found" });

    const response = await POST(
      new Request("http://test/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: validBody()
      })
    );
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(503);
    expect(payload.code).toBe("account_not_found_after_provision");
  });
});
