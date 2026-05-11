import { describe, expect, it } from "vitest";

import {
    buildFullHistoryMessages,
    buildInputWithHistory,
    XCHAT_LONG_TERM_HISTORY_MAX_CHARS,
    XCHAT_LONG_TERM_MAX_TOOL_HISTORY_TURNS
} from "@/modules/xchat/xchat-ask-history-input";

describe("xchat ask history input", () => {
  it("buildFullHistoryMessages caps turns and appends the current user turn", () => {
    const recent = Array.from({ length: 30 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn-${index}`
    }));
    const messages = buildFullHistoryMessages(recent, "current wheel on NVDA");
    expect(messages.at(-1)).toEqual({ role: "user", content: "current wheel on NVDA" });
    expect(messages.length).toBeLessThanOrEqual(XCHAT_LONG_TERM_MAX_TOOL_HISTORY_TURNS * 2 + 1);
  });

  it("buildFullHistoryMessages stays within the character budget", () => {
    const recent = Array.from({ length: 8 }, () => ({
      role: "user" as const,
      content: "x".repeat(4_000)
    }));
    const messages = buildFullHistoryMessages(recent, "next");
    const total = messages.reduce((sum, row) => sum + row.content.length, 0);
    expect(total).toBeLessThanOrEqual(XCHAT_LONG_TERM_HISTORY_MAX_CHARS);
  });

  it("buildInputWithHistory returns the current message only", () => {
    expect(
      buildInputWithHistory(
        [{ role: "user", content: "prior" }],
        "  follow-up wheel strikes  "
      )
    ).toBe("follow-up wheel strikes");
  });
});
