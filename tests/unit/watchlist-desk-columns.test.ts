import { describe, expect, it } from "vitest";

import {
    deskGridTemplateColumns,
    mergeDeskColumnVisibility,
    visibleDeskColumnIds,
    WATCHLIST_DESK_COLUMN_ORDER,
    WATCHLIST_DESK_GRID_TRACKS
} from "@/app/watchlist/ui/watchlist-desk-columns";

describe("watchlist-desk-columns", () => {
  it("mergeDeskColumnVisibility strips non-hideable keys", () => {
    expect(mergeDeskColumnVisibility({ icon: false, spot: false })).toEqual({ spot: false });
  });

  it("visibleDeskColumnIds respects false for hideable columns", () => {
    const v = visibleDeskColumnIds({ spot: false, rsi: false });
    expect(v.includes("spot")).toBe(false);
    expect(v.includes("rsi")).toBe(false);
    expect(v.includes("icon")).toBe(true);
    expect(v.includes("rationale")).toBe(true);
  });

  it("deskGridTemplateColumns joins tracks in order", () => {
    const ids = visibleDeskColumnIds({});
    expect(ids).toEqual([...WATCHLIST_DESK_COLUMN_ORDER]);
    const tpl = deskGridTemplateColumns(ids);
    expect(tpl.startsWith(`${WATCHLIST_DESK_GRID_TRACKS.icon} `)).toBe(true);
    expect(tpl.includes("minmax(")).toBe(true);
  });
});
