import { describe, expect, it } from "vitest";

import { renderMustache } from "@/modules/email-templates/mustache-render";

describe("renderMustache", () => {
  it("substitutes simple variables", () => {
    expect(renderMustache("Hi {{name}}!", { name: "Sam" })).toBe("Hi Sam!");
  });

  it("HTML-escapes variable values by default", () => {
    expect(renderMustache("{{x}}", { x: "<script>alert(1)</script>" })).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("does not escape with rawByDefault for subject lines", () => {
    expect(renderMustache("{{x}}", { x: "<b>" }, { rawByDefault: true })).toBe("<b>");
  });

  it("supports dotted paths", () => {
    expect(renderMustache("{{portfolio.name}}", { portfolio: { name: "Aurora" } })).toBe("Aurora");
  });

  it("renders array sections and exposes item fields via dot-paths", () => {
    const out = renderMustache(
      "{{#events}}- {{title}} ({{symbol}})\n{{/events}}",
      { events: [{ title: "alert", symbol: "TSLA" }, { title: "fill", symbol: "RKLB" }] }
    );
    expect(out).toBe("- alert (TSLA)\n- fill (RKLB)\n");
  });

  it("skips section when array is empty", () => {
    const out = renderMustache("A{{#events}}item{{/events}}B", { events: [] });
    expect(out).toBe("AB");
  });

  it("inverted section renders when value is falsy", () => {
    expect(renderMustache("{{^events}}none{{/events}}", { events: [] })).toBe("none");
    expect(renderMustache("{{^events}}none{{/events}}", { events: [1] })).toBe("");
  });

  it("falls back to outer scope inside section when item lacks the path", () => {
    const out = renderMustache(
      "{{#rows}}- {{label}} from {{owner}}\n{{/rows}}",
      { owner: "desk", rows: [{ label: "TSLA" }] }
    );
    expect(out).toBe("- TSLA from desk\n");
  });

  it("ignores comments", () => {
    expect(renderMustache("a{{! comment }}b", {})).toBe("ab");
  });

  it("throws on unbalanced sections", () => {
    expect(() => renderMustache("{{#a}}oops", {})).toThrow();
  });
});
