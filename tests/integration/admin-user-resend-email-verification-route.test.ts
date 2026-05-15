import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const credMocks = vi.hoisted(() => ({
  adminClearVerificationAndPasswordState: vi.fn(),
  issueEmailVerificationForUser: vi.fn()
}));

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => credMocks);
vi.mock("@/lib/send-email-credential-messages", () => emailMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/lib/backend-bff", () => ({
  proxyAdminUsersRequestToBackend: vi.fn().mockResolvedValue(null)
}));

import { POST as postResendEmailVerification } from "@/app/api/admin/users/[userId]/resend-email-verification/route";

const USER_ID = "507f1f77bcf86cd799439033";

const activeViewer = {
  _id: { toHexString: () => USER_ID },
  email: "invitee@example.com",
  roles: ["viewer"],
  subscriptionPlan: "basic",
  status: "active" as const,
  createdAt: new Date("2026-03-16T00:00:00.000Z"),
  updatedAt: new Date("2026-03-16T00:00:00.000Z")
};

describe("POST /api/admin/users/[userId]/resend-email-verification", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@example.com",
      username: "admin"
    });
    credMocks.adminClearVerificationAndPasswordState.mockResolvedValue(true);
    credMocks.issueEmailVerificationForUser.mockResolvedValue({ rawToken: "verify-token" });
    emailMocks.sendEmailVerificationEmail.mockResolvedValue(true);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    identityMocks.getCoreUserById.mockReset();
    identityMocks.getCoreUserById
      .mockResolvedValueOnce(activeViewer)
      .mockResolvedValue({
        ...activeViewer,
        emailVerificationExpiresAt: new Date("2026-12-31T00:00:00.000Z")
      });
  });

  it("clears state, issues token, sends email, returns 200", async () => {
    const res = await postResendEmailVerification(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userId: string; emailedTo: string; emailVerificationExpiresAt: string | null };
    };
    expect(body.data.userId).toBe(USER_ID);
    expect(body.data.emailedTo).toBe("invitee@example.com");
    expect(credMocks.adminClearVerificationAndPasswordState).toHaveBeenCalledTimes(1);
    expect(credMocks.issueEmailVerificationForUser).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "invitee@example.com",
        rawToken: "verify-token"
      })
    );
  });

  it("returns 409 when user has no login role", async () => {
    identityMocks.getCoreUserById.mockReset();
    identityMocks.getCoreUserById.mockResolvedValue({
      ...activeViewer,
      roles: []
    });
    const res = await postResendEmailVerification(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(409);
    expect(credMocks.adminClearVerificationAndPasswordState).not.toHaveBeenCalled();
  });

  it("returns 502 when email send fails", async () => {
    emailMocks.sendEmailVerificationEmail.mockResolvedValueOnce(false);
    const res = await postResendEmailVerification(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(502);
  });

  it("returns 403 when admin session missing", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await postResendEmailVerification(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(403);
  });
});
