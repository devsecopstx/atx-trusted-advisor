import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn(),
  getBffRouteRateLimitPolicy: vi.fn(() => ({ windowMs: 60_000, max: 10 })),
  buildRateLimitHeaders: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  getCoreUserByLoginIdentifier: vi.fn()
}));

const credentialsMocks = vi.hoisted(() => ({
  verifyUserPassword: vi.fn(),
  issueEmailVerificationForUser: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  appendLoginAuditRecord: vi.fn()
}));

const emailMessageMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn()
}));

vi.mock("@/lib/distributed-rate-limit", () => rateLimitMocks);
vi.mock("@/lib/client-request-meta", () => ({
  extractClientLoginMeta: vi.fn(() => ({
    clientIp: "127.0.0.1",
    country: "US",
    userAgent: "Vitest"
  }))
}));
vi.mock("@/modules/identity/repository", () => repoMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => credentialsMocks);
vi.mock("@/modules/identity/login-audit", () => auditMocks);
vi.mock("@/lib/send-email-credential-messages", () => emailMessageMocks);
vi.mock("@/lib/finalize-email-password-session", () => ({
  finalizeEmailPasswordSession: vi.fn(),
  EmailPasswordSessionError: class EmailPasswordSessionError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
}));
vi.mock("@/modules/identity/authorization", () => ({
  isGlobalAdmin: vi.fn(() => false)
}));
vi.mock("@/lib/default-landing-path", () => ({
  subscriberLandingPathForPlan: vi.fn(() => "/xchat")
}));

import { POST as postEmailLogin } from "@/app/api/auth/email/login/route";

describe("POST /api/auth/email/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMocks.getBffRouteRateLimitPolicy.mockReturnValue({ windowMs: 60_000, max: 10 });
    rateLimitMocks.extractClientRateLimitKey.mockReturnValue("test");
    rateLimitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetMs: 60_000
    });
  });

  it("returns email_unverified and sends verification email for valid new user credentials", async () => {
    repoMocks.getCoreUserByLoginIdentifier.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      username: "newuser",
      email: "newuser@example.com",
      passwordHash: "hash",
      roles: ["viewer"],
      status: "active"
    });
    credentialsMocks.verifyUserPassword.mockResolvedValue(true);
    credentialsMocks.issueEmailVerificationForUser.mockResolvedValue({
      rawToken: "verify_1234567890"
    });
    emailMessageMocks.sendEmailVerificationEmail.mockResolvedValue(true);

    const res = await postEmailLogin(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          password: "pw"
        })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("email_unverified");
    expect(credentialsMocks.issueEmailVerificationForUser).toHaveBeenCalledTimes(1);
    expect(emailMessageMocks.sendEmailVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("accepts a username in the backward-compatible email field", async () => {
    repoMocks.getCoreUserByLoginIdentifier.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439012"),
      username: "sam",
      email: "sam@example.com",
      emailVerifiedAt: new Date("2026-05-01T00:00:00.000Z"),
      passwordHash: "hash",
      roles: ["viewer"],
      status: "active"
    });
    credentialsMocks.verifyUserPassword.mockResolvedValue(true);

    const res = await postEmailLogin(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "sam",
          password: "pw",
          next: "/xchat"
        })
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: true; redirect: string };
    expect(body.redirect).toBe("/xchat");
    expect(repoMocks.getCoreUserByLoginIdentifier).toHaveBeenCalledWith("sam");
  });
});
