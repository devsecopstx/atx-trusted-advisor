import { describe, expect, it } from "vitest";

import { resolveReasoningEffortFromAskPayload } from "@/modules/xchat/xchat-reasoning-mode";

describe("resolveReasoningEffortFromAskPayload", () => {
  it("maps reasoningMode presets and clears on fast", () => {
    expect(resolveReasoningEffortFromAskPayload({ reasoningMode: "fast" })).toBeUndefined();
    expect(resolveReasoningEffortFromAskPayload({ reasoningMode: "expert" })).toBe("medium");
    expect(resolveReasoningEffortFromAskPayload({ reasoningMode: "heavy" })).toBe("high");
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
