import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  listStrategies: vi.fn(),
  listPrefs: vi.fn(),
  listFilterRows: vi.fn()
}));

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

vi.mock("@/modules/strategy-options/options-scanner-engine", () => ({
  processOptionRecommendationsPass: vi.fn()
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(async () => ({
    collection: (name: string) => {
      if (name === "portfolio_positions") {
        const fiveLegs = [
          { symbol: "TSLA" },
          { symbol: "TSLA" },
          { symbol: "TSLA" },
          { symbol: "RKLB" },
          { symbol: "RKLB" }
        ];
        return {
          countDocuments: vi.fn().mockResolvedValue(5),
          aggregate: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([{ optionPositions: fiveLegs, watchlists: [] }])
          }),
          find: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(fiveLegs)
          })
        };
      }
      if (name === "portfolio_watchlists") {
        return {
          find: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([])
          })
        };
      }
      return {
        countDocuments: vi.fn().mockResolvedValue(3)
      };
    }
  }))
}));

vi.mock("@/modules/core-admin/repository", () => ({
  adminListOptionsStrategySummaries: repoMocks.listStrategies,
  adminListOptionsStrategyPreferenceSummaries: repoMocks.listPrefs,
  adminListOptionsStrategyFilterRows: repoMocks.listFilterRows,
  getDefaultPortfolio: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/modules/identity/repository", () => ({
  getTenantByHexId: vi.fn().mockResolvedValue({ tenantPreferences: {} }),
  normalizeMongoUserIdHex: (v: unknown) => (typeof v === "string" ? v : "")
}));

import { processOptionRecommendationsPass } from "@/modules/strategy-options/options-scanner-engine";
import { runOptionsStrategyScanner } from "@/modules/strategy-options/options-strategy-scanner";

const emptyRecPass = {
  examined: 0,
  stored: 0,
  updated: 0,
  alertsCreated: 0,
  alertsSuppressedDeduped: 0,
  alertsDismissedOnHold: 0,
  chainFailures: 0,
  grokCalls: 0,
  skippedBadRow: 0,
  fromPositions: 0,
  fromWatchlist: 0,
  chainBatches: 0,
  ivRankFilteredBatches: 0,
  rankedSignals: [],
  watchlistRowsAdded: 0,
  watchlistRowsUpdated: 0
};

const scannerTaskTenantId = new ObjectId();

