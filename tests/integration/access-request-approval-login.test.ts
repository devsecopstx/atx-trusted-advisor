import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "507f1f77bcf86cd799439011",
  userRoles: [] as string[],
  accessRequestStatus: "pending" as "pending" | "approved" | "rejected"
}));

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn(),
  readOAuthFlowCookies: vi.fn(),
  clearOAuthFlowCookies: vi.fn(),
  getSessionUser: vi.fn(),
  createSession: vi.fn(),
  setPendingXLinkCookie: vi.fn(),
  consumeOAuthReturnPathCookie: vi.fn(),
  isSafeOAuthReturnPath: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  getAccessRequestById: vi.fn(),
  reviewAccessRequestById: vi.fn(),
  listAccessRequests: vi.fn(),
  createAccessRequest: vi.fn(),
  getPendingAccessRequestByUserAndRole: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  addRoleToCoreUser: vi.fn(),
  updateCoreUserSubscriptionPlan: vi.fn(),
  getCoreUserById: vi.fn(),
  getCoreUserByXIdentity: vi.fn(),
  getCoreUserByEmail: vi.fn(),
  unlinkXAccountFromUser: vi.fn(),
  linkXAccountToUser: vi.fn(),
  ensureDefaultTenant: vi.fn(),
  upsertTenantMembership: vi.fn(),
  resolveAuthContext: vi.fn(),
  ensureCoreUserByEmail: vi.fn(),
  ensureSeededGlobalAdmin: vi.fn(),
  recordUserSuccessfulLogin: vi.fn().mockResolvedValue(undefined)
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn(),
  listLatestAuditEventsForEntities: vi.fn(),
  listAuditEventsForEntity: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  enqueueAccessRequestBootstrap: vi.fn(),
  resolveOrCreateUserBootstrapCollection: vi.fn().mockResolvedValue({
    collectionId: "collection_test_user_history",
    collectionName: "test-user-history"
  })
}));

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  getXOauthClientId: vi.fn(),
  isAllowAnyXUserLoginEnabled: vi.fn(),
  getAtxfinanceBackendOrigin: vi.fn(() => undefined)
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/lib/env", () => envMocks);
vi.mock("@/modules/identity/login-audit", () => ({
  appendLoginAuditRecord: vi.fn().mockResolvedValue(undefined)
}));

import { PATCH as patchAccessRequest } from "@/app/api/admin/access-requests/[requestId]/route";
import { GET as getAccessRequests } from "@/app/api/admin/access-requests/route";
import { GET as oauthCallback } from "@/app/api/auth/x/callback/route";

function makeUser() {
  return {
    _id: {
      toHexString: () => state.userId
    },
    email: "approved.user@atxfinance.ai",
    roles: [...state.userRoles],
    status: "active" as const
  };
}

