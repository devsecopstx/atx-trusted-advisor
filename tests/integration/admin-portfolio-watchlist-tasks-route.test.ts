import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminGetPortfolioById: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  adminEnsurePortfolioWatchlist: vi.fn(),
  mutatePortfolioWatchlistSymbols: vi.fn(),
  listScheduledTasks: vi.fn(),
  createScheduledTask: vi.fn(),
  getScheduledTaskById: vi.fn(),
  updateScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repoMocks);

import { DELETE as deletePortfolioTask, PATCH as patchPortfolioTask } from "@/app/api/admin/portfolios/[portfolioId]/tasks/[taskId]/route";
import { GET as getPortfolioTasks, POST as postPortfolioTask } from "@/app/api/admin/portfolios/[portfolioId]/tasks/route";
import { GET as getWatchlist, PATCH as patchWatchlist } from "@/app/api/admin/portfolios/[portfolioId]/watchlist/route";

const portfolioId = "507f1f77bcf86cd799439033";
const taskId = "507f1f77bcf86cd799439044";
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

function mockWatchlist() {
  return {
    _id: new ObjectId("507f1f77bcf86cd799439099"),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    portfolioId: new ObjectId(portfolioId),
    name: "DefaultWatchlist",
    isDefault: true,
    symbols: [{ symbol: "TSLA", addedAt: now }],
    createdAt: now,
    updatedAt: now
  };
}

describe("admin portfolio watchlist route", () => {
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
    repoMocks.getPortfolioWatchlist.mockResolvedValue(mockWatchlist());
  });

  it("GET returns watchlist symbols", async () => {
    const res = await getWatchlist(new Request("http://test"), {
      params: Promise.resolve({ portfolioId })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { symbols: Array<{ symbol: string }> } };
    expect(json.data.symbols).toHaveLength(1);
    expect(json.data.symbols[0]?.symbol).toBe("TSLA");
  });

  it("PATCH mutates symbols", async () => {
    repoMocks.mutatePortfolioWatchlistSymbols.mockResolvedValue({
      ...mockWatchlist(),
      symbols: [
        { symbol: "TSLA", addedAt: now },
        { symbol: "AAPL", addedAt: now }
      ]
    });
    const res = await patchWatchlist(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addSymbols: ["AAPL"] })
      }),
      { params: Promise.resolve({ portfolioId }) }
    );
    expect(res.status).toBe(200);
    expect(repoMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        addSymbols: ["AAPL"]
      })
    );
  });
});

describe("admin portfolio tasks route", () => {
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

  it("GET lists tasks for portfolio", async () => {
    repoMocks.listScheduledTasks.mockResolvedValueOnce([
      {
        _id: new ObjectId(taskId),
        tenantId: new ObjectId("507f1f77bcf86cd799439022"),
        portfolioId: new ObjectId(portfolioId),
        name: "Book sync",
        category: "sync-broker",
        scheduleCron: "0 2 * * *",
        enabled: true,
        nextRunAt: now
      }
    ]);
    const res = await getPortfolioTasks(new Request("http://test"), {
      params: Promise.resolve({ portfolioId })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ name: string; portfolioId?: string }> };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.name).toBe("Book sync");
    expect(json.data[0]?.portfolioId).toBe(portfolioId);
    expect(repoMocks.listScheduledTasks).toHaveBeenCalledWith({
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId
    });
  });

  it("POST creates portfolio-scoped task", async () => {
    repoMocks.createScheduledTask.mockResolvedValueOnce({
      _id: new ObjectId(taskId),
      tenantId: new ObjectId("507f1f77bcf86cd799439022"),
      portfolioId: new ObjectId(portfolioId),
      name: "Nightly",
      category: "rebalance",
      scheduleCron: "0 3 * * *",
      enabled: true,
      nextRunAt: now
    });
    const res = await postPortfolioTask(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nightly",
          category: "rebalance",
          scheduleCron: "0 3 * * *"
        })
      }),
      { params: Promise.resolve({ portfolioId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.createScheduledTask).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        name: "Nightly",
        category: "rebalance"
      })
    );
  });

  it("PATCH updates task when portfolio matches", async () => {
    repoMocks.getScheduledTaskById.mockResolvedValueOnce({
      _id: new ObjectId(taskId),
      tenantId: new ObjectId("507f1f77bcf86cd799439022"),
      portfolioId: new ObjectId(portfolioId),
      name: "Nightly",
      category: "sync-broker",
      scheduleCron: "0 2 * * *",
      enabled: true,
      nextRunAt: now
    });
    repoMocks.updateScheduledTask.mockResolvedValueOnce({
      _id: new ObjectId(taskId),
      name: "Renamed",
      category: "sync-broker",
      scheduleCron: "0 2 * * *",
      enabled: false,
      nextRunAt: now
    });
    const res = await patchPortfolioTask(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed", enabled: false })
      }),
      { params: Promise.resolve({ portfolioId, taskId }) }
    );
    expect(res.status).toBe(200);
    expect(repoMocks.updateScheduledTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        expectedPortfolioId: portfolioId,
        name: "Renamed",
        enabled: false
      })
    );
  });

  it("DELETE removes task when portfolio matches", async () => {
    repoMocks.deleteScheduledTask.mockResolvedValueOnce(true);
    const res = await deletePortfolioTask(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ portfolioId, taskId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.deleteScheduledTask).toHaveBeenCalledWith({
      taskId,
      tenantId: "507f1f77bcf86cd799439022",
      expectedPortfolioId: portfolioId
    });
  });
});
