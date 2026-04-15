import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calendarMocks = vi.hoisted(() => ({
  resolveUsMarketDayContext: vi.fn(() => ({
    marketDate: "2026-04-01",
    timezone: "America/New_York",
    isBusinessDay: true,
    isHoliday: false,
    holidayName: undefined,
    marketWindowOpen: true
  })),
  updateTenantMarketCalendarSnapshot: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/modules/scanner/tenant-market-calendar", () => calendarMocks);

const repoMocks = vi.hoisted(() => ({
  listWatchlistsForTenantScope: vi.fn(),
  updateWatchlistSymbolPrices: vi.fn(),
  getDefaultPortfolio: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => ({
  listWatchlistsForTenantScope: repoMocks.listWatchlistsForTenantScope,
  updateWatchlistSymbolPrices: repoMocks.updateWatchlistSymbolPrices,
  getDefaultPortfolio: repoMocks.getDefaultPortfolio
}));

const yahooMocks = vi.hoisted(() => ({
  getYahooBatchQuotes: vi.fn()
}));

vi.mock("@/modules/watchlist/yahoo-batch-quotes", () => ({
  getYahooBatchQuotes: yahooMocks.getYahooBatchQuotes
}));

const alertMocks = vi.hoisted(() => ({
  persistPriceMoveAlerts: vi.fn()
}));

vi.mock("@/modules/watchlist/price-alert-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/watchlist/price-alert-service")>();
  return {
    ...actual,
    persistPriceMoveAlerts: alertMocks.persistPriceMoveAlerts
  };
});

import { runWatchlistPriceScanner } from "@/modules/watchlist/watchlist-scanner";

const tenantId = new ObjectId();
const watchlistId = new ObjectId();
const userId = new ObjectId();
const defaultPortfolioId = new ObjectId();

describe("runWatchlistPriceScanner", () => {
  beforeEach(() => {
    vi.stubEnv("WATCHLIST_SCANNER_PERSONA_DISABLE", "1");
    calendarMocks.resolveUsMarketDayContext.mockReturnValue({
      marketDate: "2026-04-01",
      timezone: "America/New_York",
      isBusinessDay: true,
      isHoliday: false,
      holidayName: undefined,
      marketWindowOpen: true
    });
    repoMocks.listWatchlistsForTenantScope.mockReset();
    repoMocks.updateWatchlistSymbolPrices.mockReset();
    repoMocks.getDefaultPortfolio.mockReset();
    yahooMocks.getYahooBatchQuotes.mockReset();
    alertMocks.persistPriceMoveAlerts.mockReset();
    alertMocks.persistPriceMoveAlerts.mockResolvedValue({
      created: 0,
      recorded: [],
      skippedCooldown: 0
    });
    repoMocks.updateWatchlistSymbolPrices.mockResolvedValue(1);
    repoMocks.getDefaultPortfolio.mockResolvedValue({ _id: defaultPortfolioId });
  });

  it("skips when scheduled task has no tenantId (parity with options_scanner)", async () => {
    const r = await runWatchlistPriceScanner({
      name: "wl",
      category: "watchlist_price_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true
    });
    expect(r.status).toBe("success");
    expect(r.output).toContain("missing_scheduled_task_tenantId");
    expect(r.auditDetails?.skipReason).toBe("missing_tenant_id");
    expect(repoMocks.listWatchlistsForTenantScope).not.toHaveBeenCalled();
  });

  it("skips outside desk window when bypassMarketWindow is false", async () => {
    calendarMocks.resolveUsMarketDayContext.mockReturnValueOnce({
      marketDate: "2026-04-01",
      timezone: "America/New_York",
      isBusinessDay: true,
      isHoliday: false,
      holidayName: undefined,
      marketWindowOpen: false
    });
    repoMocks.listWatchlistsForTenantScope.mockResolvedValueOnce([
      {
        _id: watchlistId,
        userId,
        tenantId,
        symbols: [{ symbol: "AAPL", lastPrice: 100 }]
      }
    ]);
    const r = await runWatchlistPriceScanner(
      {
        name: "wl",
        category: "watchlist_price_scanner",
        scheduleCron: "0 9 * * *",
        enabled: true,
        tenantId
      },
      { bypassMarketWindow: false }
    );
    expect(r.status).toBe("success");
    expect(r.output).toContain("skipped —");
    expect(repoMocks.updateWatchlistSymbolPrices).not.toHaveBeenCalled();
  });

  it("batch-quotes, patches watchlist rows, and may persist price-move alerts", async () => {
    repoMocks.listWatchlistsForTenantScope.mockResolvedValueOnce([
      {
        _id: watchlistId,
        userId,
        tenantId,
        symbols: [{ symbol: "AAPL", lastPrice: 100, rationale: "prior" }]
      }
    ]);
    yahooMocks.getYahooBatchQuotes.mockResolvedValueOnce([{ symbol: "AAPL", price: 110 }]);

    const r = await runWatchlistPriceScanner(
      {
        name: "wl",
        category: "watchlist_price_scanner",
        scheduleCron: "0 9 * * *",
        enabled: true,
        tenantId
      },
      { bypassMarketWindow: true }
    );

    expect(r.status).toBe("success");
    expect(r.output).toContain("watchlist_price_scanner:");
    expect(r.output).toContain("items_updated=1");
    expect(r.output).toContain("symbols_quoted=1");
    expect(yahooMocks.getYahooBatchQuotes).toHaveBeenCalledWith(["AAPL"]);
    expect(repoMocks.updateWatchlistSymbolPrices).toHaveBeenCalledWith(
      watchlistId,
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "AAPL",
          symbolRowIndex: 0,
          lastPrice: 110,
          rowStatus: "review"
        })
      ])
    );
    expect(alertMocks.persistPriceMoveAlerts).toHaveBeenCalled();
    expect(calendarMocks.updateTenantMarketCalendarSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sourceTaskCategory: "watchlist_price_scanner",
        watchlistCount: 1
      })
    );
  });
});
