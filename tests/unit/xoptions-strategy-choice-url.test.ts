import { describe, expect, it } from "vitest";

import {
  mapScannerStrategySlugToChoiceId,
  parseStrategyChoiceIdFromUrlParam
} from "@/lib/xoptions/xoptions-strategy-choice-url";
import { buildHotPickXoptionsStrategyBuilderHref } from "@/lib/portfolio/hot-picks-xoptions-link";
import type { HotPickCard } from "@/modules/portfolios/hot-picks-types";

describe("xoptions-strategy-choice-url", () => {
  it("maps scanner slugs and accepts builder ids in URL", () => {
    expect(mapScannerStrategySlugToChoiceId("covered_call")).toBe("covered-call");
    expect(parseStrategyChoiceIdFromUrlParam("covered-call")).toBe("covered-call");
    expect(parseStrategyChoiceIdFromUrlParam("covered_call")).toBe("covered-call");
  });

  it("builds hot pick deep link with step 4, strategy, and contract prefill", () => {
    const pick: HotPickCard = {
      id: "HAWK:2026-06-18:covered_call:50",
      symbol: "HAWK",
      expirationYmd: "2026-06-18",
      strategy: "covered_call",
      strategyLabel: "covered call",
      contractLabel: "HAWK 06/18 50C",
      outlook: "neutral",
      edgeScore: 70,
      entry: 1,
      breakeven: 51,
      popPercent: 60,
      estRoiPercent: 10,
      ivRankPercent: 40,
      maxGainPercent: 12,
      maxLossPercent: -20,
      rationale: "Test",
      legs: [
        {
          side: "sell",
          right: "call",
          strike: 50,
          expiryYmd: "2026-06-18",
          quantity: 1
        }
      ],
      greeks: null,
      ivSkew: null
    };
    const href = buildHotPickXoptionsStrategyBuilderHref("69d45e032a07e00042249a4c", pick);
    expect(href).toContain("symbol=HAWK");
    expect(href).toContain("step=4");
    expect(href).toContain("strategy=covered-call");
    expect(href).toContain("expiration=2026-06-18");
    expect(href).toContain("strike=50.00");
    expect(href).toContain("contractType=call");
  });
});
