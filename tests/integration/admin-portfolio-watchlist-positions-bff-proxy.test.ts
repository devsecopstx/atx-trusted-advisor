import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));

vi.mock("@/lib/api-auth", () => authMocks);

import { GET as getAdminWatchlist, PATCH as patchAdminWatchlist } from "@/app/api/admin/portfolios/[portfolioId]/watchlist/route";
import {
    GET as getAdminPositions,
    POST as postAdminPositions
} from "@/app/api/admin/portfolios/[portfolioId]/accounts/[accountId]/positions/route";

const portfolioId = "507f1f77bcf86cd799439033";
const accountId = "507f1f77bcf86cd799439044";

describe("admin portfolio watchlist + positions BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "admin1"
    });
  });

  it("GET …/watchlist returns backend body when proxy resolves", async () => {
    const proxied = new Response(JSON.stringify({ data: { portfolioId, symbols: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`);
    const res = await getAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });

    expect(res.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("PATCH …/watchlist returns backend body when proxy resolves", async () => {
    const proxied = new Response(JSON.stringify({ data: { symbols: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSymbols: ["AAPL"] })
    });
    const res = await patchAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });

    expect(res.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("GET …/positions returns backend body when proxy resolves", async () => {
    const proxied = new Response(JSON.stringify({ data: { positions: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}/positions`
    );
    const res = await getAdminPositions(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });

    expect(res.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("POST …/positions returns backend body when proxy resolves", async () => {
    const proxied = new Response(JSON.stringify({ data: { _id: "x", type: "stock" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}/positions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stock", symbol: "TSLA", shares: 1, purchasePrice: 100 })
      }
    );
    const res = await postAdminPositions(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });

    expect(res.status).toBe(201);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });
});
