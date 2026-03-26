import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userRoles: [] as string[]
}));

const authMocks = vi.hoisted(() => ({
  consumePendingXLinkCookie: vi.fn(),
  createSession: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  isAllowAnyXUserLoginEnabled: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  createAccessRequest: vi.fn(),
  getPendingAccessRequestByUserAndRole: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  ensureDefaultTenant: vi.fn(),
  ensureCoreUserByEmail: vi.fn(),
  getCoreUserByEmail: vi.fn(),
  getCoreUserByXIdentity: vi.fn(),
  unlinkXAccountFromUser: vi.fn(),
  linkXAccountToUser: vi.fn(),
  resolveAuthContext: vi.fn(),
  updateCoreUserEmail: vi.fn(),
  upsertTenantMembership: vi.fn(),
  ensureSeededGlobalAdmin: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/env", () => envMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);

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
    coreAdminMocks.provisionDefaultPortfolioForUser.mockResolvedValue({
      portfolio: { _id: { toHexString: () => "507f1f77bcf86cd799439081" } },
      account: { _id: { toHexString: () => "507f1f77bcf86cd799439082" } },
      watchlist: { _id: { toHexString: () => "507f1f77bcf86cd799439083" } }
    });

    identityMocks.getCoreUserByEmail.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: state.userRoles,
      status: "active"
    });
    identityMocks.getCoreUserByXIdentity.mockResolvedValue(null);
    identityMocks.unlinkXAccountFromUser.mockResolvedValue(undefined);
    identityMocks.updateCoreUserEmail.mockResolvedValue(null);
    identityMocks.ensureCoreUserByEmail.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: state.userRoles,
      status: "active"
    });
    identityMocks.linkXAccountToUser.mockImplementation(async () => ({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@atxfinance.ai",
      roles: [...state.userRoles],
      status: "active"
    }));
    identityMocks.ensureDefaultTenant.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439022" }
    });
    identityMocks.upsertTenantMembership.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" }
    });
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
  });

  it("keeps pending flow when user is unapproved and flag is disabled", async () => {
    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@atxfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/xchat?error=access_request_pending");
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledTimes(1);
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("allows fallback viewer login and redirects to /xchat when flag is enabled", async () => {
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
    expect(payload.redirectTo).toBe("/xchat");
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledTimes(1);
    expect(coreAdminMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledTimes(1);
    expect(authMocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ["viewer"]
      })
    );
  });

  it("redirects admins to /admin", async () => {
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
    expect(payload.redirectTo).toBe("/admin");
    expect(coreAdminMocks.createAccessRequest).not.toHaveBeenCalled();
  });

  it("auto-seeds configured admin email and redirects to /admin", async () => {
    identityMocks.linkXAccountToUser.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "atxbogart@gmail.com",
      roles: ["global_admin"],
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
    expect(payload.redirectTo).toBe("/admin");
    expect(identityMocks.ensureSeededGlobalAdmin).toHaveBeenCalledWith(
      "atxbogart@gmail.com"
    );
  });

  it("relinks stale X identity to existing approved admin email user", async () => {
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
    expect(payload.redirectTo).toBe("/admin");
    expect(identityMocks.unlinkXAccountFromUser).toHaveBeenCalledWith({
      userId: expect.objectContaining({ toHexString: expect.any(Function) })
    });
    expect(identityMocks.linkXAccountToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.objectContaining({ toHexString: expect.any(Function) }),
        xUserId: "x-user-1"
      })
    );
  });
});
