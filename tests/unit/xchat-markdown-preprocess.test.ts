import { describe, expect, it } from "vitest";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";

describe("preprocessXchatMarkdown", () => {
  it("collapses accidental quad-bold to double", () => {
    expect(preprocessXchatMarkdown("****x****")).toBe("**x**");
  });

  it("collapses excessive blank lines", () => {
    expect(preprocessXchatMarkdown("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("promotes Key: value lines to h3 + body when safe", () => {
    expect(preprocessXchatMarkdown("Summary: hello world")).toBe("### Summary\nhello world");
  });

  it("does not touch table rows", () => {
    const t = "| A | B |\n| 1 | 2 |";
    expect(preprocessXchatMarkdown(t)).toBe(t);
  });
});
