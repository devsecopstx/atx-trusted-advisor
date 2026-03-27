import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  listStrategies: vi.fn(),
  listPrefs: vi.fn(),
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
    expect(r.output).toContain("daily_options_scanner: catalog check");
    expect(r.output).toContain("2 strategies");
    expect(r.output).toContain("1 preference");
    expect(r.output).toMatch(/pmcc|wheel/);
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
