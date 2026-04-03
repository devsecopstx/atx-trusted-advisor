import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "@/lib/mongodb";
import { updateWatchlistSymbolPrices } from "@/modules/core-admin/repository";

describe("updateWatchlistSymbolPrices", () => {
  const bulkWrite = vi.fn().mockResolvedValue({ modifiedCount: 1 });

  beforeEach(() => {
    vi.clearAllMocks();
    bulkWrite.mockResolvedValue({ modifiedCount: 2 });
    vi.mocked(getDb).mockResolvedValue({
      collection: () => ({
        bulkWrite,
      }),
    } as never);
  });

  it("does not call Mongo when priceUpdates is empty", async () => {
    await updateWatchlistSymbolPrices(new ObjectId(), []);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it("bulkWrites one updateOne per symbol with a single arrayFilter each (not pipeline + multi-elem)", async () => {
    const wid = new ObjectId();
    const t = new Date("2026-04-03T12:00:00.000Z");
    await updateWatchlistSymbolPrices(wid, [
      { symbol: "AAPL", lastPrice: 100, lastUpdatedAt: t },
      { symbol: "MSFT", lastPrice: 200, lastUpdatedAt: t },
    ]);

    expect(bulkWrite).toHaveBeenCalledTimes(1);
    const [ops, options] = bulkWrite.mock.calls[0] as [
      Array<{
        updateOne: {
          filter: { _id: ObjectId };
          update: { $set: Record<string, unknown> };
          arrayFilters: Array<{ "elem.symbol": string }>;
        };
      }>,
      { ordered: boolean },
    ];

    expect(options).toEqual({ ordered: true });
    expect(ops).toHaveLength(2);
    expect(ops[0]!.updateOne.arrayFilters).toEqual([{ "elem.symbol": "AAPL" }]);
    expect(ops[1]!.updateOne.arrayFilters).toEqual([{ "elem.symbol": "MSFT" }]);
    expect(ops[0]!.updateOne.filter._id.equals(wid)).toBe(true);
    expect(ops[0]!.updateOne.update.$set["symbols.$[elem].lastPrice"]).toBe(100);
    expect(ops[1]!.updateOne.update.$set["symbols.$[elem].lastPrice"]).toBe(200);
  });
});
