import { describe, expect, it } from "vitest";

import {
    computeOpsCostEstimate,
    defaultCloudRunVcpuHoursMtd,
    readOpsCostRatesFromEnv
} from "@/modules/admin/ops-cost-estimate";

describe("ops-cost-estimate", () => {
  it("computes today + MTD totals from inputs and rates", () => {
    const rates = {
      xaiCostPerPromptUsd: 0.0008,
      strategyJobPerRunUsd: 0.002,
      gcpRunCostPerVcpuHourUsd: 0.0005
    };
    const out = computeOpsCostEstimate(
      {
        xchatPromptsToday: 100,
        xchatPromptsMtd: 1000,
        strategyJobsToday: 3,
        strategyJobsMtd: 12,
        estimatedCloudRunVcpuHoursToday: 24,
        estimatedCloudRunVcpuHoursMtd: 24 * 6
      },
      rates,
      ["unit test"]
    );
    expect(out.today.xchatUsd).toBeCloseTo(0.08, 6);
    expect(out.today.strategyJobsUsd).toBeCloseTo(0.006, 6);
    expect(out.today.cloudRunUsd).toBeCloseTo(0.012, 6);
    expect(out.todayTotalUsd).toBeCloseTo(0.098, 6);
    expect(out.monthToDate.xchatUsd).toBeCloseTo(0.8, 6);
    expect(out.notes).toContain("unit test");
  });

  it("defaultCloudRunVcpuHoursMtd scales by UTC day of month", () => {
    const jan6 = new Date(Date.UTC(2026, 0, 6, 12, 0, 0));
    expect(defaultCloudRunVcpuHoursMtd(jan6, 10)).toBe(60);
  });

  it("readOpsCostRatesFromEnv returns finite defaults", () => {
    const r = readOpsCostRatesFromEnv();
    expect(r.xaiCostPerPromptUsd).toBeGreaterThan(0);
    expect(r.strategyJobPerRunUsd).toBeGreaterThan(0);
    expect(r.gcpRunCostPerVcpuHourUsd).toBeGreaterThan(0);
  });
});
