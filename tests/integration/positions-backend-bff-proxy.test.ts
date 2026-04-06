import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  upsertPositionForAccount: vi.fn(),
  deletePositionForAccount: vi.fn()
}));

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyPortfolioRequestToBackend: bffMocks.proxyPortfolioRequestToBackend
}));
vi.mock("@/lib/distributed-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distributed-rate-limit")>();
  return {
    ...actual,
    checkDistributedRateLimit: limitMocks.checkDistributedRateLimit,
    extractClientRateLimitKey: limitMocks.extractClientRateLimitKey
  };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    ...repositoryMocks
  };
});

import { DELETE as deletePosition } from "@/app/api/positions/[positionId]/route";
import { GET as getPositions, POST as postPosition } from "@/app/api/positions/route";

const portfolioId = "507f1f77bcf86cd799439033";
const accountId = "507f1f77bcf86cd799439099";
const positionId = "507f1f77bcf86cd799439055";

describe("positions API BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAtMs: Date.now() + 60_000,
      retryAfterSeconds: 60,
      source: "memory"
    });
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "u@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "user1"
    });
    repositoryMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: { toHexString: () => accountId },
        userId: "507f1f77bcf86cd799439011",
        portfolioId: { toHexString: () => portfolioId },
        name: "acct",
        type: "fidelity",
        extAccountId: "ext-1",
        cashBalance: 1000,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValue([]);
    repositoryMocks.upsertPositionForAccount.mockResolvedValue({
      _id: { toHexString: () => positionId },
      symbol: "AAPL",
      qty: 1,
      avgCost: 1
    });
    repositoryMocks.deletePositionForAccount.mockResolvedValue(true);
  });

  it("GET /api/positions returns the backend response when proxyPortfolioRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: [{ symbol: "MSFT" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(
      `http://test/api/positions?portfolioId=${portfolioId}&accountId=${accountId}`
    );
    const response = await getPositions(req);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: Array<{ symbol: string }> };
    expect(payload.data[0]?.symbol).toBe("MSFT");
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledTimes(1);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
    expect(repositoryMocks.listPortfolioPositionsByAccount).not.toHaveBeenCalled();
  });

  it("POST /api/positions returns the backend response when proxyPortfolioRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { symbol: "NVDA", qty: 2 } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId,
        accountId,
        symbol: "NVDA",
        qty: 2,
        avgCost: 10
      })
    });
    const response = await postPosition(req);

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { symbol: string } };
    expect(payload.data.symbol).toBe("NVDA");
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
    expect(repositoryMocks.upsertPositionForAccount).not.toHaveBeenCalled();
  });

  it("DELETE /api/positions/:id returns the backend response when proxyPortfolioRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(
      `http://test/api/positions/${positionId}?portfolioId=${portfolioId}&accountId=${accountId}`,
      { method: "DELETE" }
    );
    const response = await deletePosition(req, {
      params: Promise.resolve({ positionId })
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean };
    expect(payload.ok).toBe(true);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
    expect(repositoryMocks.deletePositionForAccount).not.toHaveBeenCalled();
  });

  it("GET /api/positions falls through to Next when proxy returns null", async () => {
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValueOnce([
      {
        _id: { toHexString: () => positionId },
        symbol: "IBM",
        qty: 1,
        avgCost: 1
      }
    ]);

    const req = new Request(
      `http://test/api/positions?portfolioId=${portfolioId}&accountId=${accountId}`
    );
    const response = await getPositions(req);

    expect(response.status).toBe(200);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    expect(sessionMocks.requireSessionUser).toHaveBeenCalled();
    expect(repositoryMocks.listPortfolioPositionsByAccount).toHaveBeenCalled();
  });

  it("GET /api/positions still returns 401 when proxy is off and session is missing", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new Request(
      `http://test/api/positions?portfolioId=${portfolioId}&accountId=${accountId}`
    );
    const response = await getPositions(req);
    expect(response.status).toBe(401);
  });

  it("DELETE /api/positions/:id returns 429 when limiter blocks request", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 15_000,
      retryAfterSeconds: 15,
      source: "memory"
    });
    const req = new Request(
      `http://test/api/positions/${positionId}?portfolioId=${portfolioId}&accountId=${accountId}`,
      { method: "DELETE" }
    );
    const response = await deletePosition(req, {
      params: Promise.resolve({ positionId })
    });
    expect(response.status).toBe(429);
    expect(bffMocks.proxyPortfolioRequestToBackend).not.toHaveBeenCalled();
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
  });
});
