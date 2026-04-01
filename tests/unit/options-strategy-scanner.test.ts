import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  listStrategies: vi.fn(),
  listPrefs: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(async () => ({
    collection: () => ({
      countDocuments: vi.fn().mockResolvedValue(3)
    })
  }))
}));

vi.mock("@/modules/core-admin/repository", () => ({
  adminListOptionsStrategySummaries: repoMocks.listStrategies,
  adminListOptionsStrategyPreferenceSummaries: repoMocks.listPrefs,
}));

import { runOptionsStrategyScanner } from "@/modules/strategy-options/options-strategy-scanner";

describe("runOptionsStrategyScanner", () => {
  it("reports counts and slug preview", async () => {
    repoMocks.listStrategies.mockResolvedValueOnce([
      { _id: new ObjectId(), slug: "wheel", name: "Wheel", createdAt: new Date(), updatedAt: new Date() },
      { _id: new ObjectId(), slug: "pmcc", name: "PMCC", createdAt: new Date(), updatedAt: new Date() },
    ]);
    repoMocks.listPrefs.mockResolvedValueOnce([
      { _id: new ObjectId(), slug: "wheel", name: "Wheel", createdAt: new Date(), updatedAt: new Date() },
    ]);

    const r = await runOptionsStrategyScanner({
      name: "t",
      category: "daily_options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true,
    });

    expect(r.status).toBe("success");
    expect(r.output).toContain("daily_options_scanner:");
    expect(r.output).toContain("portfolios=3");
    expect(r.output).toContain("accounts=3");
    expect(r.output).toContain("items_scanned=3");
    expect(r.output).toContain("strategies=2");
    expect(r.output).toContain("preferences=1");
    expect(r.output).toMatch(/pmcc|wheel/);
    expect(r.auditDetails).toEqual({
      portfolioCount: 3,
      accountCount: 3,
      itemsScanned: 3,
      strategyCount: 2,
      preferenceCount: 1,
      slugCount: 2
    });
  });

  it("returns failed on repository error", async () => {
    repoMocks.listStrategies.mockRejectedValueOnce(new Error("db down"));
    const r = await runOptionsStrategyScanner({
      name: "t",
      category: "daily_options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true,
    });
    expect(r.status).toBe("failed");
    expect(r.output).toContain("db down");
  });
});
