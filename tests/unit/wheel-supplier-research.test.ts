import { describe, expect, it } from "vitest";

import type { SymbolResearchPayload } from "@/modules/market/symbol-research";
import {
    buildSupplierResearchSummary,
    mapSymbolResearchToWheelSupplier
} from "@/modules/xoptions/wheel-supplier-research";
import type { WheelRelatedSupplierCandidate } from "@/modules/xoptions/wheel-types";

const baseCandidate: WheelRelatedSupplierCandidate = {
  symbol: "NVDA",
  companyName: "NVIDIA",
  relationship: "AI compute supplier",
  spotPrice: 900,
  avgImpliedVolatilityPct: 42,
  estimatedWheelYieldPct: 18,
  momentum30dPct: 2,
  score: 71,
  rationale: "High IV supports premium selling."
};

describe("buildSupplierResearchSummary", () => {
  it("combines session change, P/E, and top headline", () => {
    const summary = buildSupplierResearchSummary(
      "NVDA",
      {
        price: 910,
        changePercent: 1.25,
        trailingPe: 44.2,
        asOfIso: "2026-05-24T12:00:00.000Z"
      },
      [{ title: "Chip demand stays firm into Q3", link: "https://example.com/a" }]
    );
    expect(summary).toContain("+1.25% session");
    expect(summary).toContain("P/E 44.2");
    expect(summary).toContain("Latest: Chip demand");
  });
});

describe("mapSymbolResearchToWheelSupplier", () => {
  it("maps delayed quote and headlines onto supplier candidate", () => {
    const payload: SymbolResearchPayload = {
      quote: {
        symbol: "NVDA",
        companyName: "NVIDIA Corporation",
        price: 912.5,
        change: 8.2,
        changePercent: 0.91,
        bid: 912.4,
        ask: 912.6,
        volume: 42_000_000,
        dayLow: 905,
        dayHigh: 918,
        fiftyTwoWeekLow: 400,
        fiftyTwoWeekHigh: 950,
        trailingPe: 43.8
      },
      news: [
        {
          title: "Supply chain update",
          link: "https://finance.yahoo.com/news/1",
          publisher: "Reuters",
          publishedAtLabel: "May-24-2026 9:00 am et"
        }
      ],
      asOf: "2026-05-24T15:00:00.000Z",
      disclaimer: "Delayed data."
    };

    const out = mapSymbolResearchToWheelSupplier(baseCandidate, payload);
    expect(out.spotPrice).toBe(912.5);
    expect(out.companyName).toBe("NVIDIA Corporation");
    expect(out.research?.quote.price).toBe(912.5);
    expect(out.research?.headlines).toHaveLength(1);
    expect(out.research?.summary).toContain("Supply chain update");
  });
});
