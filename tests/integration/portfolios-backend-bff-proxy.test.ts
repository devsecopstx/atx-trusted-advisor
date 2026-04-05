import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const portfolioMocks = vi.hoisted(() => ({
  getDefaultPortfolio: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn(),
  getPortfolioByIdForSessionUser: vi.fn(),
  deletePortfolioForSessionUser: vi.fn()
}));

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: bffMocks.proxyPortfolioRequestToBackend
  };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/lib/portfolio-api-response", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portfolio-api-response")>(
    "@/lib/portfolio-api-response"
  );
  return {
    ...actual,
    buildPortfolioSummaryPayload: vi.fn().mockResolvedValue({ summary: true })
  };
});

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    getDefaultPortfolio: portfolioMocks.getDefaultPortfolio,
    listPortfolioAccounts: portfolioMocks.listPortfolioAccounts,
    provisionDefaultPortfolioForUser: portfolioMocks.provisionDefaultPortfolioForUser,
    getPortfolioByIdForSessionUser: portfolioMocks.getPortfolioByIdForSessionUser,
    deletePortfolioForSessionUser: portfolioMocks.deletePortfolioForSessionUser
  };
});

import {
    DELETE as deletePortfolioById,
    GET as getPortfolioById
} from "@/app/api/portfolios/[portfolioId]/route";
import { GET as getCurrentPortfolio } from "@/app/api/portfolios/current/route";
import { GET as getDefaultPortfolio, POST as postDefaultPortfolio } from "@/app/api/portfolios/default/route";

const portfolioId = "507f1f77bcf86cd799439033";

function expectProxyCalledLike(request: Request) {
  expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledTimes(1);
  const firstArg = bffMocks.proxyPortfolioRequestToBackend.mock.calls[0]?.[0];
  expect(firstArg).toBeInstanceOf(Request);
  const proxiedRequest = firstArg as Request;
  expect(proxiedRequest.method).toBe(request.method);
  expect(proxiedRequest.url).toBe(request.url);
}

describe("portfolios API BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "u@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "user1"
    });
    portfolioMocks.getDefaultPortfolio.mockResolvedValue({
      _id: { toHexString: () => portfolioId },
      name: "Default",
      isDefault: true
    });
    portfolioMocks.listPortfolioAccounts.mockResolvedValue([{ _id: { toHexString: () => "acc" } }]);
    portfolioMocks.getPortfolioByIdForSessionUser.mockResolvedValue({
      _id: { toHexString: () => portfolioId },
      name: "P",
      isDefault: true
    });
    portfolioMocks.deletePortfolioForSessionUser.mockResolvedValue({ ok: true as const });
  });

  it("GET /api/portfolios/default returns backend body when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { name: "remote" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/portfolios/default");
    const response = await getDefaultPortfolio(req);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { name: string } };
    expect(payload.data.name).toBe("remote");
    expectProxyCalledLike(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
  });

  it("POST /api/portfolios/default returns backend body when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { name: "remote" }, synced: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/portfolios/default", { method: "POST" });
    const response = await postDefaultPortfolio(req);

    expect(response.status).toBe(200);
    expectProxyCalledLike(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
  });

  it("GET /api/portfolios/current returns backend body when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { from: "spring" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/portfolios/current");
    const response = await getCurrentPortfolio(req);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { from: string } };
    expect(payload.data.from).toBe("spring");
    expectProxyCalledLike(req);
  });

  it("DELETE /api/portfolios/:id returns backend body when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/portfolios/${portfolioId}`, { method: "DELETE" });
    const response = await deletePortfolioById(req, { params: Promise.resolve({ portfolioId }) });

    expect(response.status).toBe(200);
    expectProxyCalledLike(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
    expect(portfolioMocks.deletePortfolioForSessionUser).not.toHaveBeenCalled();
  });

  it("DELETE /api/portfolios/:id falls through to Next when proxy returns 405", async () => {
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(new Response(null, { status: 405 }));

    const req = new Request(`http://test/api/portfolios/${portfolioId}`, { method: "DELETE" });
    const response = await deletePortfolioById(req, { params: Promise.resolve({ portfolioId }) });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean };
    expect(payload.ok).toBe(true);
    expectProxyCalledLike(req);
    expect(sessionMocks.requireSessionUser).toHaveBeenCalled();
    expect(portfolioMocks.deletePortfolioForSessionUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId
    });
  });

  it("GET /api/portfolios/:id returns backend body when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { id: portfolioId } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/portfolios/${portfolioId}`);
    const response = await getPortfolioById(req, { params: Promise.resolve({ portfolioId }) });

    expect(response.status).toBe(200);
    expectProxyCalledLike(req);
    expect(sessionMocks.requireSessionUser).not.toHaveBeenCalled();
  });

  it("GET /api/portfolios/default falls through when proxy returns null", async () => {
    const req = new Request("http://test/api/portfolios/default");
    const response = await getDefaultPortfolio(req);

    expect(response.status).toBe(200);
    expectProxyCalledLike(req);
    expect(sessionMocks.requireSessionUser).toHaveBeenCalled();
  });

  it("GET /api/portfolios/default returns 401 when proxy is off and session is missing", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new Request("http://test/api/portfolios/default");
    const response = await getDefaultPortfolio(req);
    expect(response.status).toBe(401);
  });
});
