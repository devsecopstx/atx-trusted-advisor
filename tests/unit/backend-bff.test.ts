import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAtxfinanceBackendBff } from "@/lib/backend-bff";

describe("createAtxfinanceBackendBff", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
  let origin: string | undefined;

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    origin = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null and does not fetch when origin is undefined", async () => {
    const bff = createAtxfinanceBackendBff(() => origin);
    const req = new Request("http://next.local/api/portfolios/p1?q=1");
    await expect(bff.proxyRequest(req)).resolves.toBeNull();
    expect(bff.getOrigin()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards GET path and query to origin with cookie and accept", async () => {
    origin = "http://127.0.0.1:8080";
    const bff = createAtxfinanceBackendBff(() => origin);
    const req = new Request("http://next.local/api/portfolios/p1?q=1", {
      headers: {
        cookie: "xf_core_session=abc",
        accept: "application/json"
      }
    });
    const res = await bff.proxyRequest(req);
    expect(res?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:8080/api/portfolios/p1?q=1");
    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { duplex?: string }) | undefined;
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("manual");
    expect(init?.body).toBeUndefined();
    expect(init?.duplex).toBeUndefined();
    const h = init?.headers as Headers;
    expect(h.get("cookie")).toBe("xf_core_session=abc");
    expect(h.get("accept")).toBe("application/json");
  });

  it("forwards POST body with duplex and content-type", async () => {
    origin = "http://127.0.0.1:8080";
    const bff = createAtxfinanceBackendBff(() => origin);
    const req = new Request("http://next.local/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "a=b" },
      body: JSON.stringify({ x: 1 })
    });
    await bff.proxyRequest(req);
    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { duplex?: string }) | undefined;
    expect(init?.method).toBe("POST");
    expect(init?.duplex).toBe("half");
    expect(init?.body).toBe(req.body);
    const h = init?.headers as Headers;
    expect(h.get("content-type")).toBe("application/json");
  });

  it("does not forward content-type when absent on GET", async () => {
    origin = "http://127.0.0.1:8080";
    const bff = createAtxfinanceBackendBff(() => origin);
    await bff.proxyRequest(new Request("http://next.local/api/health"));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const h = init?.headers as Headers;
    expect(h.has("content-type")).toBe(false);
  });
});

describe("proxyRequestToBackend (default BFF, env)", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
  });

  afterEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    vi.unstubAllGlobals();
  });

  it("uses ATXFINANCE_BACKEND_ORIGIN when set", async () => {
    process.env.ATXFINANCE_BACKEND_ORIGIN = "http://127.0.0.1:8080";
    vi.resetModules();
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    await proxyRequestToBackend(new Request("http://next/api/health"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:8080/api/health");
  });

  it("returns null when ATXFINANCE_BACKEND_ORIGIN is unset", async () => {
    vi.resetModules();
    const { proxyRequestToBackend } = await import("@/lib/backend-bff");
    await expect(proxyRequestToBackend(new Request("http://next/api/health"))).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("proxyPortfolioRequestToBackend (watchlist routing)", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://kotlin-backend.example.run.app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not forward app-user portfolio watchlist (GET)", async () => {
    const { proxyPortfolioRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request(
      "http://next.local/api/portfolios/507f1f77bcf86cd799439011/watchlist?quotes=1"
    );
    await expect(proxyPortfolioRequestToBackend(req)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards app-user portfolio watchlist PATCH when BFF gate is on", async () => {
    vi.resetModules();
    const { proxyPortfolioRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request("http://next.local/api/portfolios/507f1f77bcf86cd799439011/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSymbols: ["NVDA"] })
    });
    await proxyPortfolioRequestToBackend(req);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://kotlin-backend.example.run.app/api/portfolios/507f1f77bcf86cd799439011/watchlist"
    );
  });

  it("still forwards portfolio root GET", async () => {
    const { proxyPortfolioRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request("http://next.local/api/portfolios/507f1f77bcf86cd799439011");
    await proxyPortfolioRequestToBackend(req);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/portfolios/507f1f77bcf86cd799439011");
  });
});

describe("proxyAdminUsersRequestToBackend (Next-first tenants + user list)", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://kotlin-backend.example.run.app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
  });

  it("does not forward GET /api/admin/tenants", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(new Request("https://next.local/api/admin/tenants"))
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not forward GET /api/admin/users (tenantMemberships stay on Next)", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(new Request("https://next.local/api/admin/users?limit=50"))
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still forwards GET /api/admin/users/approved", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await proxyAdminUsersRequestToBackend(new Request("https://next.local/api/admin/users/approved"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://kotlin-backend.example.run.app/api/admin/users/approved");
  });

  it("does not forward GET /api/admin/login-audit", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(new Request("https://next.local/api/admin/login-audit"))
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not forward GET /api/admin/audit", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(
        new Request("https://next.local/api/admin/audit?entityType=admin_portfolio&limit=10")
      )
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not forward POST /api/admin/users/{userId}/metered-usage/reset (Mongo-only)", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(
        new Request("https://next.local/api/admin/users/507f1f77bcf86cd799439033/metered-usage/reset", {
          method: "POST"
        })
      )
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not forward POST /api/admin/users/{userId}/resend-credential-invite (Mongo + desk SMTP)", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(
        new Request("https://next.local/api/admin/users/507f1f77bcf86cd799439033/resend-credential-invite", {
          method: "POST"
        })
      )
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not forward GET /api/admin/portfolios/{id}/watchlist (desk fields stay on Next Mongo)", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    await expect(
      proxyAdminUsersRequestToBackend(
        new Request("https://next.local/api/admin/portfolios/507f1f77bcf86cd799439033/watchlist")
      )
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards PATCH /api/admin/portfolios/{id}/watchlist when BFF gate is on", async () => {
    vi.resetModules();
    const { proxyAdminUsersRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request("https://next.local/api/admin/portfolios/507f1f77bcf86cd799439033/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSymbols: ["AAPL"] })
    });
    await proxyAdminUsersRequestToBackend(req);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const target = fetchMock.mock.calls[0][0];
    const url = typeof target === "string" ? target : (target as Request).url;
    expect(url).toContain("https://kotlin-backend.example.run.app/api/admin/portfolios/507f1f77bcf86cd799439033/watchlist");
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    expect((init?.method ?? "GET").toUpperCase()).toBe("PATCH");
  });
});

