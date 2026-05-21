import { describe, expect, it } from "vitest";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    collectOptionsChainSymbolsFromPositions,
    mergeOptionsChainSymbolList,
    resolveDefaultOptionsChainSymbol
} from "@/app/portfolio/lib/portfolio-options-chain-symbols";

const positions: SerializablePosition[] = [
  { _id: "1", type: "stock", symbol: "tsla", shares: 100, purchasePrice: 200 },
  { _id: "2", type: "stock", symbol: "RDW", shares: 50, purchasePrice: 10 },
  {
    _id: "3",
    type: "option",
    symbol: "AAPL240419C00195000",
    yahooRef: "AAPL240419C00195000",
    optionType: "call",
    strike: 195,
    expiration: "2024-04-19",
    contracts: 1,
    premiumPerContract: 2.5
  },
  { _id: "4", type: "cash", label: "Sweep", amount: 1000, amountFormatted: "$1,000.00" }
];

describe("portfolio-options-chain-symbols", () => {
  it("collects normalized stock and option underlyings, skips cash", () => {
    expect(collectOptionsChainSymbolsFromPositions(positions)).toEqual(["TSLA", "RDW", "AAPL"]);
  });

  it("merges holdings and manual symbols without duplicates", () => {
    expect(mergeOptionsChainSymbolList(["TSLA", "RDW"], ["rdw", "cifr"])).toEqual(["TSLA", "RDW", "CIFR"]);
  });

  it("prefers explicit query symbol when valid", () => {
    expect(resolveDefaultOptionsChainSymbol(["TSLA"], "cifr")).toBe("CIFR");
  });

  it("falls back to first holdings symbol", () => {
    expect(resolveDefaultOptionsChainSymbol(["TSLA", "RDW"], null)).toBe("TSLA");
    expect(resolveDefaultOptionsChainSymbol([], null)).toBeNull();
  });
});
