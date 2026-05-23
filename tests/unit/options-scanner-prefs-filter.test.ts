import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
    filterOptionScanTargetsByMergedPrefs,
    mergeOptionsStrategyFilters,
    mergedScannerFiltersActive,
    optionScanTargetPassesMergedFilters
} from "@/modules/strategy-options/options-scanner-prefs-filter";
import type { OptionScanTarget } from "@/modules/strategy-options/options-scanner-targets";

function target(
  p: Pick<OptionScanTarget, "underlying" | "expYmd" | "optionType" | "source"> & Partial<OptionScanTarget>
): OptionScanTarget {
  return {
    dedupKey: "k",
    portfolioId: p.portfolioId ?? new ObjectId(),
    strike: p.strike ?? 100,
    avgCost: p.avgCost ?? 1,
    qty: p.qty ?? 1,
    side: p.side ?? "long",
    ...p
  };
}

describe("mergeOptionsStrategyFilters", () => {
  it("is permissive when no rows", () => {
    const m = mergeOptionsStrategyFilters([]);
    expect(mergedScannerFiltersActive(m)).toBe(false);
  });

  it("merges denylist and allowlist union", () => {
    const m = mergeOptionsStrategyFilters([
      { slug: "a", filters: { underlyingDenylist: ["BAD"], underlyingAllowlist: ["AAPL"] } },
      { slug: "b", filters: { underlyingAllowlist: ["MSFT"] } }
    ]);
    expect(m.underlyingDenylist.has("BAD")).toBe(true);
    expect(m.underlyingAllowlist?.has("AAPL")).toBe(true);
    expect(m.underlyingAllowlist?.has("MSFT")).toBe(true);
    expect(mergedScannerFiltersActive(m)).toBe(true);
  });

  it("combines minDte as max and maxDte as min", () => {
    const m = mergeOptionsStrategyFilters([
      { slug: "a", filters: { minDte: 5, maxDte: 60 } },
      { slug: "b", filters: { minDte: 10, maxDte: 45 } }
    ]);
    expect(m.minDte).toBe(10);
    expect(m.maxDte).toBe(45);
  });

  it("combines minIvRankPct as max", () => {
    const m = mergeOptionsStrategyFilters([
      { slug: "a", filters: { minIvRankPct: 45 } },
      { slug: "b", filters: { minIvRankPct: 60 } }
    ]);
    expect(m.minIvRankPct).toBe(60);
    expect(mergedScannerFiltersActive(m)).toBe(true);
  });
});

describe("optionScanTargetPassesMergedFilters", () => {
  it("blocks denied underlying", () => {
    const m = mergeOptionsStrategyFilters([
      { slug: "x", filters: { underlyingDenylist: ["IBM"] } }
    ]);
    expect(
      optionScanTargetPassesMergedFilters(
        target({ underlying: "IBM", expYmd: "2099-01-01", optionType: "call", source: "position" }),
        m
      )
    ).toBe(false);
    expect(
      optionScanTargetPassesMergedFilters(
        target({ underlying: "AAPL", expYmd: "2099-01-01", optionType: "call", source: "position" }),
        m
      )
    ).toBe(true);
  });

  it("respects optionTypes and sources", () => {
    const m = mergeOptionsStrategyFilters([
      { slug: "x", filters: { optionTypes: ["put"], sources: ["position"] } }
    ]);
    expect(
      optionScanTargetPassesMergedFilters(
        target({ underlying: "X", expYmd: "2099-01-01", optionType: "put", source: "position" }),
        m
      )
    ).toBe(true);
    expect(
      optionScanTargetPassesMergedFilters(
        target({ underlying: "X", expYmd: "2099-01-01", optionType: "call", source: "position" }),
        m
      )
    ).toBe(false);
    expect(
      optionScanTargetPassesMergedFilters(
        target({ underlying: "X", expYmd: "2099-01-01", optionType: "put", source: "watchlist" }),
        m
      )
    ).toBe(false);
  });
});

describe("filterOptionScanTargetsByMergedPrefs", () => {
  it("filters array", () => {
    const m = mergeOptionsStrategyFilters([{ slug: "z", filters: { underlyingDenylist: ["X"] } }]);
    const rows = [
      target({ underlying: "X", expYmd: "2099-01-01", optionType: "call", source: "position" }),
      target({ underlying: "Y", expYmd: "2099-01-01", optionType: "call", source: "position" })
    ];
    expect(filterOptionScanTargetsByMergedPrefs(rows, m)).toHaveLength(1);
  });
});
