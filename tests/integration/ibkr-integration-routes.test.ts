import { NextResponse } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IBKR_CORRELATION_ID_HEADER } from "@/modules/ibkr-integration/ibkr-correlation";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const cookiesGet = vi.hoisted(() => vi.fn());

const consentMocks = vi.hoisted(() => ({
  getIbkrConsent: vi.fn(),
  upsertIbkrConsent: vi.fn(),
  ensureIbkrConsentIndexes: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireApprovedAppUserSession: authMocks.requireApprovedAppUserSession
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => cookiesGet(name)
  }))
}));

vi.mock("@/modules/ibkr-integration/consent-repository", () => consentMocks);

describe("IBKR integration API routes", () => {
  const savedIbkrEnv: Record<string, string | undefined> = {};

  const sessionUser = {
    userId: "507f1f77bcf86cd799439011",
    email: "u@example.com",
    username: "u1",
    roles: ["viewer"] as string[],
    tenantId: "507f1f77bcf86cd799439022",
    tenantRole: "member",
    xUserId: "x1"
  };

  beforeAll(() => {
    for (const k of [
      "IBKR_ENABLED",
      "IBKR_CLIENT_PORTAL_BASE_URL",
      "IBKR_ALLOW_SESSION_COOKIE_BODY",
      "IBKR_USE_ENV_SESSION_COOKIE",
      "IBKR_CLIENT_PORTAL_SESSION_COOKIE"
    ]) {
      savedIbkrEnv[k] = process.env[k];
    }
    process.env.XAI_API_KEY = process.env.XAI_API_KEY || "test-xai";
    process.env.XAI_MANAGEMENT_API_KEY = process.env.XAI_MANAGEMENT_API_KEY || "test-mgmt";
    process.env.X_OAUTH_CLIENT_ID = process.env.X_OAUTH_CLIENT_ID || "id";
    process.env.X_OAUTH_CLIENT_SECRET = process.env.X_OAUTH_CLIENT_SECRET || "oauthsecretsecret";
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "0123456789abcdef0123456789abcdef";
    process.env.IBKR_ENABLED = "1";
    process.env.IBKR_CLIENT_PORTAL_BASE_URL = "https://localhost:5000";
    process.env.IBKR_ALLOW_SESSION_COOKIE_BODY = "1";
    process.env.IBKR_MAX_REQUESTS_PER_MINUTE = "300";
    delete process.env.IBKR_USE_ENV_SESSION_COOKIE;
    delete process.env.IBKR_CLIENT_PORTAL_SESSION_COOKIE;
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(savedIbkrEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  beforeEach(() => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue(sessionUser);
    cookiesGet.mockReset();
    consentMocks.getIbkrConsent.mockReset();
    consentMocks.upsertIbkrConsent.mockReset();
    consentMocks.ensureIbkrConsentIndexes.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("GET /api/integrations/ibkr/status returns flags", async () => {
    consentMocks.getIbkrConsent.mockResolvedValue(null);
    cookiesGet.mockReturnValue(undefined);
    const { GET } = await import("@/app/api/integrations/ibkr/status/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const cid = res.headers.get(IBKR_CORRELATION_ID_HEADER);
    expect(cid).toBeTruthy();
    expect(cid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    const json = (await res.json()) as {
      data: { enabled: boolean; gatewayConfigured: boolean; consentRecorded: boolean };
    };
    expect(json.data.enabled).toBe(true);
    expect(json.data.gatewayConfigured).toBe(true);
    expect(json.data.consentRecorded).toBe(false);
  });

  it("POST /api/integrations/ibkr/consent records acceptance", async () => {
    consentMocks.upsertIbkrConsent.mockResolvedValue({
      consentedAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    } as never);
    const { POST } = await import("@/app/api/integrations/ibkr/consent/route");
    const res = await POST(
      new Request("http://test/api/integrations/ibkr/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true })
      })
    );
    expect(res.status).toBe(200);
    expect(consentMocks.upsertIbkrConsent).toHaveBeenCalled();
  });

  it("GET /api/integrations/ibkr/accounts proxies portfolio/accounts", async () => {
    consentMocks.getIbkrConsent.mockResolvedValue({
      consentedAt: new Date()
    } as never);
    const secret = "0123456789abcdef0123456789abcdef";
    const { sealIbkrCpSessionCookie } = await import("@/modules/ibkr-integration/session-seal");
    const sealed = sealIbkrCpSessionCookie("cp=test", secret);
    cookiesGet.mockImplementation((name: string) =>
      name === "xf_ibkr_cp_session" ? { value: sealed } : undefined
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ id: "U1", displayName: "Acct" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { GET } = await import("@/app/api/integrations/ibkr/accounts/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get(IBKR_CORRELATION_ID_HEADER)).toBeTruthy();
    const json = (await res.json()) as {
      data: { accounts: Array<{ id: string; displayLabel: string }> };
    };
    expect(json.data.accounts[0]).toMatchObject({ id: "U1", displayLabel: "Acct" });
    expect(fetch).toHaveBeenCalledWith(
      "https://localhost:5000/v1/api/portfolio/accounts",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Cookie: "cp=test" })
      })
    );
  });

  it("returns 401 when accounts requested without session material", async () => {
    consentMocks.getIbkrConsent.mockResolvedValue({ consentedAt: new Date() } as never);
    cookiesGet.mockReturnValue(undefined);
    const { GET } = await import("@/app/api/integrations/ibkr/accounts/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not consented", async () => {
    consentMocks.getIbkrConsent.mockResolvedValue({ consentedAt: null } as never);
    const { GET } = await import("@/app/api/integrations/ibkr/accounts/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET /api/integrations/ibkr/accounts/:accountId/snapshot bundles CP reads", async () => {
    consentMocks.getIbkrConsent.mockResolvedValue({
      consentedAt: new Date()
    } as never);
    const secret = "0123456789abcdef0123456789abcdef";
    const { sealIbkrCpSessionCookie } = await import("@/modules/ibkr-integration/session-seal");
    const sealed = sealIbkrCpSessionCookie("cp=test", secret);
    cookiesGet.mockImplementation((name: string) =>
      name === "xf_ibkr_cp_session" ? { value: sealed } : undefined
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/v1/api/portfolio/accounts")) {
          return Promise.resolve(
            new Response(JSON.stringify([{ id: "U1", displayName: "Paper" }]), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
        if (url.includes("/v1/api/portfolio/U1/summary")) {
          return Promise.resolve(
            new Response(JSON.stringify({ totalcashvalue: 1000 }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
        if (url.includes("/v1/api/portfolio2/U1/positions")) {
          return Promise.resolve(new Response(null, { status: 404 }));
        }
        if (url.includes("/v1/api/portfolio/U1/positions/0")) {
          return Promise.resolve(
            new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
        if (url.includes("/v1/api/iserver/account") && method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ set: true, acctId: "U1" }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
        if (url.includes("/v1/api/iserver/account/orders")) {
          return Promise.resolve(
            new Response(JSON.stringify({ orders: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
        if (url.includes("/v1/api/iserver/account/trades")) {
          return Promise.resolve(
            new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
        return Promise.resolve(new Response(`unexpected ${method} ${url}`, { status: 599 }));
      })
    );

    const { GET } = await import("@/app/api/integrations/ibkr/accounts/[accountId]/snapshot/route");
    const res = await GET(new Request("http://test/api/integrations/ibkr/accounts/U1/snapshot?days=7"), {
      params: Promise.resolve({ accountId: "U1" })
    });
    expect(res.status).toBe(200);
    expect(res.headers.get(IBKR_CORRELATION_ID_HEADER)).toBeTruthy();
    const json = (await res.json()) as {
      data: { summary: { totalcashvalue: number }; positionsSource: string };
    };
    expect(json.data.summary.totalcashvalue).toBe(1000);
    expect(json.data.positionsSource).toBe("positions_paged");
  });

  it("blocks session POST when unauthenticated", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const { POST } = await import("@/app/api/integrations/ibkr/session/route");
    const res = await POST(
      new Request("http://test/api/integrations/ibkr/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientPortalCookie: "x=1" })
      })
    );
    expect(res.status).toBe(401);
  });
});
