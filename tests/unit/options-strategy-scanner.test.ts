import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  listStrategies: vi.fn(),
  listPrefs: vi.fn()
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

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(async () => ({
    collection: (name: string) => {
      if (name === "portfolio_positions") {
        return {
          countDocuments: vi.fn().mockResolvedValue(5),
          aggregate: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([{ n: 2 }])
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
  adminListOptionsStrategyPreferenceSummaries: repoMocks.listPrefs
}));

import { runOptionsStrategyScanner } from "@/modules/strategy-options/options-strategy-scanner";

describe("runOptionsStrategyScanner", () => {
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
      category: "daily_options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true
    });

    expect(r.status).toBe("success");
    expect(r.output).toContain("options-strategy-scanner:");
    expect(r.output).toContain("task_category=daily_options_scanner");
    expect(r.output).toContain("skipped=false");
    expect(r.output).toContain("market=open");
    expect(r.output).toContain("portfolios=3");
    expect(r.output).toContain("accounts=3");
    expect(r.output).toContain("items_scanned=3");
    expect(r.output).toContain("strategies=2");
    expect(r.output).toContain("preferences=1");
    expect(r.output).toContain("option_positions=5");
    expect(r.output).toContain("unique_underlyings=2");
    expect(r.output).toMatch(/pmcc|wheel/);
    expect(r.auditDetails).toEqual({
      skipped: false,
      taskCategory: "daily_options_scanner",
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
      durationSeconds: expect.any(Number)
    });
    expect(calendarMocks.updateTenantMarketCalendarSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTaskCategory: "options_strategy_scanner",
        holdingsCount: 5,
        symbolCount: 2
      })
    );
  });

  it("returns failed on repository error", async () => {
    repoMocks.listStrategies.mockRejectedValueOnce(new Error("db down"));
    const r = await runOptionsStrategyScanner({
      name: "t",
      category: "daily_options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true
    });
    expect(r.status).toBe("failed");
    expect(r.output).toContain("db down");
  });
});
