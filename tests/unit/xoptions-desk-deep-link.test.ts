import { describe, expect, it } from "vitest";

import { buildXoptionsStrategyBuilderHref } from "@/lib/xoptions/xoptions-desk-deep-link";

const PORTFOLIO_ID = "69d45e032a07e00042249a4c";

describe("buildXoptionsStrategyBuilderHref", () => {
  it("includes symbol, portfolioId, step, strategy, and contract prefill for desk handoffs", () => {
    const href = buildXoptionsStrategyBuilderHref(PORTFOLIO_ID, "HAWK", {
      step: 4,
      strategyChoiceId: "covered-call",
      contractPrefill: {
        expirationYmd: "2026-06-18",
        strike: 50,
        contractType: "call"
      }
    });
    expect(href).toContain("/xoptions?");
    expect(href).toContain("symbol=HAWK");
    expect(href).toContain(`portfolioId=${PORTFOLIO_ID}`);
    expect(href).toContain("step=4");
    expect(href).toContain("strategy=covered-call");
    expect(href).toContain("expiration=2026-06-18");
    expect(href).toContain("contractType=call");
  });

  it("omits step when not requested", () => {
    const href = buildXoptionsStrategyBuilderHref(PORTFOLIO_ID, "TSLA");
    expect(href).not.toContain("step=");
  });
});
