import { describe, expect, it } from "vitest";

import { personaPreviewLineFromSystemPrompt } from "@/modules/xchat/persona-preview-line";

describe("personaPreviewLineFromSystemPrompt", () => {
  it("returns undefined for empty input", () => {
    expect(personaPreviewLineFromSystemPrompt(undefined)).toBeUndefined();
    expect(personaPreviewLineFromSystemPrompt("")).toBeUndefined();
    expect(personaPreviewLineFromSystemPrompt("  \n  \t ")).toBeUndefined();
  });

  it("uses first non-empty line and collapses whitespace", () => {
    expect(personaPreviewLineFromSystemPrompt("\n\nHello   world\nMore")).toBe("Hello world");
  });

  it("truncates long lines with ellipsis", () => {
    const long = `x`.repeat(200);
    const out = personaPreviewLineFromSystemPrompt(long);
    expect(out).toBeDefined();
    expect(out!.length).toBeLessThanOrEqual(140);
    expect(out!.endsWith("…")).toBe(true);
  });
});