describe("proxyAdminAccessRequestsRequestToBackend (Spring BFF)", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://kotlin-backend.example.run.app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
  });

  it("forwards PUT /api/admin/access-requests/{id} when BFF gate is on", async () => {
    vi.resetModules();
    const { proxyAdminAccessRequestsRequestToBackend } = await import("@/lib/backend-bff");
    const req = new Request("https://next.local/api/admin/access-requests/507f1f77bcf86cd799439022", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        requestedPlan: "basic",
        requestedRole: "operator",
        targetTenantId: "507f1f77bcf86cd799439033"
      })
    });
    const proxied = await proxyAdminAccessRequestsRequestToBackend(req);
    expect(proxied).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const target = fetchMock.mock.calls[0][0];
    const url = typeof target === "string" ? target : (target as Request).url;
    expect(url).toContain("https://kotlin-backend.example.run.app/api/admin/access-requests/");
    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    expect((init?.method ?? "GET").toUpperCase()).toBe("PUT");
  });

  it("forwards GET /api/admin/access-requests when BFF gate is on", async () => {
    vi.resetModules();
    const { proxyAdminAccessRequestsRequestToBackend } = await import("@/lib/backend-bff");
    const proxied = await proxyAdminAccessRequestsRequestToBackend(
      new Request("https://next.local/api/admin/access-requests?status=open")
    );
    expect(proxied).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const target = fetchMock.mock.calls[0][0];
    const url = typeof target === "string" ? target : (target as Request).url;
    expect(url).toContain("kotlin-backend.example.run.app/api/admin/access-requests?status=open");
  });
});

describe("getStrategyJobsBffUnavailableMessage", () => {
  const savedOrigin = process.env.ATXFINANCE_BACKEND_ORIGIN;

  afterEach(() => {
    if (savedOrigin === undefined) {
      delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    } else {
      process.env.ATXFINANCE_BACKEND_ORIGIN = savedOrigin;
    }
  });

  it("when origin unset, points at ATXFINANCE_BACKEND_ORIGIN", async () => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    const { getStrategyJobsBffUnavailableMessage } = await import("@/lib/backend-bff");
    expect(getStrategyJobsBffUnavailableMessage()).toContain("ATXFINANCE_BACKEND_ORIGIN");
  });

  it("when origin set on loopback, hints loopback/dev BFF skip", async () => {
    process.env.ATXFINANCE_BACKEND_ORIGIN = "http://127.0.0.1:8080";
    const { getStrategyJobsBffUnavailableMessage } = await import("@/lib/backend-bff");
    expect(getStrategyJobsBffUnavailableMessage()).toMatch(/BFF|development|localhost/i);
  });
});
