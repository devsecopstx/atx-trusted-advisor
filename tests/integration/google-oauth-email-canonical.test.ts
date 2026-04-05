import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  readOAuthFlowCookies: vi.fn(),
  clearOAuthFlowCookies: vi.fn(),
  getSessionUser: vi.fn(),
  consumeOAuthReturnPathCookie: vi.fn(),
  isSafeOAuthReturnPath: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  getGoogleClientId: vi.fn(),
  isGoogleOAuthConfigured: vi.fn(),
  isAllowAnyXUserLoginEnabled: vi.fn(),
  getAtxfinanceBackendOrigin: vi.fn(() => undefined)
}));

const coreAdminMocks = vi.hoisted(() => ({
  createAccessRequest: vi.fn(),
  getPendingAccessRequestByUserAndRole: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  ensureCoreUserByEmail: vi.fn(),
  ensureSeededGlobalAdmin: vi.fn(),
  getCoreUserByEmail: vi.fn(),
  getCoreUserById: vi.fn(),
  getCoreUserByGoogleSub: vi.fn(),
  linkGoogleAccountToUser: vi.fn(),
  unlinkGoogleIdentityFromUser: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/env", () => envMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/identity/login-audit", () => ({
  appendLoginAuditRecord: vi.fn().mockResolvedValue(undefined)
}));

import { GET as googleCallback } from "@/app/api/auth/google/callback/route";

describe("Google OAuth canonical email user", () => {
  const regId = "507f1f77bcf86cd799439011";
  const strayId = "507f1f77bcf86cd7994390cc";

  beforeEach(() => {
    authMocks.readOAuthFlowCookies.mockResolvedValue({
      state: "state-token",
      verifier: "pkce-verifier"
    });
    authMocks.clearOAuthFlowCookies.mockResolvedValue(undefined);
    authMocks.getSessionUser.mockResolvedValue(null);
    authMocks.consumeOAuthReturnPathCookie.mockResolvedValue(null);
    authMocks.isSafeOAuthReturnPath.mockReturnValue(true);

    envMocks.isGoogleOAuthConfigured.mockReturnValue(true);
    envMocks.getGoogleClientId.mockReturnValue("google-client-id");
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(false);
    envMocks.getEnv.mockReturnValue({
      GOOGLE_CLIENT_SECRET: "test-secret",
      NODE_ENV: "test"
    });

    coreAdminMocks.getPendingAccessRequestByUserAndRole.mockResolvedValue(null);
    coreAdminMocks.createAccessRequest.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      userId: regId,
      requestedRole: "viewer",
      status: "pending",
      requestedAt: new Date()
    });

    identityMocks.ensureSeededGlobalAdmin.mockResolvedValue(null);
    identityMocks.ensureCoreUserByEmail.mockImplementation(async ({ email }) => ({
      _id: { toHexString: () => regId },
      email,
      roles: [],
      status: "active" as const
    }));
    identityMocks.getCoreUserById.mockResolvedValue({
      _id: { toHexString: () => regId },
      subscriptionPlan: "basic"
    });
  });

  it("moves google sub to the email registration row when sub was on a different user (pending roles)", async () => {
    const registrationUser = {
      _id: { toHexString: () => regId },
      email: "reg@example.com",
      roles: [] as string[],
      status: "active" as const
    };
    const strayGoogleUser = {
      _id: { toHexString: () => strayId },
      email: "other@example.com",
      roles: [] as string[],
      status: "active" as const
    };

    identityMocks.getCoreUserByEmail.mockResolvedValueOnce(registrationUser);
    identityMocks.getCoreUserByGoogleSub.mockResolvedValueOnce(strayGoogleUser);
    identityMocks.unlinkGoogleIdentityFromUser.mockResolvedValue(undefined);
    identityMocks.linkGoogleAccountToUser.mockResolvedValueOnce({
      ...registrationUser,
      googleAccount: { sub: "google-sub-1" }
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          token_type: "bearer"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "google-sub-1",
          email: "reg@example.com",
          email_verified: true,
          name: "Reg User",
          picture: "https://example.com/p.png"
        })
      }) as typeof fetch;

    const response = await googleCallback(
      new Request("http://127.0.0.1:3000/api/auth/google/callback?code=abc&state=state-token")
    );

    expect(identityMocks.unlinkGoogleIdentityFromUser).toHaveBeenCalledWith({
      userId: strayGoogleUser._id
    });
    expect(identityMocks.linkGoogleAccountToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: registrationUser._id,
        sub: "google-sub-1"
      })
    );
    expect(response.headers.get("location")).toContain("access_request_pending");
  });

  it("redirects to /xchat when PKCE cookies are missing but a session exists (stale tab / double callback)", async () => {
    authMocks.readOAuthFlowCookies.mockResolvedValue({ state: null, verifier: null });
    authMocks.getSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439099",
      email: "signed@example.com",
      roles: ["viewer"],
      tenantId: "507f1f77bcf86cd799439088",
      tenantRole: "tenant_admin",
      xUserId: "x123",
      username: "signed"
    });
    authMocks.consumeOAuthReturnPathCookie.mockResolvedValue(null);

    const response = await googleCallback(
      new Request("http://127.0.0.1:3000/api/auth/google/callback?code=abc&state=orphan")
    );

    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/xchat");
  });

  it("redirects to return path when PKCE cookies are missing, session exists, and return cookie is safe", async () => {
    authMocks.readOAuthFlowCookies.mockResolvedValue({ state: null, verifier: "only-verifier" });
    authMocks.getSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439099",
      email: "signed@example.com",
      roles: ["viewer"],
      tenantId: "507f1f77bcf86cd799439088",
      tenantRole: "tenant_admin",
      xUserId: "x123",
      username: "signed"
    });
    authMocks.consumeOAuthReturnPathCookie.mockResolvedValue("/portfolio");

    const response = await googleCallback(
      new Request("http://127.0.0.1:3000/api/auth/google/callback?code=abc&state=orphan")
    );

    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/portfolio");
  });

  it("rejects Google link when signed-in email does not match Google verified email", async () => {
    authMocks.getSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439099",
      email: "signed@example.com",
      roles: ["viewer"],
      tenantId: "507f1f77bcf86cd799439088",
      tenantRole: "tenant_admin",
      xUserId: "x123",
      username: "signed"
    });

    identityMocks.getCoreUserByEmail.mockResolvedValue(null);
    identityMocks.getCoreUserByGoogleSub.mockResolvedValue(null);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          token_type: "bearer"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "google-sub-other",
          email: "other@example.com",
          email_verified: true,
          name: "Other User"
        })
      }) as typeof fetch;

    const response = await googleCallback(
      new Request("http://127.0.0.1:3000/api/auth/google/callback?code=abc&state=state-token")
    );

    expect(response.headers.get("location")).toContain("error=google_link_email_mismatch");
    expect(identityMocks.linkGoogleAccountToUser).not.toHaveBeenCalled();
  });
});
