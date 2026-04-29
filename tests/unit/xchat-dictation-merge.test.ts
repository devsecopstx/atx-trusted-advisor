import { describe, expect, it } from "vitest";

import { mergeDictationSegments } from "@/app/xchat/ui/xchat-dictation-client";

describe("mergeDictationSegments", () => {
  it("joins base and tail with a single space", () => {
    expect(mergeDictationSegments("hello", "world")).toBe("hello world");
  });

  it("returns tail when base empty", () => {
    expect(mergeDictationSegments("", "nvda")).toBe("nvda");
    expect(mergeDictationSegments("   ", "nvda")).toBe("nvda");
  });

  it("returns base when tail empty", () => {
    expect(mergeDictationSegments("keep", "")).toBe("keep");
    expect(mergeDictationSegments("keep", "   ")).toBe("keep");
  });
});
