import { describe, expect, it } from "vitest";

import {
    extractTextDeltaFromStreamObject,
    summarizeToolLikeStreamEvent
} from "@/lib/xai-responses-stream";

describe("xai-responses-stream", () => {
  it("extractTextDeltaFromStreamObject handles response.output_text.delta", () => {
    expect(
      extractTextDeltaFromStreamObject({
        type: "response.output_text.delta",
        delta: "hello"
      })
    ).toBe("hello");
  });

  it("summarizeToolLikeStreamEvent detects function_call-ish types", () => {
    const s = summarizeToolLikeStreamEvent({
      type: "response.function_call_arguments.delta",
      name: "web_search"
    });
    expect(s).not.toBeNull();
    expect(s?.phase).toBe("upstream");
    expect(s?.name).toBe("web_search");
  });

  it("summarizeToolLikeStreamEvent returns null for unrelated types", () => {
    expect(
      summarizeToolLikeStreamEvent({
        type: "response.output_text.delta",
        delta: "x"
      })
    ).toBeNull();
  });
});
