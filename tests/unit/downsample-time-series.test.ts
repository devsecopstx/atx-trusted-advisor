import { describe, expect, it } from "vitest";

import { downsampleTimeSeries } from "@/lib/chart/downsample-time-series";

describe("downsampleTimeSeries", () => {
  it("returns a copy when under cap", () => {
    const a = [1, 2, 3];
    const b = downsampleTimeSeries(a, 10);
    expect(b).toEqual([1, 2, 3]);
    expect(b).not.toBe(a);
  });

  it("caps length and keeps last point", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const out = downsampleTimeSeries(items, 20);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out[out.length - 1]).toBe(99);
  });
});
