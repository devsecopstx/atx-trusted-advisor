import { describe, expect, it } from "vitest";

import { extractXaiResponsesUsage } from "@/lib/xai-usage-extract";

describe("extractXaiResponsesUsage", () => {
  it("returns undefined when usage missing", () => {
    expect(extractXaiResponsesUsage({})).toBeUndefined();
    expect(extractXaiResponsesUsage({ usage: null })).toBeUndefined();
  });

  it("parses OpenAI-style usage", () => {
    expect(
      extractXaiResponsesUsage({
        usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 }
      })
    ).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140
    });
  });

  it("includes reasoning and cached prompt tokens when present", () => {
    expect(
      extractXaiResponsesUsage({
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          reasoning_tokens: 10,
          cached_prompt_tokens: 200,
          total_tokens: 80
        }
      })
    ).toEqual({
      inputTokens: 50,
      outputTokens: 20,
      totalTokens: 80,
      reasoningTokens: 10,
      cachedPromptTokens: 200
    });
  });
});
