import { describe, expect, it } from "vitest";

import {
    capUserTaskStoredOutput,
    cleanUserTaskLlmOutput,
    USER_TASK_STORED_OUTPUT_MAX_CHARS
} from "@/lib/clean-user-task-llm-output";

describe("cleanUserTaskLlmOutput", () => {
  it("removes inline XF_CITE with optional backticks", () => {
    const raw = "Hello `XF_CITE:atx_function` world XF_CITE:yahoo_finance tail.";
    expect(cleanUserTaskLlmOutput(raw)).toBe("Hello  world  tail.");
  });

  it("removes chip-only lines", () => {
    const raw = "Intro\n\nXF_CITE:atx_function\n\nMore text";
    expect(cleanUserTaskLlmOutput(raw)).toBe("Intro\n\nMore text");
  });

  it("collapses excessive blank lines", () => {
    const raw = "a\n\n\n\nb";
    expect(cleanUserTaskLlmOutput(raw)).toBe("a\n\nb");
  });
});

describe("capUserTaskStoredOutput", () => {
  it("truncates beyond max with notice", () => {
    const long = "x".repeat(USER_TASK_STORED_OUTPUT_MAX_CHARS + 50);
    const out = capUserTaskStoredOutput(long);
    expect(out.length).toBeLessThanOrEqual(USER_TASK_STORED_OUTPUT_MAX_CHARS + 80);
    expect(out).toContain("truncated for storage");
  });
});
