import { describe, expect, it } from "vitest";

import {
    XAI_PERSONA_CHAT_MODEL_FALLBACK_ID,
    XAI_PERSONA_CHAT_MODEL_OPTIONS,
    isKnownPersonaChatModelId
} from "@/modules/xchat/xai-persona-chat-models";

describe("xai-persona-chat-models", () => {
  it("has unique model ids", () => {
    const ids = XAI_PERSONA_CHAT_MODEL_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fallback id is a known preset", () => {
    expect(isKnownPersonaChatModelId(XAI_PERSONA_CHAT_MODEL_FALLBACK_ID)).toBe(true);
  });

  it("detects unknown ids", () => {
    expect(isKnownPersonaChatModelId("totally-unknown-model")).toBe(false);
  });
});
