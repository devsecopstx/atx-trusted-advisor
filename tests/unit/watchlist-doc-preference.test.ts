import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import type { Watchlist } from "@/modules/core-admin/types";
import { pickPreferredWatchlistDocument } from "@/modules/watchlist/watchlist-doc-preference";

function wl(partial: Partial<Watchlist> & { _id?: ObjectId }): Watchlist {
  const _id = partial._id ?? new ObjectId();
  return {
    _id,
    userId: "u1",
    name: "WL",
    symbols: [],
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial
  };
}

describe("pickPreferredWatchlistDocument", () => {
  it("prefers the row with more symbols when updatedAt favors an empty doc", () => {
    const olderFull = wl({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      symbols: [{ symbol: "TSLA", addedAt: new Date() }],
      updatedAt: new Date("2024-01-01T00:00:00Z")
    });
    const newerEmpty = wl({
      _id: new ObjectId("507f1f77bcf86cd799439022"),
      symbols: [],
      updatedAt: new Date("2025-06-01T00:00:00Z")
    });
    expect(pickPreferredWatchlistDocument([newerEmpty, olderFull])?._id?.toHexString()).toBe(
      olderFull._id?.toHexString()
    );
  });

  it("on equal symbol count prefers user-global (no portfolioId)", () => {
    const sym = [{ symbol: "AAPL", addedAt: new Date() }];
    const scoped = wl({
      portfolioId: new ObjectId(),
      symbols: sym,
      updatedAt: new Date("2025-01-02T00:00:00Z")
    });
    const global = wl({
      symbols: sym,
      updatedAt: new Date("2025-01-01T00:00:00Z")
    });
    expect(pickPreferredWatchlistDocument([scoped, global])?._id?.toHexString()).toBe(
      global._id?.toHexString()
    );
  });
});
