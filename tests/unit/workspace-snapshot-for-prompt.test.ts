import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getDefaultPortfolio: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

const wsCacheMocks = vi.hoisted(() => ({
  readWorkspaceSnapshotCache: vi.fn(),
  writeWorkspaceSnapshotCache: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => repo);
vi.mock("@/modules/xchat/workspace-snapshot-cache", () => ({
  buildWorkspaceSnapshotCacheKey: (input: {
    tenantId: string | undefined;
    userId: string;
    portfolioIdHex: string;
    workspaceContentRev: number;
  }) =>
    `xf:wsnap:v1:${input.tenantId ?? "_"}:${input.userId}:${input.portfolioIdHex}:${String(input.workspaceContentRev)}`,
  getWorkspaceSnapshotCacheTtlSeconds: () => 120,
  readWorkspaceSnapshotCache: wsCacheMocks.readWorkspaceSnapshotCache,
  writeWorkspaceSnapshotCache: wsCacheMocks.writeWorkspaceSnapshotCache
}));

import { buildWorkspaceServerSnapshotBlock } from "@/modules/xchat/workspace-snapshot-for-prompt";

describe("buildWorkspaceServerSnapshotBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsCacheMocks.readWorkspaceSnapshotCache.mockResolvedValue(null);
    wsCacheMocks.writeWorkspaceSnapshotCache.mockResolvedValue(undefined);
  });

  it("returns null when no portfolio and provision fails", async () => {
    repo.getDefaultPortfolio.mockResolvedValue(null);
    repo.provisionDefaultPortfolioForUser.mockRejectedValue(new Error("fail"));
    const r = await buildWorkspaceServerSnapshotBlock({
      userId: "u1"
    });
    expect(r).toBeNull();
  });

  it("returns fenced json with portfolio, accounts, positions preview, watchlist", async () => {
    repo.getDefaultPortfolio.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439001" },
      name: "Main",
      isDefault: true,
      ext_broker_ref: "ibkr"
    });
    repo.listPortfolioAccounts.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439002" },
        name: "Cash",
        type: "cash",
        extAccountId: "x",
        isDefault: true,
        cashBalance: 100
      }
    ]);
    repo.listPortfolioPositionsByAccount.mockResolvedValue([
      {
        symbol: "TSLA",
        qty: 10,
        avgCost: 200,
        accountId: { toHexString: () => "507f1f77bcf86cd799439002" }
      }
    ]);
    repo.getPortfolioWatchlist.mockResolvedValue({
      name: "WL",
      symbols: [{ symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00.000Z") }]
    });

    const r = await buildWorkspaceServerSnapshotBlock({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });
    expect(r).toContain("Workspace snapshot");
    expect(r).toContain("```json");
    expect(r).toContain('"name":"Main"');
    expect(r).toContain('"symbol":"TSLA"');
    expect(r).toContain('"cashBalance":100');
    expect(r).toContain('"workspaceContentRev":0');
    expect(r).toContain('"accountId":"507f1f77bcf86cd799439002"');
    expect(wsCacheMocks.writeWorkspaceSnapshotCache).toHaveBeenCalled();
  });
});
