import { describe, expect, it } from "vitest";

import { normalizeWatchlistDocumentSymbols } from "@/modules/core-admin/repository";

describe("normalizeWatchlistDocumentSymbols", () => {
  it("adds TSLA when missing and preserves structured rows", () => {
    const d = new Date("2020-01-01T00:00:00.000Z");
    const out = normalizeWatchlistDocumentSymbols([{ symbol: "AAPL", addedAt: d }], ["TSLA"]);
    expect(out.map((s) => s.symbol).sort()).toEqual(["AAPL", "TSLA"]);
    const aapl = out.find((s) => s.symbol === "AAPL");
    expect(aapl?.addedAt.getTime()).toBe(d.getTime());
  });

  it("coerces legacy string rows and merges ensure list", () => {
    const out = normalizeWatchlistDocumentSymbols(["aapl"], ["TSLA"]);
    expect(out.map((s) => s.symbol).sort()).toEqual(["AAPL", "TSLA"]);
  });
});
