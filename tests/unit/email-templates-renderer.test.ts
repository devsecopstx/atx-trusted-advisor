import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/modules/email-templates/template-renderer";
import type { EmailTemplateRenderContext } from "@/modules/email-templates/types";

const baseContext: EmailTemplateRenderContext = {
  portfolio: { name: "Aurora <growth>", id: "abc" },
  period: { cadence: "weekly", start: "2026-05-06", end: "2026-05-13" },
  totalValue: "$1,250,000.00",
  weekChange: "+1.4%",
  dayChange: "+0.2%",
  events: [
    { title: "Alert fired", body: "TSLA crossed 250", symbol: "TSLA" },
    { title: "Order filled", body: "Sold CC", symbol: "RKLB" }
  ],
  positions: [{ symbol: "TSLA", qty: 100, marketValue: "$25,000.00" }],
  topMovers: [{ symbol: "TSLA", changePct: "+3.2%" }],
  narrative: "Markets steady; TSLA outperforming.",
  hasEvents: true,
  hasPositions: true,
  hasTopMovers: true
};

describe("renderEmailTemplate", () => {
  it("renders subject without HTML escape and body with escape", () => {
    const result = renderEmailTemplate({
      subject: "{{portfolio.name}} — {{period.cadence}}",
      body: "# {{portfolio.name}}\n\n**Total:** {{totalValue}}",
      context: baseContext
    });
    expect(result.subject).toBe("Aurora <growth> — weekly");
    expect(result.html).toContain("<h1>Aurora &lt;growth&gt;</h1>");
    expect(result.html).toContain("<strong>Total:</strong>");
    expect(result.html).toContain("$1,250,000.00");
  });

  it("renders array sections and inverted sections correctly", () => {
    const result = renderEmailTemplate({
      subject: "x",
      body: [
        "{{#hasEvents}}",
        "## Events",
        "{{#events}}",
        "- {{title}} ({{symbol}})",
        "{{/events}}",
        "{{/hasEvents}}",
        "{{^hasTopMovers}}no movers{{/hasTopMovers}}"
      ].join("\n"),
      context: { ...baseContext, hasTopMovers: false, topMovers: [] }
    });
    expect(result.html).toContain("<h2>Events</h2>");
    expect(result.html).toContain("Alert fired (TSLA)");
    expect(result.html).toContain("Order filled (RKLB)");
    expect(result.html).toContain("no movers");
  });

  it("plain text fallback strips Markdown markers", () => {
    const result = renderEmailTemplate({
      subject: "x",
      body: "**bold** _italic_ `code`",
      context: baseContext
    });
    expect(result.text).toContain("bold italic code");
    expect(result.text).not.toContain("**");
  });
});
