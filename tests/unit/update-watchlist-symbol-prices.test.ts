import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { getDb } from "@/lib/mongodb";
import { updateWatchlistSymbolPrices } from "@/modules/core-admin/repository";

describe("updateWatchlistSymbolPrices", () => {
  const findOne = vi.fn();
  const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({
      collection: () => ({
        findOne,
        updateOne
      })
    } as never);
  });

  it("returns 0 and skips Mongo when priceUpdates is empty", async () => {
    const n = await updateWatchlistSymbolPrices(new ObjectId(), []);
    expect(n).toBe(0);
    expect(findOne).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("merges by normalized symbol (Yahoo uppercase vs stored lowercase)", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: [
        { symbol: "aapl", addedAt: new Date("2020-01-01") },
        { symbol: "MSFT", addedAt: new Date("2020-01-01") }
      ]
    });

    const n = await updateWatchlistSymbolPrices(wid, [
      { symbol: "AAPL", lastPrice: 100, lastUpdatedAt: t },
      { symbol: "msft", lastPrice: 200, lastUpdatedAt: t }
    ]);

    expect(n).toBe(2);
    expect(updateOne).toHaveBeenCalledTimes(1);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<{ symbol: string; lastPrice: number }> } }];
    expect(payload.$set.symbols[0]?.symbol).toBe("aapl");
    expect(payload.$set.symbols[0]?.lastPrice).toBe(100);
    expect(payload.$set.symbols[1]?.symbol).toBe("MSFT");
    expect(payload.$set.symbols[1]?.lastPrice).toBe(200);
  });

  it("sets rationale and rowStatus on matched rows", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: [{ symbol: "AAPL", addedAt: new Date("2020-01-01") }]
    });

    const rat = "Prior\n\n[Watchlist price scan 2026-04-03] Spot $100.00 — review desk thesis.";
    const n = await updateWatchlistSymbolPrices(wid, [
      {
        symbol: "AAPL",
        lastPrice: 100,
        lastUpdatedAt: t,
        rationale: rat,
        rowStatus: "review"
      }
    ]);

    expect(n).toBe(1);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<Record<string, unknown>> } }];
    const row = payload.$set.symbols[0] as { rationale?: string; rowStatus?: string };
    expect(row.rationale).toContain("Watchlist price scan");
    expect(row.rowStatus).toBe("review");
  });

  it("returns 0 when no symbol keys match", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: [{ symbol: "GOOG", addedAt: new Date("2020-01-01") }]
    });

    const n = await updateWatchlistSymbolPrices(wid, [
      { symbol: "AAPL", lastPrice: 100, lastUpdatedAt: t }
    ]);

    expect(n).toBe(0);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("when every update has symbolRowIndex, patches each row independently (duplicate tickers)", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    const d0 = new Date("2020-01-01");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: [
        { symbol: "TSLA", addedAt: d0, rationale: "leg A" },
        { symbol: "TSLA", addedAt: d0, rationale: "leg B" }
      ]
    });

    const n = await updateWatchlistSymbolPrices(wid, [
      {
        symbol: "TSLA",
        symbolRowIndex: 0,
        lastPrice: 100,
        lastUpdatedAt: t,
        rationale: "scan A",
        rowStatus: "review"
      },
      {
        symbol: "TSLA",
        symbolRowIndex: 1,
        lastPrice: 100,
        lastUpdatedAt: t,
        rationale: "scan B",
        rowStatus: "review"
      }
    ]);

    expect(n).toBe(2);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<{ rationale?: string }> } }];
    expect(payload.$set.symbols[0]?.rationale).toBe("scan A");
    expect(payload.$set.symbols[1]?.rationale).toBe("scan B");
  });

  it("merges legacy string rows without corrupting BSON (symbol mode)", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: ["aapl", "MSFT"]
    });

    const n = await updateWatchlistSymbolPrices(wid, [
      { symbol: "AAPL", lastPrice: 100, lastUpdatedAt: t },
      { symbol: "msft", lastPrice: 200, lastUpdatedAt: t }
    ]);

    expect(n).toBe(2);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<Record<string, unknown>> } }];
    expect(payload.$set.symbols[0]).toMatchObject({ symbol: "AAPL", lastPrice: 100 });
    expect("0" in (payload.$set.symbols[0] as object)).toBe(false);
    expect(payload.$set.symbols[1]).toMatchObject({ symbol: "MSFT", lastPrice: 200 });
  });

  it("merges legacy string rows in symbolRowIndex mode", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: ["TSLA", "TSLA"]
    });

    const n = await updateWatchlistSymbolPrices(wid, [
      {
        symbol: "TSLA",
        symbolRowIndex: 0,
        lastPrice: 100,
        lastUpdatedAt: t,
        rationale: "a",
        rowStatus: "review"
      },
      {
        symbol: "TSLA",
        symbolRowIndex: 1,
        lastPrice: 101,
        lastUpdatedAt: t,
        rationale: "b",
        rowStatus: "review"
      }
    ]);

    expect(n).toBe(2);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<Record<string, unknown>> } }];
    expect(payload.$set.symbols[0]).toMatchObject({ symbol: "TSLA", lastPrice: 100, rationale: "a" });
    expect(payload.$set.symbols[1]).toMatchObject({ symbol: "TSLA", lastPrice: 101, rationale: "b" });
  });

  it("falls back to symbol-key merge when symbolRowIndex no longer matches row order (concurrent reorder)", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    /** Scanner thought row0=AAPL, row1=MSFT; Mongo was reordered before write. */
    findOne.mockResolvedValue({
      _id: wid,
      symbols: [
        { symbol: "MSFT", addedAt: new Date("2020-01-01") },
        { symbol: "AAPL", addedAt: new Date("2020-01-01") }
      ]
    });

    const n = await updateWatchlistSymbolPrices(wid, [
      {
        symbol: "AAPL",
        symbolRowIndex: 0,
        lastPrice: 100,
        lastUpdatedAt: t,
        rationale: "rA",
        rowStatus: "review"
      },
      {
        symbol: "MSFT",
        symbolRowIndex: 1,
        lastPrice: 200,
        lastUpdatedAt: t,
        rationale: "rM",
        rowStatus: "review"
      }
    ]);

    expect(n).toBe(2);
    expect(updateOne).toHaveBeenCalledTimes(1);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<Record<string, unknown>> } }];
    const rows = payload.$set.symbols;
    const msft = rows.find((r) => (r as { symbol?: string }).symbol === "MSFT") as { rationale?: string };
    const aapl = rows.find((r) => (r as { symbol?: string }).symbol === "AAPL") as { rationale?: string };
    expect(msft.rationale).toBe("rM");
    expect(aapl.rationale).toBe("rA");
  });

  it("merges rationale without overwriting lastPrice when price fields omitted", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    findOne.mockResolvedValue({
      _id: wid,
      symbols: [{ symbol: "AAPL", addedAt: new Date("2020-01-01"), lastPrice: 99, lastUpdatedAt: t }]
    });

    const rat = "Desk note only";
    const n = await updateWatchlistSymbolPrices(wid, [
      {
        symbol: "AAPL",
        lastUpdatedAt: undefined,
        rationale: rat,
        rowStatus: "review"
      }
    ]);

    expect(n).toBe(1);
    const [, payload] = updateOne.mock.calls[0] as [unknown, { $set: { symbols: Array<Record<string, unknown>> } }];
    const row = payload.$set.symbols[0] as { lastPrice?: number; rationale?: string; rowStatus?: string };
    expect(row.lastPrice).toBe(99);
    expect(row.rationale).toBe(rat);
    expect(row.rowStatus).toBe("review");
  });
});
