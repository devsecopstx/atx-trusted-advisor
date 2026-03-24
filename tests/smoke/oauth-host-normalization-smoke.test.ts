import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  createCodeChallenge: vi.fn(() => "challenge"),
  createCodeVerifier: vi.fn(() => "verifier"),
  createOAuthState: vi.fn(() => "state"),
  applyOAuthFlowCookiesToRedirect: vi.fn(),
  applyOAuthReturnPathCookie: vi.fn(),
  isSafeOAuthReturnPath: vi.fn(
    (path: string) => path.startsWith("/") && !path.startsWith("//") && !path.includes("..")
  ),
  consumeOAuthReturnPathCookie: vi.fn(),
  readOAuthFlowCookies: vi.fn(),
  clearOAuthFlowCookies: vi.fn(),
  getSessionUser: vi.fn(),
  createSession: vi.fn(),
  setPendingXLinkCookie: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  getXOauthClientId: vi.fn(),
  getAtxfinanceBackendOrigin: vi.fn(() => undefined)
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserByXIdentity: vi.fn(),
  getCoreUserByEmail: vi.fn(),
  linkXAccountToUser: vi.fn(),
  ensureDefaultTenant: vi.fn(),
  upsertTenantMembership: vi.fn(),
  resolveAuthContext: vi.fn(),
  ensureSeededGlobalAdmin: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/env", () => envMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);

import { GET as callbackGet } from "@/app/api/auth/x/callback/route";
import { GET as loginGet } from "@/app/api/auth/x/login/route";

describe("oauth host normalization smoke", () => {
  beforeEach(() => {
    envMocks.getEnv.mockReturnValue({
      NODE_ENV: "development",
      X_OAUTH_CLIENT_SECRET: "secret"
    });
    envMocks.getXOauthClientId.mockReturnValue("bWpuN2Vva1FNUG90U0dEVmZoRjA6MTpjaQ");
    authMocks.applyOAuthFlowCookiesToRedirect.mockImplementation(() => {});

    authMocks.readOAuthFlowCookies.mockResolvedValue({
      state: "state",
      verifier: "verifier"
    });
    authMocks.clearOAuthFlowCookies.mockResolvedValue(undefined);
    authMocks.getSessionUser.mockResolvedValue(null);
    authMocks.setPendingXLinkCookie.mockResolvedValue(undefined);
    authMocks.createSession.mockResolvedValue(undefined);

    identityMocks.getCoreUserByXIdentity.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      status: "active"
    });
    identityMocks.linkXAccountToUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      status: "active"
    });
    identityMocks.getCoreUserByEmail.mockResolvedValue(null);
    identityMocks.ensureDefaultTenant.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439022" }
    });
    identityMocks.upsertTenantMembership.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" }
    });
    identityMocks.resolveAuthContext.mockResolvedValue({
      userId: { toHexString: () => "507f1f77bcf86cd799439011" },
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      tenantRole: "tenant_admin",
      xUserId: "x-user-1",
      username: "adminuser"
    });
    identityMocks.ensureSeededGlobalAdmin.mockResolvedValue({
      user: {
        _id: { toHexString: () => "507f1f77bcf86cd799439011" },
        email: "admin@atxfinance.ai",
        roles: ["global_admin"],
        status: "active"
      }
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
            username: "adminuser",
            email: "admin@atxfinance.ai"
          }
        })
      }) as typeof fetch;
  });

  it("redirects localhost auth start to 127.0.0.1", async () => {
    const response = await loginGet(
      new Request("http://localhost:3000/api/auth/x/login")
    );
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/api/auth/x/login");
  });

  it("generates authorize URL with 127 callback in dev", async () => {
    const response = await loginGet(
      new Request("http://127.0.0.1:3000/api/auth/x/login")
    );
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("https://twitter.com/i/oauth2/authorize");
    expect(location).toContain(
      "redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fauth%2Fx%2Fcallback"
    );
  });

  it("redirects localhost callback to 127.0.0.1", async () => {
    const response = await callbackGet(
      new Request("http://localhost:3000/api/auth/x/callback?code=abc&state=state")
    );
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=state"
    );
  });

  it("forces canonical production host on login before oauth cookies", async () => {
    envMocks.getEnv.mockReturnValue({
      NODE_ENV: "production",
      X_OAUTH_CLIENT_SECRET: "secret",
      X_OAUTH_CALLBACK_URL: "https://atx.fintech-advisor.ai/api/auth/x/callback"
    });
    const response = await loginGet(
      new Request("https://www.fintech-advisor.ai/api/auth/x/login")
    );
    expect(response.headers.get("location")).toBe(
      "https://atx.fintech-advisor.ai/api/auth/x/login"
    );
  });

  it("forces canonical production host on callback before cookie checks", async () => {
    envMocks.getEnv.mockReturnValue({
      NODE_ENV: "production",
      X_OAUTH_CLIENT_SECRET: "secret",
      X_OAUTH_CALLBACK_URL: "https://atx.fintech-advisor.ai/api/auth/x/callback"
    });
    const response = await callbackGet(
      new Request(
        "https://www.fintech-advisor.ai/api/auth/x/callback?code=abc&state=state"
      )
    );
    expect(response.headers.get("location")).toBe(
      "https://atx.fintech-advisor.ai/api/auth/x/callback?code=abc&state=state"
    );
  });

});
