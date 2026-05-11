import { describe, expect, it } from "vitest";

import { parseYahooOptionContractId, toYahooOptionContractId } from "@/lib/xoptions/xoptions-contract-id";

describe("xoptions contract id helpers", () => {
  it("round-trips a Yahoo option contract id", () => {
    const id = toYahooOptionContractId({
      underlying: "TSLA",
      expirationYyyyMmDd: "2026-01-30",
      side: "call",
      strike: 170
    });
    const parsed = parseYahooOptionContractId(id);
    expect(parsed).toEqual({
      underlying: "TSLA",
      expirationYyyyMmDd: "2026-01-30",
      side: "call",
      strike: 170
    });
  });
});
