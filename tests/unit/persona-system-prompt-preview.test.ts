import { describe, expect, it } from "vitest";

import {
    PERSONA_SYSTEM_PROMPT_PREVIEW_MAX,
    personaSystemPromptPreview
} from "@/lib/persona-system-prompt-preview";

describe("personaSystemPromptPreview", () => {
  it("returns empty for null/undefined", () => {
    expect(personaSystemPromptPreview(null)).toBe("");
    expect(personaSystemPromptPreview(undefined)).toBe("");
  });

  it("returns full string when at or under max length (after leading trim)", () => {
    const s = "a".repeat(PERSONA_SYSTEM_PROMPT_PREVIEW_MAX);
    expect(personaSystemPromptPreview(s)).toBe(s);
    expect(personaSystemPromptPreview("  short")).toBe("short");
  });

  it("truncates to max chars with ellipsis", () => {
    const long = "b".repeat(PERSONA_SYSTEM_PROMPT_PREVIEW_MAX + 5);
    expect(personaSystemPromptPreview(long).length).toBe(PERSONA_SYSTEM_PROMPT_PREVIEW_MAX + 1);
    expect(personaSystemPromptPreview(long).endsWith("…")).toBe(true);
  });
});
