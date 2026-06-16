import { describe, expect, it } from "vitest";

import {
  filterOptionsScanLegsForDesk,
  parseMaxCollateralUsdFromText,
  pickOptionsScanTopIdeas,
  rankOptionsScanLegsForDesk,
  type OptionsScanDeskLeg
} from "@/modules/xchat/options-scan-ranking";

function leg(strike: number, overrides: Partial<OptionsScanDeskLeg> = {}): OptionsScanDeskLeg {
  return {
    expiration: "2026-06-27",
    dte: 11,
    strike,
    optionType: "put",
    bid: 0.38,
    ask: 0.42,
    mid: 0.4,
    ivPct: 95,
    openInterest: 900,
    deltaAbs: 0.21,
    deltaRaw: -0.21,
    ...overrides
  };
}

describe("parseMaxCollateralUsdFromText", () => {
  it("parses fits 15k phrasing", () => {
    expect(parseMaxCollateralUsdFromText("CSP ideas for RDW 7-14 DTE that fits 15k")).toBe(15000);
  });
});

describe("filterOptionsScanLegsForDesk", () => {
  it("drops deep OTM junk puts far below spot", () => {
    const spot = 14.83;
    const legs = [
      leg(6.5, { mid: 0.04, openInterest: 6547, deltaAbs: 0 }),
      leg(13, { mid: 0.4, openInterest: 990, deltaAbs: 0.21 }),
      leg(13.5, { mid: 0.22, openInterest: 1200, deltaAbs: 0.12 })
    ];
    const filtered = filterOptionsScanLegsForDesk(legs, "put", { spot, maxCollateralUsd: 15000 });
    expect(filtered.map((x) => x.strike)).toEqual([13, 13.5]);
  });

  it("respects collateral budget", () => {
    const spot = 14.83;
    const legs = [leg(13, { mid: 0.4 }), leg(140, { mid: 2.5, openInterest: 500, deltaAbs: 0.3 })];
    const filtered = filterOptionsScanLegsForDesk(legs, "put", { spot, maxCollateralUsd: 15000 });
    expect(filtered.map((x) => x.strike)).toEqual([13]);
  });
});

describe("rankOptionsScanLegsForDesk", () => {
  it("ranks strikes near spot ahead of deep OTM when both present", () => {
    const spot = 14.83;
    const legs = [leg(12.5, { mid: 0.55 }), leg(13, { mid: 0.4 })];
    const ranked = rankOptionsScanLegsForDesk(legs, "put", { spot });
    expect(ranked[0]?.strike).toBeGreaterThan(12);
  });
});

describe("pickOptionsScanTopIdeas", () => {
  it("returns distinct tags when possible", () => {
    const legs = [
      leg(13, { mid: 0.5, openInterest: 2000, deltaAbs: 0.28 }),
      leg(12.5, { mid: 0.35, openInterest: 500, deltaAbs: 0.18 }),
      leg(12, { mid: 0.25, openInterest: 800, deltaAbs: 0.15 })
    ];
    const picks = pickOptionsScanTopIdeas(legs, "put");
    expect(picks).toHaveLength(3);
    expect(picks.map((p) => p.tag)).toContain("Best Yield");
    expect(picks.map((p) => p.tag)).toContain("Best Liquidity");
  });
});
