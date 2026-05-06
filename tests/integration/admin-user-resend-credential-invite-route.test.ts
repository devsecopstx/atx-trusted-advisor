import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const inviteMocks = vi.hoisted(() => ({
  issueCredentialInviteForUser: vi.fn()
}));

const emailMocks = vi.hoisted(() => ({
  sendAccessApprovedPasswordInviteEmail: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => inviteMocks);
vi.mock("@/lib/send-email-credential-messages", () => emailMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/lib/backend-bff", () => ({
  proxyAdminUsersRequestToBackend: vi.fn().mockResolvedValue(null)
}));

import { POST as postResendCredentialInvite } from "@/app/api/admin/users/[userId]/resend-credential-invite/route";

const USER_ID = "507f1f77bcf86cd799439033";

const activeViewerNoPassword = {
  _id: { toHexString: () => USER_ID },
  email: "invitee@example.com",
  roles: ["viewer"],
  subscriptionPlan: "basic",
  status: "active" as const,
  createdAt: new Date("2026-03-16T00:00:00.000Z"),
  updatedAt: new Date("2026-03-16T00:00:00.000Z")
};

describe("POST /api/admin/users/[userId]/resend-credential-invite", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@example.com",
      username: "admin"
    });
    inviteMocks.issueCredentialInviteForUser.mockResolvedValue({ rawToken: "fresh-token" });
    emailMocks.sendAccessApprovedPasswordInviteEmail.mockResolvedValue(true);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    identityMocks.getCoreUserById.mockReset();
    identityMocks.getCoreUserById
      .mockResolvedValueOnce(activeViewerNoPassword)
      .mockResolvedValue({
        ...activeViewerNoPassword,
        credentialInviteExpiresAt: new Date("2026-12-31T00:00:00.000Z")
      });
  });

  it("issues token, sends email, and returns 200", async () => {
    const res = await postResendCredentialInvite(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userId: string; emailedTo: string; credentialInviteExpiresAt: string | null };
    };
    expect(body.data.userId).toBe(USER_ID);
    expect(body.data.emailedTo).toBe("invitee@example.com");
    expect(body.data.credentialInviteExpiresAt).toBe("2026-12-31T00:00:00.000Z");
    expect(inviteMocks.issueCredentialInviteForUser).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendAccessApprovedPasswordInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "invitee@example.com",
        rawToken: "fresh-token"
      })
    );
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "core_user",
        entityId: USER_ID,
        action: "credential_invite_resent"
      })
    );
  });

  it("returns 409 when user already has a password", async () => {
    identityMocks.getCoreUserById.mockReset();
    identityMocks.getCoreUserById.mockResolvedValue({
      ...activeViewerNoPassword,
      passwordHash: "hashed"
    });
    const res = await postResendCredentialInvite(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(409);
    expect(inviteMocks.issueCredentialInviteForUser).not.toHaveBeenCalled();
  });

  it("returns 409 when sign-in-only mode is enabled", async () => {
    vi.stubEnv("ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY", "true");
    const res = await postResendCredentialInvite(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(409);
    expect(inviteMocks.issueCredentialInviteForUser).not.toHaveBeenCalled();
  });

  it("returns 502 when email send fails but token was issued", async () => {
    identityMocks.getCoreUserById.mockReset();
    identityMocks.getCoreUserById
      .mockResolvedValueOnce(activeViewerNoPassword)
      .mockResolvedValue({
        ...activeViewerNoPassword,
        credentialInviteExpiresAt: new Date("2026-06-01T00:00:00.000Z")
      });
    emailMocks.sendAccessApprovedPasswordInviteEmail.mockResolvedValueOnce(false);
    const res = await postResendCredentialInvite(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(502);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "credential_invite_resend_email_failed"
      })
    );
  });

  it("returns 503 when invite issue fails", async () => {
    inviteMocks.issueCredentialInviteForUser.mockResolvedValueOnce(null);
    identityMocks.getCoreUserById.mockReset();
    identityMocks.getCoreUserById.mockResolvedValue(activeViewerNoPassword);
    const res = await postResendCredentialInvite(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(503);
    expect(emailMocks.sendAccessApprovedPasswordInviteEmail).not.toHaveBeenCalled();
  });

  it("returns 403-shaped response when admin session missing", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await postResendCredentialInvite(new Request("http://test/", { method: "POST" }), {
      params: Promise.resolve({ userId: USER_ID })
    });
    expect(res.status).toBe(403);
  });
});
