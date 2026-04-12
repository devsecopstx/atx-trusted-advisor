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

  it("parses lastUpdatedAt from ISO string (BSON / JSON round-trips)", () => {
    const iso = "2026-04-11T12:00:00.000Z";
    const out = normalizeWatchlistDocumentSymbols(
      [{ symbol: "X", addedAt: new Date("2020-01-01"), lastUpdatedAt: iso }],
      []
    );
    expect(out[0]?.lastUpdatedAt?.toISOString()).toBe(iso);
  });

  it("preserves duplicate ticker rows (scanner + UI use independent desk lines)", () => {
    const d1 = new Date("2020-01-01T00:00:00.000Z");
    const d2 = new Date("2021-06-01T00:00:00.000Z");
    const out = normalizeWatchlistDocumentSymbols(
      [
        { symbol: "TSLA", addedAt: d1, rationale: "leg A" },
        {
          symbol: "TSLA",
          addedAt: d2,
          rationale: "[Watchlist price scan 2026-04-01] Spot $250.00 — review desk thesis.",
          rowStatus: "review" as const
        }
      ],
      []
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.symbol).toBe("TSLA");
    expect(out[0]?.rationale).toBe("leg A");
    expect(out[1]?.symbol).toBe("TSLA");
    expect(out[1]?.rationale).toContain("Watchlist price scan");
    expect(out[1]?.rowStatus).toBe("review");
  });
});
