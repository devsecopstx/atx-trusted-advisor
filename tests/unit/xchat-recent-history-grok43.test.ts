import { describe, expect, it } from "vitest";

import {
    buildCondensedOlderThreadMessagesBlock,
    clampGrok43MaxPriorThreadMessages,
    isGrok43FamilyModelId,
    resolveRecentThreadMessagesPromptBlock
} from "@/modules/xchat/xchat-recent-history-prompt";

describe("isGrok43FamilyModelId", () => {
  it("matches grok-4.5 and grok-4.3 variants", () => {
    expect(isGrok43FamilyModelId("grok-4.5")).toBe(true);
    expect(isGrok43FamilyModelId("grok-4.5-latest")).toBe(true);
    expect(isGrok43FamilyModelId("grok-4.3")).toBe(true);
    expect(isGrok43FamilyModelId("GROK-4.3-extra")).toBe(true);
    expect(isGrok43FamilyModelId("grok-4-1-fast")).toBe(false);
  });
});

describe("clampGrok43MaxPriorThreadMessages", () => {
  it("defaults to 8 and clamps to 4–8", () => {
    expect(clampGrok43MaxPriorThreadMessages(undefined)).toBe(8);
    expect(clampGrok43MaxPriorThreadMessages(3)).toBe(4);
    expect(clampGrok43MaxPriorThreadMessages(9)).toBe(8);
    expect(clampGrok43MaxPriorThreadMessages(4)).toBe(4);
  });
});

describe("resolveRecentThreadMessagesPromptBlock", () => {
  const msgs = Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `m${i} `.repeat(20).trim()
  }));

  it("keeps up to 8 messages for non–Grok 4.3 models", () => {
    const block = resolveRecentThreadMessagesPromptBlock({
      messages: msgs,
      executionModel: "grok-4-1-fast"
    });
    expect(block).toContain("Recent thread messages");
    expect(block?.match(/User:/g)?.length).toBe(4);
    expect(block?.match(/Assistant:/g)?.length).toBe(4);
    expect(block).not.toContain("Conversation summary (earlier thread turns");
  });

  it("uses capped recent turns + condensed digest for Grok 4.3", () => {
    const block = resolveRecentThreadMessagesPromptBlock({
      messages: msgs,
      executionModel: "grok-4.3",
      grok43MaxPriorThreadMessages: 4
    });
    expect(block).toContain("Conversation summary (earlier thread turns");
    expect(block).toContain("Recent thread messages");
    const recentOnly = block!.slice(block!.indexOf("Recent thread messages"));
    expect(recentOnly.match(/User:/g)?.length).toBe(2);
    expect(recentOnly.match(/Assistant:/g)?.length).toBe(2);
  });
});

describe("buildCondensedOlderThreadMessagesBlock", () => {
  it("returns null for empty input", () => {
    expect(buildCondensedOlderThreadMessagesBlock([])).toBeNull();
  });
});
