import { describe, expect, it } from "vitest";

import { buildHotPickXchatPrompt } from "@/lib/portfolio/hot-picks-xchat-prompt";
import type { HotPickCard } from "@/modules/portfolios/hot-picks-types";

const basePick: HotPickCard = {
  id: "TSLA:2026-06-20:bull_put_spread:420",
  symbol: "TSLA",
  expirationYmd: "2026-06-20",
  strategy: "bull_put_spread",
  strategyLabel: "bull put spread",
  contractLabel: "TSLA 06/20 420P",
  outlook: "bullish",
  edgeScore: 72,
  entry: 1.25,
  breakeven: 418.75,
  popPercent: 68,
  estRoiPercent: 24,
  ivRankPercent: 42,
  maxGainPercent: 18,
  maxLossPercent: -32,
  rationale: "Premium is rich vs realized. Favor defined risk under book size.",
  legs: [
    {
      side: "sell",
      right: "put",
      strike: 420,
      expiryYmd: "2026-06-20",
      quantity: 1
    },
    {
      side: "buy",
      right: "put",
      strike: 415,
      expiryYmd: "2026-06-20",
      quantity: 1
    }
  ],
  greeks: null,
  ivSkew: null
};

describe("buildHotPickXchatPrompt", () => {
  it("includes structure, metrics, legs, and scanner note", () => {
    const prompt = buildHotPickXchatPrompt(basePick);
    expect(prompt).toContain("TSLA");
    expect(prompt).toContain("bull put spread");
    expect(prompt).toContain("Edge score: 72");
    expect(prompt).toContain("sell 420P");
    expect(prompt).toContain("Premium is rich");
    expect(prompt).toContain("strategy builder");
  });

  it("omits legs line when no leg strikes", () => {
    const prompt = buildHotPickXchatPrompt({ ...basePick, legs: [] });
    expect(prompt).not.toContain("· Legs:");
  });
});
