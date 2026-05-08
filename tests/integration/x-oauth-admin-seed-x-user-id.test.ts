import { beforeEach, describe, expect, it, vi } from "vitest";

const adminUserId = "507f1f77bcf86cd799439011";

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
  readOAuthFlowCookies: vi.fn(),
  clearOAuthFlowCookies: vi.fn(),
  readMarketingPostingOAuthFlowCookies: vi.fn(),
  clearMarketingPostingOAuthFlowCookies: vi.fn(),
  getSessionUser: vi.fn(),
  createSession: vi.fn(),
  setPendingXLinkCookie: vi.fn(),
  consumeOAuthReturnPathCookie: vi.fn(),
  isSafeOAuthReturnPath: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  getPendingAccessRequestByUserAndRole: vi.fn(),
  createAccessRequest: vi.fn()
}));

const identityMocks = vi.hoisted(() => {
  const getCoreUserByXIdentity = vi.fn();
  return {
    getCoreUserByXIdentity,
    getCoreUserByXOAuthIdentity: vi.fn(async (x) => getCoreUserByXIdentity(x.xUserId)),
    getCoreUserByEmail: vi.fn(),
    unlinkXAccountFromUser: vi.fn(),
    linkXAccountToUser: vi.fn(),
    ensureDefaultTenant: vi.fn(),
    dedupeDefaultTenantMembershipsForUser: vi.fn().mockResolvedValue(undefined),
    getDefaultTenantMembershipForUser: vi.fn(),
    upsertTenantMembership: vi.fn(),
    resolveAuthContext: vi.fn(),
    ensureCoreUserByEmail: vi.fn(),
    ensureSeededGlobalAdmin: vi.fn(),
    recordUserSuccessfulLogin: vi.fn().mockResolvedValue(undefined)
  };
});

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  getXOauthClientId: vi.fn(),
  isAllowAnyXUserLoginEnabled: vi.fn(),
  getAtxfinanceBackendOrigin: vi.fn(() => undefined)
}));

const bootstrapMocks = vi.hoisted(() => ({
  resolveOrCreateUserBootstrapCollection: vi.fn().mockResolvedValue({
    collectionId: "collection_test_user_history",
    collectionName: "test-user-history"
  })
}));

const emailCredentialMocks = vi.hoisted(() => ({
  issueEmailVerificationForUser: vi.fn().mockResolvedValue({ rawToken: "verify-token" })
}));

const sendCredentialEmailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/core-admin/tenant-user-bootstrap", () => tenantUserBootstrapMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/lib/env", () => envMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => emailCredentialMocks);
vi.mock("@/lib/send-email-credential-messages", () => sendCredentialEmailMocks);

import { GET as oauthCallback } from "@/app/api/auth/x/callback/route";

function makeAdminUser() {
  return {
    _id: { toHexString: () => adminUserId },
    email: "admin@seed.test",
    roles: ["global_admin"] as const,
    status: "active" as const,
    emailVerifiedAt: new Date("2026-03-16T00:00:00.000Z")
  };
}

