import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  readOAuthFlowCookies: vi.fn(),
  clearOAuthFlowCookies: vi.fn(),
  getSessionUser: vi.fn()
}));

const envMocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  getAtxfinanceBackendOrigin: vi.fn(() => undefined)
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/env", () => envMocks);

import { GET as callbackGet } from "@/app/api/auth/x/callback/route";

describe("oauth callback early error redirects", () => {
  beforeEach(() => {
    envMocks.getEnv.mockReturnValue({
      NODE_ENV: "development",
      X_OAUTH_CLIENT_SECRET: "secret"
    });
    authMocks.clearOAuthFlowCookies.mockResolvedValue(undefined);
    authMocks.getSessionUser.mockResolvedValue(null);
  });

  it("redirects to login when code and state are both missing", async () => {
    const response = await callbackGet(
      new Request("http://127.0.0.1:3000/api/auth/x/callback")
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/login?error=missing_oauth_callback_params"
    );
  });

  it("redirects to login when code is missing", async () => {
    const response = await callbackGet(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?state=only")
    );
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/login?error=missing_oauth_callback_params"
    );
  });

  it("redirects to login when state is missing", async () => {
    const response = await callbackGet(
      new Request("http://127.0.0.1:3000/api/auth/x/callback?code=only")
    );
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/login?error=missing_oauth_callback_params"
    );
  });

  it("redirects to login when oauth state does not match cookie context", async () => {
    authMocks.readOAuthFlowCookies.mockResolvedValue({
      state: "from-cookie",
      verifier: "verifier"
    });
    const response = await callbackGet(
      new Request(
        "http://127.0.0.1:3000/api/auth/x/callback?code=abc&state=from-url"
      )
    );
    expect(authMocks.clearOAuthFlowCookies).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/login?error=invalid_oauth_state"
    );
  });
});
