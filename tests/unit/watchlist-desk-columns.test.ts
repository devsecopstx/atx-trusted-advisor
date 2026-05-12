import { describe, expect, it } from "vitest";

import {
    deskGridTemplateColumns,
    mergeDeskColumnVisibility,
    visibleDeskColumnIds,
    WATCHLIST_DESK_COLUMN_ORDER,
    WATCHLIST_DESK_GRID_TRACKS,
    WATCHLIST_DESK_GRID_TRACKS_COMPACT
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
    expect(v.includes("status")).toBe(false);
    expect(v.includes("rationale")).toBe(false);
  });

  it("deskGridTemplateColumns joins tracks in order", () => {
    const ids = visibleDeskColumnIds({});
    expect(ids).toEqual([...WATCHLIST_DESK_COLUMN_ORDER]);
    const tpl = deskGridTemplateColumns(ids);
    expect(tpl.startsWith(`${WATCHLIST_DESK_GRID_TRACKS.icon} `)).toBe(true);
    expect(tpl.includes("minmax(")).toBe(true);
  });

  it("deskGridTemplateColumns uses compact tracks when requested", () => {
    const ids = visibleDeskColumnIds({ spot: false });
    const tpl = deskGridTemplateColumns(ids, true);
    expect(tpl.startsWith(`${WATCHLIST_DESK_GRID_TRACKS_COMPACT.icon} `)).toBe(true);
    expect(tpl.includes(WATCHLIST_DESK_GRID_TRACKS_COMPACT.symbolLeg)).toBe(true);
    expect(tpl.includes(WATCHLIST_DESK_GRID_TRACKS.spot)).toBe(false);
  });
});
