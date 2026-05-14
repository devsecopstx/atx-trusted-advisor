import { describe, expect, it } from "vitest";

import {
    buildFullHistoryMessages,
    buildInputWithHistory,
    resolveToolLoopConversationInput,
    XCHAT_ASK_MAX_TOOL_HISTORY_TURNS
} from "@/modules/xchat/xchat-ask-history-input";

describe("resolveToolLoopConversationInput", () => {
  it("sends only the current turn when xAI remote continuation is active", () => {
    const userPrompt = "Continue the wheel on NVDA with the same strikes.";
    const input = resolveToolLoopConversationInput({
      hasVisionImages: false,
      useRemoteContinuation: true,
      enableLongTermXaiMemory: true,
      recentMessages: [
        { role: "user", content: "Start a conservative wheel on NVDA." },
        { role: "assistant", content: "Prior assistant turn." }
      ],
      userPrompt,
      captionForPrompt: "Continue the wheel on NVDA with the same strikes."
    });

    expect(input).toBe(userPrompt);
    expect(input).toBe(buildInputWithHistory([], userPrompt));
  });

  it("keeps capped local history when long-term memory is on without remote continuation", () => {
    const input = resolveToolLoopConversationInput({
      hasVisionImages: false,
      useRemoteContinuation: false,
      enableLongTermXaiMemory: true,
      recentMessages: [{ role: "user", content: "Earlier turn" }],
      userPrompt: "Follow-up with tools",
      captionForPrompt: "Follow-up"
    });

    expect(Array.isArray(input)).toBe(true);
    expect(input).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "user", content: "Follow-up with tools" })])
    );
  });

  it("omits structured conversation input on vision turns", () => {
    const input = resolveToolLoopConversationInput({
      hasVisionImages: true,
      useRemoteContinuation: false,
      enableLongTermXaiMemory: false,
      recentMessages: [],
      userPrompt: "Describe",
      captionForPrompt: "Describe"
    });
    expect(input).toBeUndefined();
  });

  it("caps long-term thread input at four turns (eight messages) before the current user row", () => {
    const recent = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn-${i}`
    }));
    const input = resolveToolLoopConversationInput({
      hasVisionImages: false,
      useRemoteContinuation: false,
      enableLongTermXaiMemory: true,
      recentMessages: recent,
      userPrompt: "latest with tools",
      captionForPrompt: "latest"
    });
    expect(Array.isArray(input)).toBe(true);
    const arr = input as { role: string; content: string }[];
    expect(arr.length).toBeLessThanOrEqual(XCHAT_ASK_MAX_TOOL_HISTORY_TURNS * 2 + 1);
    expect(arr[0]?.content).toBe("turn-12");
    expect(arr[arr.length - 1]?.content).toBe("latest with tools");
  });
});

describe("buildFullHistoryMessages", () => {
  it("uses XCHAT_ASK_MAX_TOOL_HISTORY_TURNS as default max", () => {
    const recent = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`
    }));
    const out = buildFullHistoryMessages(recent, "current");
    expect(out.length).toBe(XCHAT_ASK_MAX_TOOL_HISTORY_TURNS * 2 + 1);
    expect(out[0]?.content).toBe("m12");
    expect(out[out.length - 1]?.content).toBe("current");
  });
});
