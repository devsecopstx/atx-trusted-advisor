import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
    type OptionScanTarget,
    contractKeyForTarget,
    inferSideFromWatchlistStrategy,
    mergeOptionScanTargets,
    parseOccOptionSymbol
} from "@/modules/strategy-options/options-scanner-targets";

describe("parseOccOptionSymbol", () => {
  it("parses Yahoo OCC ticker", () => {
    const p = parseOccOptionSymbol("TSLA260327C00370000");
    expect(p).not.toBeNull();
    expect(p?.underlying).toBe("TSLA");
    expect(p?.expYmd).toBe("2026-03-27");
    expect(p?.optionType).toBe("call");
    expect(p?.strike).toBe(370);
  });

  it("returns null for equity ticker", () => {
    expect(parseOccOptionSymbol("TSLA")).toBeNull();
  });
});

describe("inferSideFromWatchlistStrategy", () => {
  it("detects covered call as short call", () => {
    expect(inferSideFromWatchlistStrategy("Covered Call", "Option", "call")).toBe("short");
  });

  it("detects CSP as short put", () => {
    expect(inferSideFromWatchlistStrategy("CSP", "Option", "put")).toBe("short");
  });
});

describe("contractKeyForTarget", () => {
  const pf = new ObjectId();
  const acctA = new ObjectId();
  const acctB = new ObjectId();

  function pos(accountId: ObjectId | undefined, dedupKey: string): OptionScanTarget {
    return {
      dedupKey,
      source: "position",
      portfolioId: pf,
      accountId,
      underlying: "TSLA",
      expYmd: "2026-04-13",
      strike: 360,
      optionType: "call",
      avgCost: 1,
      qty: 1,
      side: "long"
    };
  }

  it("appends acct suffix when accountId is set", () => {
    const t = pos(acctA, "p1");
    expect(contractKeyForTarget(t)).toBe(`TSLA|2026-04-13|360|call|acct:${acctA.toHexString()}`);
  });

  it("omits acct for watchlist-style rows without account", () => {
    const t: OptionScanTarget = {
      dedupKey: "wl:1",
      source: "watchlist",
      portfolioId: pf,
      underlying: "TSLA",
      expYmd: "2026-04-13",
      strike: 360,
      optionType: "call",
      avgCost: 1,
      qty: 1,
      side: "short"
    };
    expect(contractKeyForTarget(t)).toBe("TSLA|2026-04-13|360|call");
  });

  it("mergeOptionScanTargets keeps two positions same contract different accounts", () => {
    const a = pos(acctA, "a");
    const b = pos(acctB, "b");
    const merged = mergeOptionScanTargets([a, b], []);
    expect(merged).toHaveLength(2);
  });

  it("mergeOptionScanTargets drops watchlist when any position covers naked contract", () => {
    const p = pos(acctA, "a");
    const wl: OptionScanTarget = {
      dedupKey: "wl",
      source: "watchlist",
      portfolioId: pf,
      underlying: "TSLA",
      expYmd: "2026-04-13",
      strike: 360,
      optionType: "call",
      avgCost: 1,
      qty: 1,
      side: "short"
    };
    expect(mergeOptionScanTargets([p], [wl])).toHaveLength(1);
    expect(mergeOptionScanTargets([p], [wl])[0]?.source).toBe("position");
  });
});