describe("runOptionsStrategyScanner", () => {
  beforeEach(() => {
    vi.mocked(processOptionRecommendationsPass).mockResolvedValue(emptyRecPass);
    repoMocks.listFilterRows.mockResolvedValue([]);
    repoMocks.listStrategies.mockResolvedValue([]);
    repoMocks.listPrefs.mockResolvedValue([]);
  });

  it("skips recommendation pass when scheduled task has no tenantId", async () => {
    const r = await runOptionsStrategyScanner({
      name: "t",
      category: "options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true
    });
    expect(r.status).toBe("success");
    expect(r.output).toContain("missing_scheduled_task_tenantId");
    expect(r.auditDetails?.skipReason).toBe("missing_tenant_id");
    expect(processOptionRecommendationsPass).not.toHaveBeenCalled();
  });

  it("reports counts, market-open path, and slug preview", async () => {
    repoMocks.listStrategies.mockResolvedValueOnce([
      { _id: new ObjectId(), slug: "wheel", name: "Wheel", createdAt: new Date(), updatedAt: new Date() },
      { _id: new ObjectId(), slug: "pmcc", name: "PMCC", createdAt: new Date(), updatedAt: new Date() }
    ]);
    repoMocks.listPrefs.mockResolvedValueOnce([
      { _id: new ObjectId(), slug: "wheel", name: "Wheel", createdAt: new Date(), updatedAt: new Date() }
    ]);

    const r = await runOptionsStrategyScanner({
      name: "t",
      category: "options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true,
      tenantId: scannerTaskTenantId
    });

    expect(r.status).toBe("success");
    expect(r.output).toContain("options-strategy-scanner:");
    expect(r.output).toContain("task_category=options_scanner");
    expect(r.output).toContain("skipped=false");
    expect(r.output).toContain("market=open");
    expect(r.output).toContain("portfolios=3");
    expect(r.output).toContain("accounts=3");
    expect(r.output).toContain("items_scanned=3");
    expect(r.output).toContain("strategies=2");
    expect(r.output).toContain("preferences=1");
    expect(r.output).toContain("option_positions=5");
    expect(r.output).toContain("unique_underlyings=2");
    expect(r.output).toContain("strategy_filter_rows=0");
    expect(r.output).toContain("scan_targets=");
    expect(r.output).toContain("prefs_active=true");
    expect(r.output).toContain("iv_rank_min=45");
    expect(r.output).toContain("rec_examined=0");
    expect(r.output).toContain("rec_from_pos=0");
    expect(r.output).toMatch(/pmcc|wheel/);
    expect(r.auditDetails).toEqual({
      skipped: false,
      taskCategory: "options_scanner",
      marketDate: "2026-04-01",
      marketTimezone: "America/New_York",
      portfolioCount: 3,
      accountCount: 3,
      itemsScanned: 3,
      strategyCount: 2,
      preferenceCount: 1,
      slugCount: 2,
      optionPositionCount: 5,
      uniqueUnderlyingCount: 2,
      recommendationsExamined: 0,
      recommendationsStored: 0,
      recommendationsUpdated: 0,
      chainFailures: 0,
      grokCalls: 0,
      alertsCreated: 0,
      alertsSuppressedDeduped: 0,
      alertsDismissedOnHold: 0,
      skippedBadPositions: 0,
      recommendationSourcesFromPositions: 0,
      recommendationSourcesFromWatchlist: 0,
      watchlistOptionRows: 0,
      strategyFilterRowCount: 0,
      scanTargetsPrePrefs: 0,
      scanTargetsPostPrefs: 0,
      prefsFilterActive: true,
      minIvRankPct: 45,
      tenantEngineOverride: false,
      straddleDeltaMin: 0.15,
      straddleDeltaMax: 0.3,
      minFitScore: 70,
      rankTopPreview: null,
      chainBatches: 0,
      durationSeconds: expect.any(Number),
      watchlistRowsAdded: 0,
      watchlistRowsUpdated: 0
    });
    expect(calendarMocks.updateTenantMarketCalendarSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTaskCategory: "options_strategy_scanner",
        holdingsCount: 5,
        symbolCount: 2
      })
    );
    expect(processOptionRecommendationsPass).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: scannerTaskTenantId })
    );
  });

  it("bypasses desk market window on manual admin run (off-hours still scans)", async () => {
    calendarMocks.resolveUsMarketDayContext.mockReturnValueOnce({
      marketDate: "2026-04-01",
      timezone: "America/New_York",
      isBusinessDay: true,
      isHoliday: false,
      holidayName: undefined,
      marketWindowOpen: false
    });
    const r = await runOptionsStrategyScanner(
      {
        name: "t",
        category: "options_scanner",
        scheduleCron: "0 9 * * *",
        enabled: true,
        tenantId: scannerTaskTenantId
      },
      { bypassMarketWindow: true }
    );
    expect(r.status).toBe("success");
    expect(r.output).toContain("market=admin_bypass_desk_window");
    expect(r.output).toContain("skipped=false");
    expect(processOptionRecommendationsPass).toHaveBeenCalled();
  });

  it("returns failed on repository error", async () => {
    repoMocks.listStrategies.mockRejectedValueOnce(new Error("db down"));
    const r = await runOptionsStrategyScanner({
      name: "t",
      category: "options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true,
      tenantId: scannerTaskTenantId
    });
    expect(r.status).toBe("failed");
    expect(r.output).toContain("db down");
  });
});
