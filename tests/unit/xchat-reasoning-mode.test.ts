import { describe, expect, it } from "vitest";

import {
    resolveReasoningEffortFromAskPayload,
    xchatDepthRoutingModelLabel
} from "@/modules/xchat/xchat-reasoning-mode";

describe("resolveReasoningEffortFromAskPayload", () => {
  it("maps reasoningMode presets and clears on fast", () => {
    expect(resolveReasoningEffortFromAskPayload({ reasoningMode: "fast" })).toBeUndefined();
    expect(resolveReasoningEffortFromAskPayload({ reasoningMode: "expert" })).toBe("medium");
    expect(resolveReasoningEffortFromAskPayload({ reasoningMode: "heavy" })).toBe("high");
  });

  it("maps depth presets to user-visible routing model labels", () => {
    expect(xchatDepthRoutingModelLabel("fast")).toBe("Grok 4.1 Fast");
    expect(xchatDepthRoutingModelLabel("expert")).toBe("Grok 4.5");
    expect(xchatDepthRoutingModelLabel("heavy")).toBe("Grok 4.5");
  });

  it("passes through reasoningEffort when reasoningMode is absent", () => {
    expect(
      resolveReasoningEffortFromAskPayload({
        reasoningEffort: "low"
      })
    ).toBe("low");
    expect(
      resolveReasoningEffortFromAskPayload({
        reasoningEffort: "none"
      })
    ).toBe("none");
  });
});