describe("X OAuth without email + ADMIN_SEED_X_USER_ID", () => {
  beforeEach(() => {
    authMocks.readOAuthFlowCookies.mockResolvedValue({
      state: "state-token",
      verifier: "pkce-verifier"
    });
    authMocks.readMarketingPostingOAuthFlowCookies.mockResolvedValue({
      state: null,
      verifier: null
    });
    authMocks.clearOAuthFlowCookies.mockResolvedValue(undefined);
    authMocks.clearMarketingPostingOAuthFlowCookies.mockResolvedValue(undefined);
    authMocks.getSessionUser.mockResolvedValue(null);
    authMocks.createSession.mockResolvedValue(undefined);
    authMocks.setPendingXLinkCookie.mockResolvedValue(undefined);
    authMocks.consumeOAuthReturnPathCookie.mockResolvedValue(null);
    authMocks.isSafeOAuthReturnPath.mockImplementation(
      (path: string) => path.startsWith("/") && !path.startsWith("//") && !path.includes("..")
    );

    coreAdminMocks.getPendingAccessRequestByUserAndRole.mockResolvedValue(null);
    coreAdminMocks.createAccessRequest.mockResolvedValue(undefined);

    identityMocks.getDefaultTenantMembershipForUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd7994390dd" },
      userId: { toHexString: () => adminUserId },
      tenantId: { toHexString: () => "507f1f77bcf86cd799439033" },
      role: "tenant_admin",
      isDefaultTenant: true,
      updatedAt: new Date()
    });

    identityMocks.getCoreUserByXIdentity.mockResolvedValue(null);
    identityMocks.getCoreUserByEmail.mockResolvedValue(null);
    identityMocks.unlinkXAccountFromUser.mockResolvedValue(undefined);
    identityMocks.linkXAccountToUser.mockImplementation(async (input) => ({
      ...makeAdminUser(),
      xAccount: {
        xUserId: input.xUserId,
        username: input.username,
        displayName: input.displayName,
        linkedAt: new Date()
      }
    }));
    identityMocks.ensureDefaultTenant.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      slug: "atxfinance-core",
      name: "atxFinance Core",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    identityMocks.upsertTenantMembership.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439044" }
    });
    identityMocks.resolveAuthContext.mockResolvedValue({
      userId: { toHexString: () => adminUserId },
      email: "admin@seed.test",
      roles: ["global_admin"],
      tenantId: { toHexString: () => "507f1f77bcf86cd799439033" },
      tenantRole: "tenant_admin",
      xUserId: "x-seed-42",
      username: "seed_admin_x"
    });
    identityMocks.ensureCoreUserByEmail.mockResolvedValue(makeAdminUser());
    identityMocks.ensureSeededGlobalAdmin.mockResolvedValue({
      user: makeAdminUser(),
      tenant: { _id: { toHexString: () => "507f1f77bcf86cd799439033" } },
      membership: { _id: { toHexString: () => "507f1f77bcf86cd799439044" } }
    });

    envMocks.getEnv.mockReturnValue({
      X_OAUTH_CLIENT_SECRET: "test-secret",
      X_OAUTH_TOKEN_URL: "https://x.test/token",
      X_OAUTH_USERINFO_URL: "https://x.test/me",
      ADMIN_SEED_EMAIL: "admin@seed.test",
      ADMIN_SEED_X_USER_ID: "x-seed-42",
      ADMIN_X_USERNAMES: "",
      ALLOW_ANY_X_USER_LOGIN: "false",
      NODE_ENV: "test"
    });
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(false);
    envMocks.getXOauthClientId.mockReturnValue("test-client-id");

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
          data: {
            id: "x-seed-42",
            username: "seed_admin_x",
            name: "Seed Admin"
          }
        })
      }) as typeof fetch;
  });

  it("links seeded global admin when X userinfo omits email and id matches ADMIN_SEED_X_USER_ID", async () => {
    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );
    expect(response.headers.get("location")).toContain("/admin");
    expect(identityMocks.ensureSeededGlobalAdmin).toHaveBeenCalledWith("admin@seed.test");
    expect(identityMocks.linkXAccountToUser).toHaveBeenCalledTimes(1);
    expect(identityMocks.linkXAccountToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        xUserId: "x-seed-42",
        username: "seed_admin_x"
      })
    );
    expect(authMocks.setPendingXLinkCookie).not.toHaveBeenCalled();
    expect(authMocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("links seeded global admin when X omits email and ADMIN_SEED_X_USERNAME matches OAuth username", async () => {
    envMocks.getEnv.mockReturnValue({
      X_OAUTH_CLIENT_SECRET: "test-secret",
      X_OAUTH_TOKEN_URL: "https://x.test/token",
      X_OAUTH_USERINFO_URL: "https://x.test/me",
      ADMIN_SEED_EMAIL: "admin@seed.test",
      ADMIN_SEED_X_USER_ID: "",
      ADMIN_SEED_X_USERNAME: "@Seed_Admin_X",
      ADMIN_X_USERNAMES: "",
      ALLOW_ANY_X_USER_LOGIN: "false",
      NODE_ENV: "test"
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
          data: {
            id: "999888777",
            username: "seed_admin_x",
            name: "Seed Admin"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );
    expect(response.headers.get("location")).toContain("/admin");
    expect(identityMocks.ensureSeededGlobalAdmin).toHaveBeenCalledWith("admin@seed.test");
    expect(identityMocks.linkXAccountToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        xUserId: "999888777",
        username: "seed_admin_x"
      })
    );
  });

  it("accepts handle mistakenly stored in ADMIN_SEED_X_USER_ID when X omits email", async () => {
    envMocks.getEnv.mockReturnValue({
      X_OAUTH_CLIENT_SECRET: "test-secret",
      X_OAUTH_TOKEN_URL: "https://x.test/token",
      X_OAUTH_USERINFO_URL: "https://x.test/me",
      ADMIN_SEED_EMAIL: "admin@seed.test",
      ADMIN_SEED_X_USER_ID: "seed_admin_x",
      ADMIN_SEED_X_USERNAME: "",
      ADMIN_X_USERNAMES: "",
      ALLOW_ANY_X_USER_LOGIN: "false",
      NODE_ENV: "test"
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
          data: {
            id: "111222333",
            username: "seed_admin_x",
            name: "Seed Admin"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );
    expect(response.headers.get("location")).toContain("/admin");
    expect(identityMocks.ensureSeededGlobalAdmin).toHaveBeenCalledWith("admin@seed.test");
  });
});
