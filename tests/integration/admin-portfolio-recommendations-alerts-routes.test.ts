import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminGetPortfolioById: vi.fn(),
  adminListRecommendationsForPortfolio: vi.fn(),
  adminCreateRecommendationForPortfolio: vi.fn(),
  adminUpdateRecommendationForPortfolio: vi.fn(),
  adminDeleteRecommendationForPortfolio: vi.fn(),
  adminListPortfolioAlerts: vi.fn(),
  adminCreatePortfolioAlert: vi.fn(),
  adminUpdatePortfolioAlert: vi.fn(),
  adminDeletePortfolioAlert: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repoMocks);

import { GET as getRecs, POST as postRec } from "@/app/api/admin/portfolios/[portfolioId]/recommendations/route";
import {
  DELETE as deleteRec,
  PATCH as patchRec
} from "@/app/api/admin/portfolios/[portfolioId]/recommendations/[recommendationId]/route";
import { GET as getAlerts, POST as postAlert } from "@/app/api/admin/portfolios/[portfolioId]/alerts/route";
import {
  DELETE as deleteAlert,
  PATCH as patchAlert
} from "@/app/api/admin/portfolios/[portfolioId]/alerts/[alertId]/route";

const portfolioId = "507f1f77bcf86cd799439033";
const recId = "507f1f77bcf86cd799439044";
const alertId = "507f1f77bcf86cd799439055";
const now = new Date("2026-01-15T12:00:00.000Z");

function mockPortfolio() {
  return {
    _id: new ObjectId(portfolioId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    name: "Main",
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

function mockRecommendation() {
  return {
    _id: new ObjectId(recId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    portfolioId: new ObjectId(portfolioId),
    symbol: "TSLA",
    action: "hold" as const,
    note: "test",
    status: "new" as const,
    createdAt: now,
    updatedAt: now
  };
}

function mockAlert() {
  return {
    _id: new ObjectId(alertId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    portfolioId: new ObjectId(portfolioId),
    title: "Margin call",
    body: "Check book",
    severity: "warning" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now
  };
}

describe("admin portfolio recommendations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    repoMocks.adminGetPortfolioById.mockResolvedValue(mockPortfolio());
  });

  it("GET lists recommendations", async () => {
    repoMocks.adminListRecommendationsForPortfolio.mockResolvedValue([mockRecommendation()]);
    const res = await getRecs(new Request("http://test"), { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ symbol: string }> };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.symbol).toBe("TSLA");
  });

  it("POST creates recommendation", async () => {
    repoMocks.adminCreateRecommendationForPortfolio.mockResolvedValue(mockRecommendation());
    const res = await postRec(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "TSLA", action: "hold" })
      }),
      { params: Promise.resolve({ portfolioId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.adminCreateRecommendationForPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({ portfolioId, symbol: "TSLA", action: "hold" })
    );
  });

  it("PATCH updates recommendation", async () => {
    repoMocks.adminUpdateRecommendationForPortfolio.mockResolvedValue({
      ...mockRecommendation(),
      status: "accepted"
    });
    const res = await patchRec(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" })
      }),
      { params: Promise.resolve({ portfolioId, recommendationId: recId }) }
    );
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdateRecommendationForPortfolio).toHaveBeenCalled();
  });

  it("DELETE removes recommendation", async () => {
    repoMocks.adminDeleteRecommendationForPortfolio.mockResolvedValue(true);
    const res = await deleteRec(new Request("http://test"), {
      params: Promise.resolve({ portfolioId, recommendationId: recId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.adminDeleteRecommendationForPortfolio).toHaveBeenCalledWith(portfolioId, recId);
  });
});

describe("admin portfolio alerts routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    repoMocks.adminGetPortfolioById.mockResolvedValue(mockPortfolio());
  });

  it("GET lists alerts", async () => {
    repoMocks.adminListPortfolioAlerts.mockResolvedValue([mockAlert()]);
    const res = await getAlerts(new Request("http://test"), { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ title: string }> };
    expect(json.data[0]?.title).toBe("Margin call");
  });

  it("POST creates alert", async () => {
    repoMocks.adminCreatePortfolioAlert.mockResolvedValue(mockAlert());
    const res = await postAlert(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Margin call", severity: "warning" })
      }),
      { params: Promise.resolve({ portfolioId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.adminCreatePortfolioAlert).toHaveBeenCalled();
  });

  it("PATCH updates alert", async () => {
    repoMocks.adminUpdatePortfolioAlert.mockResolvedValue({ ...mockAlert(), status: "acknowledged" });
    const res = await patchAlert(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" })
      }),
      { params: Promise.resolve({ portfolioId, alertId }) }
    );
    expect(res.status).toBe(200);
  });

  it("DELETE removes alert", async () => {
    repoMocks.adminDeletePortfolioAlert.mockResolvedValue(true);
    const res = await deleteAlert(new Request("http://test"), {
      params: Promise.resolve({ portfolioId, alertId })
    });
    expect(res.status).toBe(200);
  });
});
