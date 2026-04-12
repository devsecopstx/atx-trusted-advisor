import { afterEach, describe, expect, it, vi } from "vitest";

import type { HistoryItem } from "@/app/xchat/ui/xchat-conversation-types";
import { buildHistoryRailRows } from "@/app/xchat/ui/xchat-history-rail";

function item(id: string, iso: string, message: string): HistoryItem {
  return {
    id,
    message,
    response: "",
    model: "m",
    createdAt: iso,
    contextReferenceCount: 0,
    toolCallCount: 0
  };
}

describe("buildHistoryRailRows", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups Today / Past week / Earlier and sorts ascending within each section (local midnight)", () => {
    vi.useFakeTimers({ now: new Date("2026-04-11T16:00:00") });

    const newestFirst = [
      item("t2", "2026-04-11T20:00:00.000Z", "later today"),
      item("t1", "2026-04-11T08:00:00.000Z", "earlier today"),
      item("w1", "2026-04-09T12:00:00.000Z", "past week"),
      item("e1", "2026-03-01T10:00:00.000Z", "older")
    ];

    const rows = buildHistoryRailRows(newestFirst);
    expect(rows.filter((r) => r.kind === "header").map((r) => r.label)).toEqual([
      "Today",
      "Past week",
      "Earlier"
    ]);

    const itemMessages = rows.filter((r) => r.kind === "item").map((r) => r.item.message);
    expect(itemMessages).toEqual(["earlier today", "later today", "past week", "older"]);
  });
});
