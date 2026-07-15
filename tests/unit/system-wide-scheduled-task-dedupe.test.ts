import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
    dedupeSystemWideScheduledTasksByCategory,
    isSystemWideMultiInstanceCategory,
    pickCanonicalSystemWideScheduledTask
} from "@/lib/system-wide-scheduled-task-dedupe";
import type { ScheduledTask } from "@/modules/core-admin/types";

function row(
  category: ScheduledTask["category"],
  overrides: Partial<ScheduledTask> = {}
): ScheduledTask {
  return {
    name: "job",
    category,
    enabled: true,
    scheduleCron: "0 * * * *",
    ...overrides
  };
}

describe("system-wide scheduled task dedupe", () => {
  it("keeps defaultJobName row over legacy displayName duplicate", () => {
    const legacy = row("sync-broker", {
      _id: new ObjectId("507f1f77bcf86cd799439098"),
      name: "Broker sync (hourly Mon–Fri 14–21 UTC)"
    });
    const canonical = row("sync-broker", {
      _id: new ObjectId("507f1f77bcf86cd799439099"),
      name: "sync-broker-job"
    });
    const picked = pickCanonicalSystemWideScheduledTask([legacy, canonical]);
    expect(picked.name).toBe("sync-broker-job");
  });

  it("returns one row per category", () => {
    const rows = [
      row("sync-broker", { name: "Broker sync (hourly Mon–Fri 14–21 UTC)" }),
      row("sync-broker", { name: "sync-broker-job" }),
      row("price_scanner", { name: "price-scanner-job" })
    ];
    const deduped = dedupeSystemWideScheduledTasksByCategory(rows);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((r) => r.category).sort()).toEqual(["price_scanner", "sync-broker"]);
    expect(deduped.find((r) => r.category === "sync-broker")?.name).toBe("sync-broker-job");
  });

  it("keeps every marketing_post schedule (multi-instance category)", () => {
    expect(isSystemWideMultiInstanceCategory("marketing_post")).toBe(true);
    const rows = [
      row("marketing_post", {
        _id: new ObjectId("507f1f77bcf86cd7994390a1"),
        name: "Monday Pulse"
      }),
      row("marketing_post", {
        _id: new ObjectId("507f1f77bcf86cd7994390a2"),
        name: "Friday Wrap"
      }),
      row("sync-broker", { name: "sync-broker-job" }),
      row("sync-broker", { name: "legacy-broker" })
    ];
    const deduped = dedupeSystemWideScheduledTasksByCategory(rows);
    expect(deduped.filter((r) => r.category === "marketing_post")).toHaveLength(2);
    expect(deduped.filter((r) => r.category === "sync-broker")).toHaveLength(1);
    expect(deduped.map((r) => r.name)).toEqual(["Friday Wrap", "Monday Pulse", "sync-broker-job"]);
  });
});
