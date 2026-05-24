import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getHotPicks } from "@/app/api/portfolios/hot-picks/route";

const mockRequireSessionUser = vi.fn();
const mockCanUserLogin = vi.fn();
const mockProxyPortfolioRequestToBackend = vi.fn();
const mockRunHotPicksScanNextFallback = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireSessionUser: (...args: unknown[]) => mockRequireSessionUser(...args)
}));

vi.mock("@/modules/identity/authorization", () => ({
  canUserLogin: (...args: unknown[]) => mockCanUserLogin(...args)
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyPortfolioRequestToBackend: (...args: unknown[]) => mockProxyPortfolioRequestToBackend(...args)
}));

vi.mock("@/modules/portfolios/hot-picks-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/portfolios/hot-picks-service")>();
  return {
    ...actual,
    runHotPicksScanNextFallback: (...args: unknown[]) => mockRunHotPicksScanNextFallback(...args)
  };
});

describe("GET /api/portfolios/hot-picks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanUserLogin.mockReturnValue(true);
    mockRequireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439012",
      roles: ["advisor"]
    });
    mockProxyPortfolioRequestToBackend.mockResolvedValue(null);
    mockRunHotPicksScanNextFallback.mockResolvedValue({
      picks: [],
      meta: {
        scope: "watchlist",
        bias: "balanced",
        portfolioId: null,
        minEdgeScore: 60,
        maxEdgeScore: 90,
        dteMin: 7,
        dteMax: 21,
        symbolCount: 0,
        symbols: [],
        cachedAt: new Date().toISOString(),
        cacheTtlSeconds: 3600,
        cacheHit: false
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without session", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireSessionUser.mockResolvedValue(new NextResponse(null, { status: 401 }));
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when role cannot login", async () => {
    mockCanUserLogin.mockReturnValue(false);
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks"));
    expect(res.status).toBe(403);
  });

  it("proxies to backend when BFF returns picks", async () => {
    mockProxyPortfolioRequestToBackend.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            picks: [{ id: "SPY:2026-06-19:covered_call:500", symbol: "SPY", edgeScore: 72 }],
            meta: {}
          }
        }),
        { status: 200 }
      )
    );
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks?scope=watchlist"));
    expect(res.status).toBe(200);
    expect(mockRunHotPicksScanNextFallback).not.toHaveBeenCalled();
  });

  it("falls back when BFF returns 200 with empty picks", async () => {
    mockProxyPortfolioRequestToBackend.mockResolvedValue(
      new Response(JSON.stringify({ data: { picks: [], meta: {} } }), { status: 200 })
    );
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks?scope=watchlist"));
    expect(res.status).toBe(200);
    expect(mockRunHotPicksScanNextFallback).toHaveBeenCalled();
  });

  it("falls back to Next scan when BFF is off", async () => {
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks?scope=watchlist"));
    expect(res.status).toBe(200);
    expect(mockRunHotPicksScanNextFallback).toHaveBeenCalled();
    const body = (await res.json()) as { data?: { meta?: { scope?: string } } };
    expect(body.data?.meta?.scope).toBe("watchlist");
  });

  it("falls back to Next scan when BFF returns 503", async () => {
    mockProxyPortfolioRequestToBackend.mockResolvedValue(
      new Response(JSON.stringify({ error: "chain_unavailable" }), { status: 503 })
    );
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks?scope=watchlist"));
    expect(res.status).toBe(200);
    expect(mockRunHotPicksScanNextFallback).toHaveBeenCalled();
  });

  it("returns 400 for invalid query", async () => {
    const res = await getHotPicks(new Request("http://test/api/portfolios/hot-picks?scope=bad"));
    expect(res.status).toBe(400);
  });
});
