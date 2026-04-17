import { describe, expect, it } from "vitest";

import {
    buildSimulateXoptionsHref,
    classifyAlertSurface,
    extractCloseKindFromBody,
    formatContractDeskLabel,
    formatRelativeTime,
    parseContractKey,
    parseContractKeyFromBody,
    scannerRuleLine
} from "@/lib/portfolio-alert-desk-present";

describe("portfolio-alert-desk-present", () => {
  it("classifies option scanner vs price alerts", () => {
    expect(classifyAlertSurface("Option scanner: BUY_TO_CLOSE TSLA", null)).toBe("options_scanner");
    expect(classifyAlertSurface("x", "[close:BUY_TO_CLOSE]")).toBe("options_scanner");
    expect(classifyAlertSurface("TSLA price alert", "Price moved 6.0% to $242")).toBe("watchlist_price");
    expect(classifyAlertSurface("Margin note", "body")).toBe("account_general");
  });

  it("parses contract key from body", () => {
    const body = `[afp:RDW|2026-04-17|9|call]
[close:BUY_TO_CLOSE]
note`;
    expect(parseContractKeyFromBody(body)).toBe("RDW|2026-04-17|9|call");
    const p = parseContractKey("RDW|2026-04-17|9|call");
    expect(p?.underlying).toBe("RDW");
    expect(p?.strike).toBe(9);
    expect(p?.optionType).toBe("call");
    expect(formatContractDeskLabel(p!)).toContain("RDW");
    expect(formatContractDeskLabel(p!)).toContain("$9");
  });

  it("extracts close kind", () => {
    expect(extractCloseKindFromBody("[close:BUY_TO_CLOSE]\n")).toBe("BUY_TO_CLOSE");
    expect(extractCloseKindFromBody("[close:SELL_TO_CLOSE]\n")).toBe("SELL_TO_CLOSE");
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-04-17T12:00:00.000Z");
    expect(formatRelativeTime("2026-04-17T11:30:00.000Z", now)).toMatch(/m ago/);
  });

  it("scannerRuleLine strips option scanner prefix", () => {
    expect(scannerRuleLine("Option scanner: BUY_TO_CLOSE RDW")).toBe("BUY_TO_CLOSE RDW");
  });

  it("buildSimulateXoptionsHref requires valid symbol", () => {
    expect(
      buildSimulateXoptionsHref({
        portfolioId: "aaaaaaaaaaaaaaaaaaaaaaaa",
        accountId: null,
        symbol: "RDW"
      })
    ).toContain("step=4");
    expect(
      buildSimulateXoptionsHref({
        portfolioId: "aaaaaaaaaaaaaaaaaaaaaaaa",
        accountId: null,
        symbol: "!!!"
      })
    ).toBeNull();
  });
});
