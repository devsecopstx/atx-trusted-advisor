import { describe, expect, it } from "vitest";

import {
    buildUpcomingFridayExpirations,
    isUtcFridayYyyyMmDd,
    preferFridayExpirations
} from "@/modules/strategy-options/expirations";

describe("isUtcFridayYyyyMmDd", () => {
  it("returns true for UTC Fridays", () => {
    expect(isUtcFridayYyyyMmDd("2026-03-20")).toBe(true);
    expect(isUtcFridayYyyyMmDd("2026-03-27")).toBe(true);
  });

  it("returns false for non-Fridays", () => {
    expect(isUtcFridayYyyyMmDd("2026-03-19")).toBe(false);
    expect(isUtcFridayYyyyMmDd("2026-03-21")).toBe(false);
  });
});

describe("preferFridayExpirations", () => {
  it("keeps only Fridays when present", () => {
    const raw = ["2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21"];
    expect(preferFridayExpirations(raw)).toEqual(["2026-03-20"]);
  });

  it("falls back to all dates when no Friday in list", () => {
    const raw = ["2026-03-17", "2026-03-18"];
    expect(preferFridayExpirations(raw)).toEqual(["2026-03-17", "2026-03-18"]);
  });
});

describe("buildUpcomingFridayExpirations", () => {
  it("builds future friday grid from provided date", () => {
    const rows = buildUpcomingFridayExpirations({
      fromDate: new Date("2026-03-18T10:00:00.000Z"),
      count: 4
    });
    expect(rows).toEqual(["2026-03-20", "2026-03-27", "2026-04-03", "2026-04-10"]);
  });
});
