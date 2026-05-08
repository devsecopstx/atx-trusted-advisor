import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const portfolioAccessMocks = vi.hoisted(() => ({
  requirePortfolioForSessionUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  getPortfolioByIdForSessionUser: vi.fn()
}));

const priceAlertRepoMocks = vi.hoisted(() => ({
  listActivePortfolioPriceAlertsForUserPortfolio: vi.fn(),
  listActivePortfolioPriceAlertsForUser: vi.fn(),
  countActivePortfolioPriceAlertsForTenant: vi.fn(),
  upsertActivePortfolioPriceAlert: vi.fn(),
  expirePortfolioPriceAlertByIdForUser: vi.fn()
}));

const ensureTaskMocks = vi.hoisted(() => ({
  ensureUserAlertManagerScheduledTaskForTenant: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/lib/portfolio-access", () => portfolioAccessMocks);

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getCoreUserById: identityMocks.getCoreUserById
  };
});

vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    getPortfolioByIdForSessionUser: coreAdminMocks.getPortfolioByIdForSessionUser
  };
});

vi.mock("@/modules/price-alerts/portfolio-price-alerts-repository", () => priceAlertRepoMocks);

vi.mock("@/modules/price-alerts/ensure-user-alert-manager-task", () => ensureTaskMocks);

vi.mock("@/modules/audit/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/audit/repository")>();
  return {
    ...actual,
    createAuditEvent: auditMocks.createAuditEvent
  };
});

import { DELETE as deletePriceAlert } from "@/app/api/portfolios/[portfolioId]/price-alerts/[alertId]/route";
import { GET as getPriceAlerts, POST as postPriceAlerts } from "@/app/api/portfolios/[portfolioId]/price-alerts/route";

const portfolioHex = "507f1f77bcf86cd799439033";
const userHex = "507f1f77bcf86cd799439011";
const tenantHex = "507f1f77bcf86cd799439022";

describe("portfolio NL price-alerts API routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const bff = await import("@/lib/backend-bff");
    vi.mocked(bff.proxyPortfolioRequestToBackend).mockResolvedValue(null);

    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: userHex,
      tenantId: tenantHex,
      roles: ["global_admin"],
      email: "u@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "tester"
    });
    portfolioAccessMocks.requirePortfolioForSessionUser.mockResolvedValue(null);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    ensureTaskMocks.ensureUserAlertManagerScheduledTaskForTenant.mockResolvedValue(undefined);
  });

  it("GET lists serialized rows", async () => {
    const expiresAt = new Date("2026-06-01T00:00:00.000Z");
    const updatedAt = new Date("2026-05-02T12:00:00.000Z");
    const createdAt = new Date("2026-05-01T08:00:00.000Z");
    priceAlertRepoMocks.listActivePortfolioPriceAlertsForUserPortfolio.mockResolvedValue([
      {
        _id: new ObjectId(),
        userId: userHex,
        tenantId: new ObjectId(tenantHex),
        portfolioId: new ObjectId(portfolioHex),
        portfolioName: "IRA",
        symbol: "TSLA",
        symbolNorm: "TSLA",
        targetPriceUsd: 420,
        ruleKind: "above",
        lastReferencePrice: 400,
        status: "active",
        expiresAt,
        updatedAt,
        createdAt
      }
    ]);

    const res = await getPriceAlerts(new Request(`http://localhost/api/portfolios/${portfolioHex}/price-alerts`), {
      params: Promise.resolve({ portfolioId: portfolioHex })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ symbol: string; targetPriceUsd: number }> };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.symbol).toBe("TSLA");
    expect(json.data[0]?.targetPriceUsd).toBe(420);
  });

  it("POST returns 403 when plan blocks NL price alerts", async () => {
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: userHex,
      tenantId: tenantHex,
      roles: ["advisor"],
      email: "u@test.local",
      tenantRole: "member",
      xUserId: "x1",
      username: "tester"
    });
    identityMocks.getCoreUserById.mockResolvedValue({ subscriptionPlan: "basic" } as never);

    const res = await postPriceAlerts(
      new Request(`http://localhost/api/portfolios/${portfolioHex}/price-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "TSLA", targetPriceUsd: 420, ruleKind: "above" })
      }),
      { params: Promise.resolve({ portfolioId: portfolioHex }) }
    );
    expect(res.status).toBe(403);
  });

  it("POST returns 201 when upsert succeeds", async () => {
    identityMocks.getCoreUserById.mockResolvedValue({ subscriptionPlan: "premium_plus" } as never);
    coreAdminMocks.getPortfolioByIdForSessionUser.mockResolvedValue({
      _id: new ObjectId(portfolioHex),
      name: "Book A"
    } as never);
    priceAlertRepoMocks.listActivePortfolioPriceAlertsForUser.mockResolvedValue([]);
    priceAlertRepoMocks.countActivePortfolioPriceAlertsForTenant.mockResolvedValue(0);
    const oid = new ObjectId();
    const now = new Date();
    priceAlertRepoMocks.upsertActivePortfolioPriceAlert.mockResolvedValue({
      replaced: false,
      doc: {
        _id: oid,
        userId: userHex,
        tenantId: new ObjectId(tenantHex),
        portfolioId: new ObjectId(portfolioHex),
        portfolioName: "Book A",
        symbol: "NVDA",
        symbolNorm: "NVDA",
        targetPriceUsd: 140,
        ruleKind: "below",
        status: "active",
        expiresAt: new Date(now.getTime() + 86_400_000),
        updatedAt: now,
        createdAt: now
      }
    });

    const res = await postPriceAlerts(
      new Request(`http://localhost/api/portfolios/${portfolioHex}/price-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "nvda", targetPriceUsd: 140, ruleKind: "below" })
      }),
      { params: Promise.resolve({ portfolioId: portfolioHex }) }
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string } };
    expect(json.data.id).toBe(oid.toHexString());
  });

  it("DELETE expires and returns ok", async () => {
    const alertHex = new ObjectId().toHexString();
    priceAlertRepoMocks.expirePortfolioPriceAlertByIdForUser.mockResolvedValue(true);

    const res = await deletePriceAlert(new Request(`http://localhost/api`, { method: "DELETE" }), {
      params: Promise.resolve({ portfolioId: portfolioHex, alertId: alertHex })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("DELETE returns 404 when expire misses", async () => {
    priceAlertRepoMocks.expirePortfolioPriceAlertByIdForUser.mockResolvedValue(false);

    const res = await deletePriceAlert(new Request(`http://localhost/api`, { method: "DELETE" }), {
      params: Promise.resolve({ portfolioId: portfolioHex, alertId: new ObjectId().toHexString() })
    });
    expect(res.status).toBe(404);
  });

  it("short-circuits when BFF returns a response", async () => {
    const { proxyPortfolioRequestToBackend } = await import("@/lib/backend-bff");
    vi.mocked(proxyPortfolioRequestToBackend).mockResolvedValueOnce(NextResponse.json({ proxied: true }));

    const res = await getPriceAlerts(new Request(`http://localhost/api/portfolios/${portfolioHex}/price-alerts`), {
      params: Promise.resolve({ portfolioId: portfolioHex })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { proxied: boolean };
    expect(json.proxied).toBe(true);
    expect(priceAlertRepoMocks.listActivePortfolioPriceAlertsForUserPortfolio).not.toHaveBeenCalled();
  });
});
