import { describe, expect, it } from "vitest";

import {
    buildInputWithHistory,
    resolveToolLoopConversationInput
} from "@/modules/xchat/xchat-ask-history-input";

describe("resolveToolLoopConversationInput", () => {
  it("sends only the current turn when xAI remote continuation is active", () => {
    const userPrompt = "Continue the wheel on NVDA with the same strikes.";
    const input = resolveToolLoopConversationInput({
      visionImage: false,
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
      visionImage: false,
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
});
