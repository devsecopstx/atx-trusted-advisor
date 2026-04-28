import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn(),
  getBffRouteRateLimitPolicy: vi.fn(() => ({ windowMs: 60_000, max: 10 })),
  buildRateLimitHeaders: vi.fn()
}));

const credentialsMocks = vi.hoisted(() => ({
  completeCredentialInvite: vi.fn(),
  issueEmailVerificationForUser: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const authzMocks = vi.hoisted(() => ({
  isGlobalAdmin: vi.fn()
}));

const finalizeMocks = vi.hoisted(() => ({
  finalizeEmailPasswordSession: vi.fn(),
  EmailPasswordSessionError: class EmailPasswordSessionError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
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
vi.mock("@/lib/default-landing-path", () => ({
  subscriberLandingPathForPlan: vi.fn(() => "/xchat")
}));
vi.mock("@/lib/finalize-email-password-session", () => finalizeMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => credentialsMocks);
vi.mock("@/modules/identity/repository", () => repoMocks);
vi.mock("@/modules/identity/authorization", () => authzMocks);
vi.mock("@/modules/identity/login-audit", () => auditMocks);
vi.mock("@/lib/send-email-credential-messages", () => emailMessageMocks);

import { POST as postCompleteInvite } from "@/app/api/auth/email/complete-invite/route";

describe("POST /api/auth/email/complete-invite", () => {
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
    authzMocks.isGlobalAdmin.mockReturnValue(false);
  });

  it("finalizes session for newly invited user after password set", async () => {
    credentialsMocks.completeCredentialInvite.mockResolvedValue({
      ok: true,
      userId: new ObjectId("507f1f77bcf86cd799439011")
    });
    repoMocks.getCoreUserById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      email: "newuser@example.com",
      emailVerifiedAt: new Date(),
      roles: ["viewer"],
      subscriptionPlan: "basic"
    });
    finalizeMocks.finalizeEmailPasswordSession.mockResolvedValue(undefined);

    const res = await postCompleteInvite(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "abcdefghijklmnopqrstuvwxyz123456",
          password: "verysecurepassword"
        })
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; redirect: string };
    expect(body.ok).toBe(true);
    expect(body.redirect).toBe("/xchat");
    expect(finalizeMocks.finalizeEmailPasswordSession).toHaveBeenCalledTimes(1);
    expect(credentialsMocks.issueEmailVerificationForUser).not.toHaveBeenCalled();
    expect(emailMessageMocks.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("finalizes session when user email already verified", async () => {
    credentialsMocks.completeCredentialInvite.mockResolvedValue({
      ok: true,
      userId: new ObjectId("507f1f77bcf86cd799439011")
    });
    repoMocks.getCoreUserById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      email: "verified@example.com",
      emailVerifiedAt: new Date(),
      roles: ["viewer"],
      subscriptionPlan: "basic"
    });
    finalizeMocks.finalizeEmailPasswordSession.mockResolvedValue(undefined);

    const res = await postCompleteInvite(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "abcdefghijklmnopqrstuvwxyz123456",
          password: "verysecurepassword"
        })
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; redirect: string };
    expect(body.ok).toBe(true);
    expect(body.redirect).toBe("/xchat");
    expect(finalizeMocks.finalizeEmailPasswordSession).toHaveBeenCalledTimes(1);
  });
});