describe("access request approval login flow", () => {
  beforeEach(() => {
    state.userRoles = [];
    state.accessRequestStatus = "pending";

    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439099",
      roles: ["global_admin"]
    });
    authMocks.readOAuthFlowCookies.mockResolvedValue({
      state: "state-token",
      verifier: "pkce-verifier"
    });
    authMocks.clearOAuthFlowCookies.mockResolvedValue(undefined);
    authMocks.getSessionUser.mockResolvedValue(null);
    authMocks.createSession.mockResolvedValue(undefined);
    authMocks.setPendingXLinkCookie.mockResolvedValue(undefined);
    authMocks.consumeOAuthReturnPathCookie.mockResolvedValue(null);
    authMocks.isSafeOAuthReturnPath.mockImplementation(
      (path: string) => path.startsWith("/") && !path.startsWith("//") && !path.includes("..")
    );

    coreAdminMocks.getAccessRequestById.mockImplementation(async () => ({
      _id: { toHexString: () => "507f1f77bcf86cd799439022" },
      userId: state.userId,
      requestedRole: "viewer",
      reason: "Needs authenticated access",
      status: state.accessRequestStatus,
      requestedAt: new Date()
    }));
    coreAdminMocks.reviewAccessRequestById.mockImplementation(async ({ status }) => {
      state.accessRequestStatus = status;
      return {
        _id: { toHexString: () => "507f1f77bcf86cd799439022" },
        userId: state.userId,
        requestedRole: "viewer",
        reason: "Needs authenticated access",
        status,
        requestedAt: new Date(),
        reviewedBy: "507f1f77bcf86cd799439099",
        reviewedAt: new Date()
      };
    });
    coreAdminMocks.listAccessRequests.mockResolvedValue([]);
    coreAdminMocks.createAccessRequest.mockImplementation(async () => ({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      userId: state.userId,
      requestedRole: "viewer",
      reason: "Auto-created from unapproved X login attempt",
      status: "pending",
      requestedAt: new Date()
    }));
    coreAdminMocks.getPendingAccessRequestByUserAndRole.mockResolvedValue(null);
    coreAdminMocks.provisionDefaultPortfolioForUser.mockResolvedValue({
      portfolio: { _id: { toHexString: () => "507f1f77bcf86cd799439081" } },
      account: { _id: { toHexString: () => "507f1f77bcf86cd799439082" } },
      watchlist: { _id: { toHexString: () => "507f1f77bcf86cd799439083" } }
    });

    identityMocks.addRoleToCoreUser.mockImplementation(async ({ role }) => {
      if (!state.userRoles.includes(role)) {
        state.userRoles.push(role);
      }
      return makeUser();
    });
    identityMocks.updateCoreUserSubscriptionPlan.mockImplementation(async () => makeUser());
    identityMocks.getCoreUserById.mockResolvedValue(makeUser());
    identityMocks.getCoreUserByXIdentity.mockResolvedValue(null);
    identityMocks.getCoreUserByEmail.mockImplementation(async () => makeUser());
    identityMocks.unlinkXAccountFromUser.mockResolvedValue(undefined);
    identityMocks.linkXAccountToUser.mockImplementation(async () => makeUser());
    identityMocks.ensureDefaultTenant.mockResolvedValue({
      _id: {
        toHexString: () => "507f1f77bcf86cd799439033"
      },
      slug: "atxfinance-core",
      name: "atxFinance Core",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    identityMocks.upsertTenantMembership.mockResolvedValue({
      _id: {
        toHexString: () => "507f1f77bcf86cd799439044"
      }
    });
    identityMocks.resolveAuthContext.mockImplementation(async () => ({
      userId: {
        toHexString: () => state.userId
      },
      email: "approved.user@atxfinance.ai",
      roles: [...state.userRoles],
      tenantId: {
        toHexString: () => "507f1f77bcf86cd799439033"
      },
      tenantRole: "member",
      xUserId: "x-user-1",
      username: "approved_user"
    }));
    identityMocks.ensureCoreUserByEmail.mockResolvedValue(makeUser());
    identityMocks.ensureSeededGlobalAdmin.mockResolvedValue({
      user: makeUser(),
      tenant: {
        _id: {
          toHexString: () => "507f1f77bcf86cd799439033"
        }
      },
      membership: {
        _id: {
          toHexString: () => "507f1f77bcf86cd799439044"
        }
      }
    });
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    auditMocks.listLatestAuditEventsForEntities.mockResolvedValue({});
    auditMocks.listAuditEventsForEntity.mockResolvedValue([]);
    bootstrapMocks.enqueueAccessRequestBootstrap.mockResolvedValue(undefined);

    envMocks.getEnv.mockReturnValue({
      X_OAUTH_CLIENT_SECRET: "test-secret",
      X_OAUTH_TOKEN_URL: "https://x.test/token",
      X_OAUTH_USERINFO_URL: "https://x.test/me",
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
            id: "x-user-1",
            username: "approved_user",
            email: "approved.user@atxfinance.ai"
          }
        })
      }) as typeof fetch;
  });

  it("blocks login before approval and allows login after approval", async () => {
    const beforeApprovalResponse = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );
    expect(beforeApprovalResponse.headers.get("location")).toContain(
      "/xchat?error=access_request_pending"
    );
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledTimes(1);

    const approvalResponse = await patchAccessRequest(
      new Request("http://127.0.0.1:3000/api/admin/access-requests/507f1f77bcf86cd799439022", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "approved"
        })
      }),
      {
        params: Promise.resolve({
          requestId: "507f1f77bcf86cd799439022"
        })
      }
    );
    expect(approvalResponse.status).toBe(200);
    expect(state.userRoles).toContain("viewer");
    expect(coreAdminMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledTimes(1);
    expect(bootstrapMocks.enqueueAccessRequestBootstrap).toHaveBeenCalledTimes(1);

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
            id: "x-user-1",
            username: "approved_user",
            email: "approved.user@atxfinance.ai"
          }
        })
      }) as typeof fetch;

    const afterApprovalResponse = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );
    expect(afterApprovalResponse.headers.get("location")).toContain("/xchat");
    expect(authMocks.createSession).toHaveBeenCalledTimes(1);
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("allows fallback login to xchat when ALLOW_ANY_X_USER_LOGIN is enabled", async () => {
    envMocks.getEnv.mockReturnValue({
      X_OAUTH_CLIENT_SECRET: "test-secret",
      X_OAUTH_TOKEN_URL: "https://x.test/token",
      X_OAUTH_USERINFO_URL: "https://x.test/me",
      ADMIN_X_USERNAMES: "",
      ALLOW_ANY_X_USER_LOGIN: "true",
      NODE_ENV: "test"
    });
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(true);

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
            id: "x-user-1",
            username: "approved_user",
            email: "approved.user@atxfinance.ai"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );

    expect(response.headers.get("location")).toContain("/xchat");
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledTimes(1);
    expect(coreAdminMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledTimes(1);
    expect(authMocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("falls back to viewer session when admin allowlist blocks a global admin and ALLOW_ANY_X_USER_LOGIN is enabled", async () => {
    state.userRoles = ["global_admin"];
    envMocks.getEnv.mockReturnValue({
      X_OAUTH_CLIENT_SECRET: "test-secret",
      X_OAUTH_TOKEN_URL: "https://x.test/token",
      X_OAUTH_USERINFO_URL: "https://x.test/me",
      ADMIN_X_USERNAMES: "atxbogart",
      ALLOW_ANY_X_USER_LOGIN: "true",
      NODE_ENV: "test"
    });
    envMocks.isAllowAnyXUserLoginEnabled.mockReturnValue(true);

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
            id: "x-user-1",
            username: "approved_user",
            email: "approved.user@atxfinance.ai"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );

    expect(response.headers.get("location")).toContain("/xchat");
    expect(authMocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ["viewer"]
      })
    );
  });

  it("treats legacy admin role as global admin during login redirect", async () => {
    state.userRoles = ["admin"];

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
            id: "x-user-1",
            username: "approved_user",
            email: "approved.user@atxfinance.ai"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );

    expect(response.headers.get("location")).toContain("/admin");
    expect(authMocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ["admin"]
      })
    );
  });

  it("relinks stale X identity to approved email user and redirects to admin", async () => {
    const staleUserId = "507f1f77bcf86cd7994390aa";
    const staleUser = {
      _id: {
        toHexString: () => staleUserId
      },
      email: "xlogin-x-user-1@x.oauth.local",
      roles: [] as string[],
      status: "active" as const
    };
    const approvedUser = {
      _id: {
        toHexString: () => state.userId
      },
      email: "approved.user@atxfinance.ai",
      roles: ["global_admin"],
      status: "active" as const
    };

    identityMocks.getCoreUserByXIdentity.mockResolvedValueOnce(staleUser);
    identityMocks.getCoreUserByEmail.mockResolvedValueOnce(approvedUser);
    identityMocks.linkXAccountToUser.mockImplementationOnce(async ({ userId }) => {
      if (userId.toHexString() === state.userId) {
        state.userRoles = ["global_admin"];
      }
      return makeUser();
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
            id: "x-user-1",
            username: "approved_user",
            email: "approved.user@atxfinance.ai"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );

    expect(identityMocks.unlinkXAccountFromUser).toHaveBeenCalledWith({
      userId: staleUser._id
    });
    expect(response.headers.get("location")).toContain("/admin");
  });

  it("allows non-admin authentication but denies admin API access", async () => {
    state.userRoles = ["viewer"];
    authMocks.requireSessionUser.mockResolvedValue({
      userId: state.userId,
      roles: ["viewer"]
    });

    const adminApiResponse = await getAccessRequests(
      new Request("http://127.0.0.1:3000/api/admin/access-requests?status=pending")
    );
    expect(adminApiResponse.status).toBe(403);
  });

  it("prompts email linking when X profile has no email", async () => {
    const placeholderUser = {
      _id: {
        toHexString: () => state.userId
      },
      email: "xlogin-x-user-1@x.oauth.local",
      roles: [] as string[],
      status: "active" as const
    };
    identityMocks.ensureCoreUserByEmail.mockResolvedValueOnce(placeholderUser);
    identityMocks.linkXAccountToUser.mockResolvedValueOnce(placeholderUser);

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
            id: "x-user-1",
            username: "approved_user"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );

    expect(response.headers.get("location")).toContain("/xchat?error=email_link_required");
    expect(identityMocks.ensureCoreUserByEmail).toHaveBeenCalledWith({
      email: "xlogin-x-user-1@x.oauth.local"
    });
    expect(authMocks.setPendingXLinkCookie).toHaveBeenCalledTimes(1);
    expect(coreAdminMocks.getPendingAccessRequestByUserAndRole).toHaveBeenCalledWith({
      userId: state.userId,
      requestedRole: "viewer"
    });
    expect(coreAdminMocks.createAccessRequest).toHaveBeenCalledWith({
      userId: state.userId,
      requestedRole: "viewer",
      reason:
        "Auto-created: X login without email on profile — user on link-email step (email_link_required)"
    });
  });

  it("completes OAuth to xchat when X has no email but admin already approved (placeholder email + viewer)", async () => {
    const approvedPlaceholder = {
      _id: {
        toHexString: () => state.userId
      },
      email: "xlogin-x-user-1@x.oauth.local",
      roles: ["viewer"] as string[],
      status: "active" as const
    };
    identityMocks.getCoreUserByXIdentity.mockResolvedValueOnce(approvedPlaceholder);
    identityMocks.linkXAccountToUser.mockResolvedValueOnce(approvedPlaceholder);
    authMocks.setPendingXLinkCookie.mockClear();

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
            id: "x-user-1",
            username: "approved_user"
          }
        })
      }) as typeof fetch;

    const response = await oauthCallback(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state-token")
    );

    expect(response.headers.get("location")).toContain("/xchat");
    expect(authMocks.createSession).toHaveBeenCalledTimes(1);
    expect(authMocks.setPendingXLinkCookie).not.toHaveBeenCalled();
  });

  it("returns 500 and does not review when provisioning fails", async () => {
    coreAdminMocks.provisionDefaultPortfolioForUser.mockRejectedValueOnce(
      new Error("provisioning failed")
    );

    const approvalResponse = await patchAccessRequest(
      new Request("http://127.0.0.1:3000/api/admin/access-requests/507f1f77bcf86cd799439022", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "approved"
        })
      }),
      {
        params: Promise.resolve({
          requestId: "507f1f77bcf86cd799439022"
        })
      }
    );

    expect(approvalResponse.status).toBe(500);
    expect(coreAdminMocks.reviewAccessRequestById).not.toHaveBeenCalled();
  });
});
