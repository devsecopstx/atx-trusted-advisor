import { describe, expect, it } from "vitest";

import { pickWheelOutlookFromChain } from "@/modules/portfolio/investment-outlooks";
import type { OptionContractData } from "@/modules/strategy-options/options-chain";

function mkCall(strike: number, probAway: number): OptionContractData {
  return {
    ticker: "O:X",
    yahoo_symbol: "",
    strike_price: strike,
    expiration_date: "2026-06-19",
    contract_type: "call",
    premium: 1,
    totalPremium: 100,
    last_quote: { bid: 1, ask: 1 },
    volume: 0,
    open_interest: 0,
    implied_volatility: 30,
    rationale: "",
    probability_called_away: probAway,
    dataSource: "test"
  };
}

function mkPut(strike: number, probOtm: number): OptionContractData {
  return {
    ticker: "O:X",
    yahoo_symbol: "",
    strike_price: strike,
    expiration_date: "2026-06-19",
    contract_type: "put",
    premium: 1,
    totalPremium: 100,
    last_quote: { bid: 1, ask: 1 },
    volume: 0,
    open_interest: 0,
    implied_volatility: 30,
    rationale: "",
    probability_expire_otm: probOtm,
    dataSource: "test"
  };
}

describe("pickWheelOutlookFromChain", () => {
  it("picks near-ATM aggressive call and lower-assignment conservative among OTM calls", () => {
    const spot = 100;
    const chain = [
      { strike: 95, call: mkCall(95, 0.55), put: mkPut(95, 0.2) },
      { strike: 100, call: mkCall(100, 0.48), put: mkPut(100, 0.5) },
      { strike: 105, call: mkCall(105, 0.22), put: mkPut(105, 0.72) },
      { strike: 110, call: mkCall(110, 0.12), put: mkPut(110, 0.81) }
    ];
    const out = pickWheelOutlookFromChain(chain, spot);
    expect(out.coveredCall.aggressive?.strike).toBe(100);
    expect(out.coveredCall.conservative?.strike).toBe(110);
    expect(out.cashSecuredPut.aggressive?.strike).toBe(100);
    expect(out.cashSecuredPut.conservative?.strike).toBe(95);
  });
});
