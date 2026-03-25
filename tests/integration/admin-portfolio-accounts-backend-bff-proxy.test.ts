import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminGetPortfolioById: vi.fn(),
  adminListAccountsForPortfolio: vi.fn()
}));

const getCoreUsersByIdsMock = vi.hoisted(() =>
  vi.fn<typeof import("@/modules/identity/repository").getCoreUsersByIds>()
);

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));

vi.mock("@/lib/api-auth", () => authMocks);

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getCoreUsersByIds: getCoreUsersByIdsMock
  };
});

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    ...repoMocks
  };
});

import {
    DELETE as deleteAdminAccount,
    PATCH as patchAdminAccount
} from "@/app/api/admin/portfolios/[portfolioId]/accounts/[accountId]/route";
import { GET as getAdminAccounts, POST as postAdminAccount } from "@/app/api/admin/portfolios/[portfolioId]/accounts/route";

const portfolioId = "507f1f77bcf86cd799439033";
const accountId = "507f1f77bcf86cd799439044";

describe("admin portfolio accounts API BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCoreUsersByIdsMock.mockResolvedValue(new Map());
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
    const pid = new ObjectId(portfolioId);
    repoMocks.adminGetPortfolioById.mockResolvedValue({
      _id: pid,
      name: "P1",
      userId: "507f1f77bcf86cd799439011",
      tenantPortfolioOrgKey: "org",
      riskProfile: null,
      outlook: null
    });
    repoMocks.adminListAccountsForPortfolio.mockResolvedValue([]);
  });

  it("GET …/accounts returns the backend response when proxyRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { accountCount: 0, accounts: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts`);
    const response = await getAdminAccounts(req, { params: Promise.resolve({ portfolioId }) });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { accountCount: number } };
    expect(payload.data.accountCount).toBe(0);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
    expect(repoMocks.adminGetPortfolioById).not.toHaveBeenCalled();
  });

  it("POST …/accounts returns the backend response when proxyRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { _id: accountId, name: "New" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New" })
    });
    const response = await postAdminAccount(req, { params: Promise.resolve({ portfolioId }) });

    expect(response.status).toBe(201);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("PATCH …/accounts/:id returns the backend response when proxyRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { _id: accountId, name: "Renamed" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed" })
    });
    const response = await patchAdminAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });

    expect(response.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("DELETE …/accounts/:id returns the backend response when proxyRequestToBackend resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`, {
      method: "DELETE"
    });
    const response = await deleteAdminAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });

    expect(response.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("GET …/accounts falls through to Next when proxy returns null", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts`);
    const response = await getAdminAccounts(req, { params: Promise.resolve({ portfolioId }) });

    expect(response.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).toHaveBeenCalled();
    expect(repoMocks.adminGetPortfolioById).toHaveBeenCalled();
    expect(repoMocks.adminListAccountsForPortfolio).toHaveBeenCalled();
  });

  it("GET …/accounts returns 401 when proxy is off and admin session is missing", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts`);
    const response = await getAdminAccounts(req, { params: Promise.resolve({ portfolioId }) });
    expect(response.status).toBe(401);
  });
});
