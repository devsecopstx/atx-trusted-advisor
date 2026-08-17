import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userRoles: [] as string[]
}));

const tenantUserBootstrapMocks = vi.hoisted(() => ({
  ensureTenantBootstrapForUser: vi.fn().mockResolvedValue({
    didProvision: true,
    result: {
      portfolio: { _id: { toHexString: () => "507f1f77bcf86cd799439081" } },
      account: { _id: { toHexString: () => "507f1f77bcf86cd799439082" } },
      watchlist: { _id: { toHexString: () => "507f1f77bcf86cd799439083" } }
    },
    platformRole: "viewer"
  })
}));

const authMocks = vi.hoisted(() => ({
  consumePendingXLinkCookie: vi.fn(),
  createSession: vi.fn(),
  consumeCapNativeOAuthCookie: vi.fn().mockResolvedValue(false)
}));

const guestTrialMocks = vi.hoisted(() => ({
  provisionOpenSignupTrialAccess: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  isAllowAnyXUserLoginEnabled: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  createAccessRequest: vi.fn(),
  getPendingAccessRequestByUserAndRole: vi.fn()
}));

const defaultMembership = {
  _id: { toHexString: () => "507f1f77bcf86cd799439033" },
  userId: { toHexString: () => "507f1f77bcf86cd799439011" },
  tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
  role: "tenant_admin" as const,
  isDefaultTenant: true,
  updatedAt: new Date()
};

const identityMocks = vi.hoisted(() => ({
  dedupeDefaultTenantMembershipsForUser: vi.fn().mockResolvedValue(undefined),
  getDefaultTenantMembershipForUser: vi.fn(),
  ensureCoreUserByEmail: vi.fn(),
  getCoreUserByEmail: vi.fn(),
  getCoreUserByXIdentity: vi.fn(),
  unlinkXAccountFromUser: vi.fn(),
  linkXAccountToUser: vi.fn(),
  mergePlaceholderXUserIntoEmailUser: vi.fn(),
  resolveAuthContext: vi.fn(),
  updateCoreUserEmail: vi.fn(),
  ensureSeededGlobalAdmin: vi.fn(),
  recordUserSuccessfulLogin: vi.fn().mockResolvedValue(undefined)
}));

const emailCredentialMocks = vi.hoisted(() => ({
  issueEmailVerificationForUser: vi.fn().mockResolvedValue({ rawToken: "verify-token" })
}));

const emailMessageMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/env", () => envMocks);
vi.mock("@/lib/marketing/guest-trial-auth", () => guestTrialMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/core-admin/tenant-user-bootstrap", () => tenantUserBootstrapMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/identity/login-audit", () => ({
  appendLoginAuditRecord: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("@/modules/identity/email-credentials-repository", () => emailCredentialMocks);
vi.mock("@/lib/send-email-credential-messages", () => emailMessageMocks);

import { POST as linkEmailPost } from "@/app/api/auth/link-email/route";

describe("auth link-email route", () => {
  beforeEach(() => {
    state.userRoles = [];

    authMocks.consumePendingXLinkCookie.mockResolvedValue({
      xUserId: "x-user-1",
      username: "new_user",
      displayName: "New User",
      avatarUrl: "https://img.test/avatar.png"
    });
    authMocks.createSession.mockResolvedValue(undefined);

    envMocks.getEnv.mockReturnValue({
      ADMIN_SEED_EMAIL: "atxbogart@gmail.com"
    });
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(false);

    coreAdminMocks.createAccessRequest.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" }
    });
    coreAdminMocks.getPendingAccessRequestByUserAndRole.mockResolvedValue(null);

    identityMocks.getCoreUserByEmail.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: state.userRoles,
      status: "active",
      emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.getCoreUserByXIdentity.mockResolvedValue(null);
    identityMocks.unlinkXAccountFromUser.mockResolvedValue(undefined);
    identityMocks.updateCoreUserEmail.mockResolvedValue(null);
    identityMocks.ensureCoreUserByEmail.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: state.userRoles,
      status: "active",
      emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z")
    });
    identityMocks.linkXAccountToUser.mockImplementation(async () => ({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: [...state.userRoles],
      status: "active",
      emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z")
    }));
    identityMocks.mergePlaceholderXUserIntoEmailUser.mockImplementation(async () => ({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: [...state.userRoles],
      status: "active",
      emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z"),
      xAccount: {
        xUserId: "x-user-1",
        username: "new_user",
        linkedAt: new Date()
      }
    }));
    identityMocks.dedupeDefaultTenantMembershipsForUser.mockResolvedValue(undefined);
    identityMocks.getDefaultTenantMembershipForUser.mockResolvedValue(defaultMembership);
    identityMocks.ensureSeededGlobalAdmin.mockResolvedValue({
      user: {
        _id: { toHexString: () => "507f1f77bcf86cd799439011" },
        email: "atxbogart@gmail.com",
        roles: ["global_admin"],
        status: "active"
      }
    });
    identityMocks.resolveAuthContext.mockImplementation(async () => ({
      userId: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: [...state.userRoles],
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      tenantRole: "tenant_admin",
      xUserId: "x-user-1",
      username: "new_user"
    }));

    guestTrialMocks.provisionOpenSignupTrialAccess.mockImplementation(async ({ user }) => {
      const roles = Array.isArray(user.roles) ? [...user.roles] : [];
      if (roles.includes("global_admin") || roles.includes("admin") || roles.includes("operator") || roles.includes("advisor") || roles.includes("viewer")) {
        return { ...user, roles, accountStatus: user.accountStatus ?? "approved" };
      }
      state.userRoles = ["operator"];
      return {
        ...user,
        roles: ["operator"],
        accountStatus: "approved",
        emailVerifiedAt: user.emailVerifiedAt ?? new Date("2026-03-16T00:00:00.000Z")
      };
    });
  });

  it("refuses to attach X to an existing email account", async () => {
    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@atxfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toContain("email_belongs_to_other_account");
    expect(identityMocks.linkXAccountToUser).not.toHaveBeenCalled();
    expect(identityMocks.ensureSeededGlobalAdmin).not.toHaveBeenCalled();
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("open-signup still provisions when ALLOW_ANY_X_USER_LOGIN is enabled", async () => {
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(true);

    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@atxfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toContain("email_belongs_to_other_account");
    expect(identityMocks.ensureSeededGlobalAdmin).not.toHaveBeenCalled();
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("refuses typed-email bind even when the existing row is global_admin", async () => {
    state.userRoles = ["global_admin"];

    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@atxfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toContain("email_belongs_to_other_account");
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("sends verification instead of session when updating the same X placeholder email", async () => {
    identityMocks.getCoreUserByEmail.mockResolvedValueOnce(null);
    identityMocks.getCoreUserByXIdentity.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "xlogin-x-user-1@x.oauth.local",
      roles: ["operator"],
      status: "active"
    });
    identityMocks.updateCoreUserEmail.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "new@atxfinance.ai",
      roles: ["operator"],
      status: "active"
    });
    identityMocks.linkXAccountToUser.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "new@atxfinance.ai",
      roles: ["operator"],
      status: "active"
    });

    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@atxfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toContain("/xchat?error=email_unverified");
    expect(emailCredentialMocks.issueEmailVerificationForUser).toHaveBeenCalledTimes(1);
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("does not auto-seed admin from a typed email", async () => {
    identityMocks.linkXAccountToUser.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "atxbogart@gmail.com",
      roles: ["global_admin"],
      emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z"),
      xAccount: {
        xUserId: "x-user-1",
        username: "new_user",
        linkedAt: new Date()
      },
      status: "active"
    });
    identityMocks.resolveAuthContext.mockResolvedValueOnce({
      userId: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "atxbogart@gmail.com",
      roles: ["global_admin"],
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      tenantRole: "tenant_admin",
      xUserId: "x-user-1",
      username: "new_user"
    });

    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "atxbogart@gmail.com" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toContain("email_belongs_to_other_account");
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("refuses to relink a stale X identity onto an existing admin email", async () => {
    const staleUserId = "507f1f77bcf86cd7994390aa";
    const approvedAdminId = "507f1f77bcf86cd7994390bb";

    identityMocks.getCoreUserByEmail.mockResolvedValueOnce({
      _id: { toHexString: () => approvedAdminId },
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      status: "active"
    });
    identityMocks.getCoreUserByXIdentity.mockResolvedValueOnce({
      _id: { toHexString: () => staleUserId },
      email: "xlogin-x-user-1@x.oauth.local",
      roles: [],
      status: "active"
    });
    identityMocks.linkXAccountToUser.mockResolvedValueOnce({
      _id: { toHexString: () => approvedAdminId },
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z"),
      xAccount: {
        xUserId: "x-user-1",
        username: "new_user",
        linkedAt: new Date()
      },
      status: "active"
    });
    identityMocks.resolveAuthContext.mockResolvedValueOnce({
      userId: { toHexString: () => approvedAdminId },
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      tenantRole: "tenant_admin",
      xUserId: "x-user-1",
      username: "new_user"
    });

    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@atxfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toContain("email_belongs_to_other_account");
    expect(identityMocks.linkXAccountToUser).not.toHaveBeenCalled();
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });
});
