import { describe, expect, it } from "vitest";

import { formatUserWorkspaceSummaryBlock } from "@/modules/xchat/user-workspace-summary-for-prompt";
import {
    isQuantTraderPersona,
    personaDefaultReasoningMode,
    shouldForceReasoningModeForPersona,
    XPERSONA_NAME_QUANT_TRADER
} from "@/modules/xchat/xchat-reasoning-mode";

describe("xchat persona reasoning defaults", () => {
  it("defaults finance-advisor to fast and quant-trader to heavy", () => {
    expect(personaDefaultReasoningMode("finance-advisor")).toBe("fast");
    expect(personaDefaultReasoningMode("quant-trader")).toBe("heavy");
    expect(personaDefaultReasoningMode("advisor")).toBeNull();
  });

  it("forces heavy whenever quant-trader is selected", () => {
    expect(shouldForceReasoningModeForPersona(XPERSONA_NAME_QUANT_TRADER)).toBe("heavy");
    expect(shouldForceReasoningModeForPersona("finance-advisor")).toBeNull();
  });

  it("detects quant-trader persona rows", () => {
    expect(isQuantTraderPersona({ nameNormalized: "quant-trader" })).toBe(true);
    expect(isQuantTraderPersona({ name: "quant-trader" })).toBe(true);
    expect(isQuantTraderPersona({ name: "advisor" })).toBe(false);
  });

  it("appends quant desk instruction to workspace summary block", () => {
    const block = formatUserWorkspaceSummaryBlock(
      {
        workspace: {
          activePortfolio: "Main",
          activePortfolioId: "507f1f77bcf86cd799439011",
          portfolios: []
        }
      },
      { quantTraderDesk: true }
    );
    expect(block).toContain("Quant Trader context");
    expect(block).toContain("bookTailRisk");
  });
});
