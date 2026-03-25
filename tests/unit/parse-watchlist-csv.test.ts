import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseWatchlistCsv } from "@/modules/watchlist/parse-watchlist-csv";

function symbolsOf(text: string): string[] {
  return parseWatchlistCsv(text).entries.map((e) => e.symbol);
}

describe("parseWatchlistCsv", () => {
  it("parses comma export with Symbol header", () => {
    const csv = [
      "Symbol,Company,Price,ChangePct,Volume,Strategy,Entry,Rationale",
      `TSLA,"Tesla, Inc.",100,1.5,1e6,,,`,
      "AAPL,\"Apple Inc\",200,,,,,"
    ].join("\n");
    const { entries, invalidRowCount } = parseWatchlistCsv(csv);
    expect(entries.map((e) => e.symbol)).toEqual(["TSLA", "AAPL"]);
    expect(invalidRowCount).toBe(0);
    expect(entries.find((e) => e.symbol === "TSLA")?.entryPrice).toBe(100);
    expect(entries.find((e) => e.symbol === "AAPL")?.entryPrice).toBe(200);
  });

  it("uses dedicated Entry Price over quote Price when both are set", () => {
    const csv = [
      "Symbol,Price,Entry Price",
      "TSLA,999.99,250.5",
      "NVDA,500,501"
    ].join("\n");
    const { entries } = parseWatchlistCsv(csv);
    expect(entries.find((e) => e.symbol === "TSLA")?.entryPrice).toBe(250.5);
    expect(entries.find((e) => e.symbol === "NVDA")?.entryPrice).toBe(501);
  });

  it("parses semicolon-separated headers (Excel EU)", () => {
    const csv = [
      "Symbol;Company;Price",
      "RKLB;Rocket Lab;10",
      "PLTR;Palantir;25"
    ].join("\n");
    expect(symbolsOf(csv)).toEqual(["RKLB", "PLTR"]);
  });

  it("parses simple one-column list without header", () => {
    const csv = "tsla\naapl\n\nMSFT";
    expect(symbolsOf(csv)).toEqual(["TSLA", "AAPL", "MSFT"]);
  });

  it("dedupes repeated tickers (last row wins)", () => {
    const csv = "Symbol,Type\nTSLA,First\nTSLA,Second\nAAPL,Stock";
    const { entries } = parseWatchlistCsv(csv);
    expect(entries.find((e) => e.symbol === "TSLA")?.lineType).toBe("Second");
    expect(entries.map((e) => e.symbol).sort()).toEqual(["AAPL", "TSLA"]);
  });

  it("counts invalid rows", () => {
    const csv = "Symbol\n\nBAD SYMBOL!\nTSLA";
    const r = parseWatchlistCsv(csv);
    expect(r.entries.map((e) => e.symbol)).toEqual(["TSLA"]);
    expect(r.invalidRowCount).toBeGreaterThanOrEqual(1);
  });

  it("strips BOM", () => {
    const csv = "\uFEFFSymbol\nNVDA";
    expect(symbolsOf(csv)).toEqual(["NVDA"]);
  });

  it("imports Type, Strategy, Quantity, Entry Price", () => {
    const csv = [
      "Symbol,Type,Strategy,Quantity,Entry Price",
      "TSLA,Stock,Long,100,250.5",
      'AAPL,Stock,Short,50,"$180.25"'
    ].join("\n");
    const { entries } = parseWatchlistCsv(csv);
    expect(entries).toEqual([
      {
        symbol: "TSLA",
        lineType: "Stock",
        strategy: "Long",
        quantity: 100,
        entryPrice: 250.5
      },
      {
        symbol: "AAPL",
        lineType: "Stock",
        strategy: "Short",
        quantity: 50,
        entryPrice: 180.25
      }
    ]);
  });

  it("parses semicolon Type Strategy Quantity Entry Price", () => {
    const csv = "Symbol;Type;Strategy;Quantity;Entry Price\nRKLB;Stock;Swing;10;24.5";
    const { entries } = parseWatchlistCsv(csv);
    expect(entries[0]).toMatchObject({
      symbol: "RKLB",
      lineType: "Stock",
      strategy: "Swing",
      quantity: 10,
      entryPrice: 24.5
    });
  });

  it("parses atx-docs/atx-branding/atxfinance-watchlist.csv (Symbol, Underlying, Type, Strategy, Quantity, Entry Price)", () => {
    const csv = readFileSync(
      path.join(process.cwd(), "atx-docs", "atx-branding", "atxfinance-watchlist.csv"),
      "utf8"
    );
    const { entries, invalidRowCount } = parseWatchlistCsv(csv);
    expect(invalidRowCount).toBe(0);
    expect(entries.length).toBe(15);
    expect(entries.find((e) => e.symbol === "RTX")).toMatchObject({
      lineType: "Stock",
      strategy: "Long Stock",
      quantity: 100,
      entryPrice: 198.16
    });
    expect(entries.find((e) => e.symbol === "TSLA260327C00370000")).toMatchObject({
      lineType: "Covered Call",
      strategy: "Covered Call",
      quantity: 10,
      entryPrice: 367.96
    });
  });
});
