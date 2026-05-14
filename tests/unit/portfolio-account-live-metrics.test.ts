import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { aggregateAccountLiveFromQuotes } from "@/lib/portfolio-account-live-metrics";
import type { Account } from "@/modules/core-admin/types";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

function q(partial: Partial<SymbolLookupResult> & Pick<SymbolLookupResult, "symbol">): SymbolLookupResult {
  return {
    source: "yahoo-finance2",
    ...partial
  };
}

describe("aggregateAccountLiveFromQuotes", () => {
  it("sums market value, day P&L, and portfolio % per account", () => {
    const idA = new ObjectId();
    const idB = new ObjectId();
    const hexA = idA.toHexString();
    const hexB = idB.toHexString();

    const accounts: Array<Pick<Account, "cashBalance"> & { _id: ObjectId }> = [
      { _id: idA, cashBalance: 10_000 },
      { _id: idB, cashBalance: 5_000 }
    ];

    const positionsByAccount = {
      [hexA]: [
        {
          _id: "p1",
          type: "stock" as const,
          symbol: "AAPL",
          shares: 10,
          purchasePrice: 100
        }
      ],
      [hexB]: []
    };

    const quotesRecord: Record<string, SymbolLookupResult | null> = {
      AAPL: q({ symbol: "AAPL", price: 110, change: 1, changePercent: 0.91 })
    };

    const out = aggregateAccountLiveFromQuotes(quotesRecord, positionsByAccount, accounts, 0);

    expect(out[hexA]?.marketValueUsd).toBe(11_100);
    expect(out[hexA]?.dayGainUsd).toBe(10);
    expect(out[hexB]?.marketValueUsd).toBe(5_000);
    expect(out[hexB]?.dayGainUsd).toBeNull();

    const totalPct = (out[hexA]?.pctOfPortfolio ?? 0) + (out[hexB]?.pctOfPortfolio ?? 0);
    expect(totalPct).toBeCloseTo(100, 5);
  });
});
