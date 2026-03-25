import { describe, expect, it } from "vitest";

import {
    loadPersonaDocFromUnknownText,
    markdownFrontmatterToPersonaDoc
} from "@/modules/xchat/persona-spec-text";

describe("markdownFrontmatterToPersonaDoc", () => {
  it("builds system_prompt from description + body when system_prompt omitted", () => {
    const md = `---
id: xfinance-strategy-wheel
name: xfinance-strategy-wheel
description: Wheel strategy workflow with premium reinvested.
---

# xFinance Strategy: Wheel

## Strategy

CSP to CC cycle.
`;
    const r = markdownFrontmatterToPersonaDoc(md, "wheel/wheel.md");
    expect("error" in r).toBe(false);
    if ("error" in r) {
      return;
    }
    expect(r.doc.name).toBe("xfinance-strategy-wheel");
    expect(String(r.doc.system_prompt)).toContain("Wheel strategy workflow");
    expect(String(r.doc.system_prompt)).toContain("CSP to CC cycle");
    expect(String(r.doc.system_prompt).length).toBeGreaterThanOrEqual(10);
  });

  it("rejects markdown without frontmatter", () => {
    const r = markdownFrontmatterToPersonaDoc("# Hi\n", "x.md");
    expect("error" in r).toBe(true);
  });

  it("loadPersonaDocFromUnknownText accepts bare YAML (xAI document names often lack extensions)", () => {
    const y =
      "name: test-persona\nsystem_prompt: \"1234567890abcdefghij\"\nmodel: grok-4-1-fast-reasoning\n";
    const r = loadPersonaDocFromUnknownText("xai:ingested_blob", y);
    expect("error" in r).toBe(false);
    if ("error" in r) {
      return;
    }
    expect(r.doc.name).toBe("test-persona");
  });
});
