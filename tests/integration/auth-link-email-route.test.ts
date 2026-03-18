import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userRoles: [] as string[]
}));

const authMocks = vi.hoisted(() => ({
  consumePendingXLinkCookie: vi.fn(),
  createSession: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
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
  linkXAccountToUser: vi.fn(),
  resolveAuthContext: vi.fn(),
  updateCoreUserEmail: vi.fn(),
  upsertTenantMembership: vi.fn()
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
      email: "user@xfinance.ai",
      roles: state.userRoles,
      status: "active"
    });
    identityMocks.getCoreUserByXIdentity.mockResolvedValue(null);
    identityMocks.updateCoreUserEmail.mockResolvedValue(null);
    identityMocks.ensureCoreUserByEmail.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@xfinance.ai",
      roles: state.userRoles,
      status: "active"
    });
    identityMocks.linkXAccountToUser.mockImplementation(async () => ({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@xfinance.ai",
      roles: [...state.userRoles],
      status: "active"
    }));
    identityMocks.ensureDefaultTenant.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439022" }
    });
    identityMocks.upsertTenantMembership.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" }
    });
    identityMocks.resolveAuthContext.mockImplementation(async () => ({
      userId: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "user@xfinance.ai",
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
        body: JSON.stringify({ email: "user@xfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/login?error=access_request_pending");
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledTimes(1);
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });

  it("allows fallback viewer login and redirects to /xchat when flag is enabled", async () => {
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(true);

    const response = await linkEmailPost(
      new Request("http://127.0.0.1:3000/api/auth/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@xfinance.ai" })
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
        body: JSON.stringify({ email: "user@xfinance.ai" })
      })
    );

    const payload = (await response.json()) as { redirectTo: string };
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/admin");
    expect(coreAdminMocks.createAccessRequest).not.toHaveBeenCalled();
  });
});
