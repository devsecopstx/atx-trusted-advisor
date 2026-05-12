import { describe, expect, it } from "vitest";

import {
    isMultilineStickyPrompt,
    isStickyPromptCollapsible,
    stickyPromptHeadLine
} from "@/lib/xchat/xchat-sticky-prompt";

describe("xchat sticky prompt helpers", () => {
  it("treats newline prompts as multiline", () => {
    expect(isMultilineStickyPrompt("Line one\nLine two")).toBe(true);
    expect(isMultilineStickyPrompt("Single line")).toBe(false);
  });

  it("collapses Latest prompt chrome for multiline prompts or advisor loading", () => {
    expect(isStickyPromptCollapsible({ multiline: true, loading: false })).toBe(true);
    expect(isStickyPromptCollapsible({ multiline: false, loading: true })).toBe(true);
    expect(isStickyPromptCollapsible({ multiline: false, loading: false })).toBe(false);
  });

  it("uses the first non-empty line for collapsed preview", () => {
    expect(stickyPromptHeadLine("\n\nQuestion?\nA) one")).toBe("Question?");
    expect(stickyPromptHeadLine("   ")).toBe("[Empty prompt]");
  });
});
