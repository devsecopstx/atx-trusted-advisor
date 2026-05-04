import { describe, expect, it } from "vitest";

import { mergePortfolioAccountHnwiGuardrails } from "@/modules/core-admin/portfolio-account-hnwi-guardrails";

describe("mergePortfolioAccountHnwiGuardrails", () => {
  it("merges partial updates and removes keys when patched with null", () => {
    const merged = mergePortfolioAccountHnwiGuardrails(
      { taxTreatment: "taxable", maxPositionPctOfEquity: 0.1 },
      { maxPositionPctOfEquity: null, marginRule: "cash_only" }
    );
    expect(merged?.taxTreatment).toBe("taxable");
    expect(merged?.maxPositionPctOfEquity).toBeUndefined();
    expect(merged?.marginRule).toBe("cash_only");
  });

  it("returns null when no keys remain", () => {
    expect(
      mergePortfolioAccountHnwiGuardrails({ taxTreatment: "taxable" }, { taxTreatment: null })
    ).toBeNull();
  });
});
