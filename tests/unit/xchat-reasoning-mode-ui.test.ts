import { describe, expect, it } from "vitest";

import {
    xchatDepthComposerCaption,
    xchatDepthCostTier,
    xchatDepthPresetLabel
} from "@/modules/xchat/xchat-reasoning-mode";

describe("xchat reasoning depth UI helpers", () => {
  it("preset labels", () => {
    expect(xchatDepthPresetLabel("fast")).toBe("Fast");
    expect(xchatDepthPresetLabel("expert")).toBe("Expert");
    expect(xchatDepthPresetLabel("heavy")).toBe("Heavy");
  });

  it("cost tier hints", () => {
    expect(xchatDepthCostTier("fast")).toBe("$");
    expect(xchatDepthCostTier("expert")).toBe("$$");
    expect(xchatDepthCostTier("heavy")).toBe("$$$");
  });

  it("composer caption combines preset and routed model label", () => {
    expect(xchatDepthComposerCaption("fast")).toBe("Fast · Grok 4.1 Fast");
    expect(xchatDepthComposerCaption("expert")).toBe("Expert · Grok 4.3");
    expect(xchatDepthComposerCaption("heavy")).toBe("Heavy · Grok 4.3");
  });
});
