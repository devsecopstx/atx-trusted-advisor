import { describe, expect, it } from "vitest";

import { computeNextRunAtFromCron } from "@/lib/scheduled-task-cron";

describe("scheduled-task-cron", () => {
  it("computes next weekday hourly run for 0 * * * 1-5", () => {
    const from = new Date("2026-03-27T15:10:00.000Z"); // Friday
    const next = computeNextRunAtFromCron("0 * * * 1-5", from);
    expect(next?.toISOString()).toBe("2026-03-27T16:00:00.000Z");
  });

  it("computes next 15 minute schedule", () => {
    const from = new Date("2026-03-27T15:10:00.000Z");
    const next = computeNextRunAtFromCron("*/15 * * * *", from);
    expect(next?.toISOString()).toBe("2026-03-27T15:15:00.000Z");
  });

  it("returns null for invalid expression", () => {
    const next = computeNextRunAtFromCron("invalid cron", new Date("2026-03-27T15:10:00.000Z"));
    expect(next).toBeNull();
  });
});
