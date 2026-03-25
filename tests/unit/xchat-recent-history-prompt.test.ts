import { describe, expect, it } from "vitest";

import { buildRecentXchatHistoryPromptBlock } from "@/modules/xchat/xchat-recent-history-prompt";

describe("buildRecentXchatHistoryPromptBlock", () => {
  it("returns null for empty input", () => {
    expect(buildRecentXchatHistoryPromptBlock([])).toBeNull();
  });

  it("formats newest-first items in chronological order", () => {
    const block = buildRecentXchatHistoryPromptBlock(
      [
        {
          id: "2",
          message: "second",
          response: "B",
          model: "m",
          createdAt: new Date("2026-03-02T00:00:00.000Z"),
          contextReferenceCount: 0,
          toolCallCount: 0
        },
        {
          id: "1",
          message: "first",
          response: "A",
          model: "m",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          contextReferenceCount: 0,
          toolCallCount: 0
        }
      ],
      10_000
    );
    expect(block).toContain("Turn 1");
    expect(block).toContain("User: first");
    expect(block).toContain("Turn 2");
    expect(block).toContain("User: second");
    const i1 = block!.indexOf("first");
    const i2 = block!.indexOf("second");
    expect(i1).toBeLessThan(i2);
  });
});
