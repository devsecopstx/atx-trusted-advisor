import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getDefaultPortfolio: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  getUserWatchlist: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

const wsCacheMocks = vi.hoisted(() => ({
  readWorkspaceSnapshotCache: vi.fn(),
  writeWorkspaceSnapshotCache: vi.fn()
}));

const lookupSymbolsMock = vi.hoisted(() =>
  vi.fn(async (symbols: string[], opts?: { allowNetwork?: boolean }) => {
    void opts;
    const m = new Map<string, { symbol: string; price: number; source: string }>();
    for (const s of symbols) {
      m.set(s, { symbol: s, price: 250.5, source: "yahoo-finance2" });
    }
    return m;
  })
);

const loadInvestmentOutlookPromptJsonMock = vi.hoisted(() =>
  vi.fn(async () => Promise.resolve(null))
);

vi.mock("@/modules/core-admin/repository", () => repo);
vi.mock("@/modules/xchat/workspace-snapshot-cache", () => ({
  buildWorkspaceSnapshotCacheKey: (input: {
    tenantId: string | undefined;
    userId: string;
    portfolioIdHex: string;
    workspaceContentRev: number;
  }) =>
    `xf:wsnap:v1:${input.tenantId ?? "_"}:${input.userId}:${input.portfolioIdHex}:${String(input.workspaceContentRev)}`,
  getWorkspaceSnapshotCacheTtlSeconds: () => 60,
  readWorkspaceSnapshotCache: wsCacheMocks.readWorkspaceSnapshotCache,
  writeWorkspaceSnapshotCache: wsCacheMocks.writeWorkspaceSnapshotCache
}));

vi.mock("@/modules/watchlist/yahoo-symbol-lookup", () => ({
  lookupSymbols: lookupSymbolsMock,
  LOOKUP_ROUTE: "yahoo-finance2"
}));

vi.mock("@/modules/portfolio/investment-outlooks", () => ({
  loadInvestmentOutlookPromptJson: loadInvestmentOutlookPromptJsonMock
}));

vi.mock("@/modules/xchat/portfolio-workspace-snapshot-repository", () => ({
  findPortfolioWorkspaceSnapshot: vi.fn(() => Promise.resolve(null)),
  upsertPortfolioWorkspaceSnapshot: vi.fn(() => Promise.resolve(undefined)),
  ensurePortfolioWorkspaceSnapshotIndexes: vi.fn(() => Promise.resolve(undefined))
}));

import {
    buildWorkspacePreloadHintForSystemPrompt,
    buildWorkspaceServerSnapshotBlock,
    loadWorkspaceSnapshotPreload,
    type WorkspaceSnapshotPromptJson
} from "@/modules/xchat/workspace-snapshot-for-prompt";

describe("buildWorkspaceServerSnapshotBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadInvestmentOutlookPromptJsonMock.mockResolvedValue(null);
    wsCacheMocks.readWorkspaceSnapshotCache.mockResolvedValue(null);
    wsCacheMocks.writeWorkspaceSnapshotCache.mockResolvedValue(undefined);
    repo.getUserWatchlist.mockImplementation(async (input) => {
      const pf = await repo.getDefaultPortfolio();
      const id = pf && "_id" in pf && pf._id ? (pf._id as { toHexString: () => string }).toHexString() : "";
      if (!id) return null;
      return repo.getPortfolioWatchlist({
        userId: input.userId,
        portfolioId: id,
        tenantId: input.tenantId
      });
    });
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
      isDefault: true
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
    expect(r).toContain('"addedAtDisplay"');
    expect(r).toContain('"targetEntryDisplay":"not set"');
    expect(r).toContain('"targetEntryNotional100xDisplay":"25,050"');
    expect(r).toContain('"spotPriceDisplay":"$250.50"');
    expect(r).toContain('"targetEntryNotional100xUsdDisplay":"$25,050"');
    expect(r).toContain('"cashBalance":100');
    expect(r).toContain('"workspaceContentRev":0');
    expect(r).toContain('"accountId":"507f1f77bcf86cd799439002"');
    expect(r).toContain('"extAccountId":"••••"');
    expect(wsCacheMocks.writeWorkspaceSnapshotCache).toHaveBeenCalled();
    expect(loadInvestmentOutlookPromptJsonMock).toHaveBeenCalled();
  });

  it("includes investmentOutlook in workspace JSON when loader returns rows", async () => {
    loadInvestmentOutlookPromptJsonMock.mockResolvedValueOnce({
      updatedAt: "2026-05-10T12:00:00.000Z",
      expiresAt: "2026-05-12T12:00:00.000Z",
      symbols: [
        {
          symbol: "TSLA",
          spot: 250,
          expirationYmd: "2026-06-19",
          coveredCall: {
            conservative: { strike: 280, probabilityCalledAway: 0.15, premium: 2 },
            aggressive: { strike: 252, probabilityCalledAway: 0.42, premium: 5 }
          },
          cashSecuredPut: {
            conservative: { strike: 220, probabilityExpireOtm: 0.7, premium: 3 },
            aggressive: { strike: 248, probabilityExpireOtm: 0.45, premium: 4 }
          }
        }
      ]
    });
    repo.getDefaultPortfolio.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439001" },
      name: "Main",
      isDefault: true
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
    repo.listPortfolioPositionsByAccount.mockResolvedValue([]);
    repo.getPortfolioWatchlist.mockResolvedValue({
      name: "WL",
      symbols: []
    });
    const r = await buildWorkspaceServerSnapshotBlock({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });
    expect(r).toContain('"investmentOutlook"');
    expect(r).toContain('"expirationYmd":"2026-06-19"');
    const jsonStr = (r ?? "").split("```json")[1]?.split("```")[0]?.trim() ?? "{}";
    const promptJson = JSON.parse(jsonStr) as WorkspaceSnapshotPromptJson;
    const hint = buildWorkspacePreloadHintForSystemPrompt({ promptJson, positionsFull: [] });
    expect(hint).toContain("Pre-computed wheel/outlook");
  });

  it("passes allowNetwork false to lookupSymbols when snapshotQuoteNetwork is cached_first", async () => {
    repo.getDefaultPortfolio.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439001" },
      name: "Main",
      isDefault: true
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
    repo.listPortfolioPositionsByAccount.mockResolvedValue([]);
    repo.getPortfolioWatchlist.mockResolvedValue({
      name: "WL",
      symbols: [{ symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00.000Z") }]
    });
    lookupSymbolsMock.mockClear();
    await loadWorkspaceSnapshotPreload(
      { userId: "507f1f77bcf86cd799439011", tenantId: "507f1f77bcf86cd799439022" },
      { snapshotQuoteNetwork: "cached_first" }
    );
    expect(lookupSymbolsMock).toHaveBeenCalledWith(["TSLA"], { allowNetwork: false });
  });
});

describe("buildWorkspacePreloadHintForSystemPrompt", () => {
  it("summarizes portfolio + watchlist without full JSON", () => {
    const hint = buildWorkspacePreloadHintForSystemPrompt({
      promptJson: {
        loadedAt: new Date().toISOString(),
        workspaceContentRev: 2,
        portfolio: {
          id: "507f1f77bcf86cd799439033",
          name: "Main",
          isDefault: true,
          totalPositionCount: 1
        },
        accounts: [
          {
            accountId: "acc1",
            name: "Individual",
            type: "cash",
            extAccountId: "",
            isDefault: true,
            cashBalance: 1000,
            positionCount: 1
          }
        ],
        positionsPreview: [{ symbol: "TSLA", qty: 10, avgCost: 200, accountId: "acc1" }],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "Hot",
          riskProfile: null,
          outlook: null,
          symbols: []
        }
      },
      positionsFull: []
    });
    expect(hint).toContain("Workspace preload hint");
    expect(hint).toContain("Main");
    expect(hint).toContain("watchlist \"Hot\"");
    expect(hint).toContain("TSLA");
    expect(hint).not.toContain("```json");
  });
});
