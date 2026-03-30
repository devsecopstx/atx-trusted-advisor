import { describe, expect, it } from "vitest";

import { computeRsiFromCloses } from "@/modules/find-options/rsi";

describe("computeRsiFromCloses", () => {
  it("returns null when not enough bars", () => {
    expect(computeRsiFromCloses([1, 2, 3], 14)).toBeNull();
  });

  it("computes RSI for a monotonic uptrend sample", () => {
    const closes: number[] = [];
    for (let i = 0; i < 20; i++) {
      closes.push(100 + i * 0.5);
    }
    const rsi = computeRsiFromCloses(closes, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(50);
  });
});
