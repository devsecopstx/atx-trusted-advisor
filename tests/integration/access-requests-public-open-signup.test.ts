import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

const identityMocks = vi.hoisted(() => ({
  ensureCoreUserByEmail: vi.fn()
}));

const credMocks = vi.hoisted(() => ({
  setInitialPasswordFromPublicSignup: vi.fn()
}));

const guestTrialMocks = vi.hoisted(() => ({
  provisionOpenSignupTrialAccess: vi.fn()
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
    ensureCoreUserByEmail: identityMocks.ensureCoreUserByEmail
  };
});

vi.mock("@/modules/identity/email-credentials-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/email-credentials-repository")>();
  return {
    ...actual,
    setInitialPasswordFromPublicSignup: credMocks.setInitialPasswordFromPublicSignup
  };
});

vi.mock("@/lib/marketing/guest-trial-auth", () => ({
  provisionOpenSignupTrialAccess: guestTrialMocks.provisionOpenSignupTrialAccess
}));

import { POST } from "@/app/api/access-requests/public/route";

describe("POST /api/access-requests/public open signup", () => {
  const prevEnv = { ...process.env };
  const userId = new ObjectId("507f1f77bcf86cd799439011");

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

  it("provisions guest trial without creating a pending access request", async () => {
    const pendingUser = {
      _id: userId,
      email: "open@example.com",
      roles: [] as string[],
      status: "active" as const,
      accountStatus: "pending_approval" as const,
      subscriptionPlan: "basic" as const,
      country: "US",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    identityMocks.ensureCoreUserByEmail.mockResolvedValueOnce(pendingUser);
    credMocks.setInitialPasswordFromPublicSignup.mockResolvedValueOnce({ ok: true });
    guestTrialMocks.provisionOpenSignupTrialAccess.mockResolvedValueOnce({
      ...pendingUser,
      roles: ["operator"],
      accountStatus: "approved"
    });

    const response = await POST(
      new Request("http://test/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "OpenSignup",
          email: "open@example.com",
          password: "abcdabcdabcd"
        })
      })
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      data?: { status?: string; trialProvisioned?: boolean };
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data?.status).toBe("approved");
    expect(payload.data?.trialProvisioned).toBe(true);
    expect(guestTrialMocks.provisionOpenSignupTrialAccess).toHaveBeenCalledWith({
      user: pendingUser,
      emailFromProvider: "open@example.com"
    });
  });
});
