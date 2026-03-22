import { describe, expect, it } from "vitest";

import { parseWatchlistCsv } from "@/modules/watchlist/parse-watchlist-csv";

describe("parseWatchlistCsv", () => {
  it("parses comma export with Symbol header", () => {
    const csv = [
      "Symbol,Company,Price,ChangePct,Volume,Strategy,Entry,Rationale",
      `TSLA,"Tesla, Inc.",100,1.5,1e6,,,`,
      "AAPL,\"Apple Inc\",200,,,,,"
    ].join("\n");
    const { symbols, invalidRowCount } = parseWatchlistCsv(csv);
    expect(symbols).toEqual(["TSLA", "AAPL"]);
    expect(invalidRowCount).toBe(0);
  });

  it("parses semicolon-separated headers (Excel EU)", () => {
    const csv = [
      "Symbol;Company;Price",
      "RKLB;Rocket Lab;10",
      "PLTR;Palantir;25"
    ].join("\n");
    expect(parseWatchlistCsv(csv).symbols).toEqual(["RKLB", "PLTR"]);
  });

  it("parses simple one-column list without header", () => {
    const csv = "tsla\naapl\n\nMSFT";
    expect(parseWatchlistCsv(csv).symbols).toEqual(["TSLA", "AAPL", "MSFT"]);
  });

  it("dedupes repeated tickers", () => {
    const csv = "Symbol\nTSLA\nTSLA\nAAPL";
    expect(parseWatchlistCsv(csv).symbols).toEqual(["TSLA", "AAPL"]);
  });

  it("counts invalid rows", () => {
    const csv = "Symbol\n\nBAD SYMBOL!\nTSLA";
    const r = parseWatchlistCsv(csv);
    expect(r.symbols).toEqual(["TSLA"]);
    expect(r.invalidRowCount).toBeGreaterThanOrEqual(1);
  });

  it("strips BOM", () => {
    const csv = "\uFEFFSymbol\nNVDA";
    expect(parseWatchlistCsv(csv).symbols).toEqual(["NVDA"]);
  });
});
