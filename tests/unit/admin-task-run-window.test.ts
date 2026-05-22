import { describe, expect, it } from "vitest";

import { resolveTaskRunListWindowQuery } from "@/lib/admin-task-run-window";

describe("resolveTaskRunListWindowQuery", () => {
  it("today uses UTC midnight through next UTC midnight (exclusive)", () => {
    const now = new Date("2026-04-09T15:30:00.000Z");
    const q = resolveTaskRunListWindowQuery("today", now);
    expect(q.startedAtMin.toISOString()).toBe("2026-04-09T00:00:00.000Z");
    expect(q.startedAtMaxExclusive?.toISOString()).toBe("2026-04-10T00:00:00.000Z");
    expect(q.defaultLimit).toBe(150);
  });

  it("24h uses rolling 24-hour lower bound (admin hub failed-runs stat)", () => {
    const now = new Date("2026-04-09T15:30:00.000Z");
    const q = resolveTaskRunListWindowQuery("24h", now);
    expect(q.startedAtMaxExclusive).toBeUndefined();
    expect(q.startedAtMin.toISOString()).toBe("2026-04-08T15:30:00.000Z");
    expect(q.defaultLimit).toBe(500);
  });

  it("30d uses rolling lower bound and no exclusive max", () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const q = resolveTaskRunListWindowQuery("30d", now);
    expect(q.startedAtMaxExclusive).toBeUndefined();
    const expectedMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(q.startedAtMin.getTime()).toBe(expectedMin.getTime());
    expect(q.defaultLimit).toBe(500);
  });
});
