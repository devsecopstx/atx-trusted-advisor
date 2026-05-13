import { describe, expect, it } from "vitest";

import {
    filterXchatPromptTemplates,
    resolveWheelCcScanComposerPrompt,
    XCHAT_HNWI_PROMPT_TEMPLATES,
    XCHAT_WHEEL_CC_SCAN_PROMPT
} from "@/modules/xchat/xchat-hnwi-templates";

describe("resolveWheelCcScanComposerPrompt", () => {
  it("replaces legacy desk JSON contract line with canonical markdown prompt", () => {
    const legacy =
      "From holdings + watchlist: up to three covered_call, wheel, or cash_secured_put ideas with strike, expiry, premium, contract sizing, annualized ROC, and assignment risk — desk JSON contract only.";
    expect(resolveWheelCcScanComposerPrompt(legacy)).toBe(XCHAT_WHEEL_CC_SCAN_PROMPT);
  });

  it("leaves unrelated prompts unchanged", () => {
    expect(resolveWheelCcScanComposerPrompt("What is a wheel strategy?")).toBe("What is a wheel strategy?");
  });

  it("leaves wheel copy without json marker unchanged", () => {
    expect(resolveWheelCcScanComposerPrompt(XCHAT_WHEEL_CC_SCAN_PROMPT)).toBe(XCHAT_WHEEL_CC_SCAN_PROMPT);
  });
});

describe("filterXchatPromptTemplates", () => {
  it("returns all templates when query empty", () => {
    expect(filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, "")).toHaveLength(
      XCHAT_HNWI_PROMPT_TEMPLATES.length
    );
  });

  it("filters by title substring", () => {
    const out = filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, "watchlist pass");
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("hnwi-v21-watchlist-pass");
  });

  it("filters by prompt body", () => {
    const out = filterXchatPromptTemplates(XCHAT_HNWI_PROMPT_TEMPLATES, "hedge");
    expect(out.length).toBeGreaterThanOrEqual(1);
  });
});
