import { describe, expect, it } from "vitest";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";

describe("preprocessXchatMarkdown", () => {
  it("includes citation repair so doubled-backtick adjacent XF_CITE chips do not leak raw sentinels", () => {
    const raw = "Quick math `XF_CITE:yahoo_finance``XF_CITE:atxfinance` after";
    const out = preprocessXchatMarkdown(raw);
    expect(out).not.toMatch(/yahoo_finance``XF_CITE/);
    expect(out).toContain("`XF_CITE:yahoo_finance`");
    expect(out).toContain("`XF_CITE:atx_function`");
  });

  it("rejoins cite between parenthesis lines so closing ) is not orphaned by paragraph breaks", () => {
    const raw = `Diversify (e.g., add ASTS from watchlist
XF_CITE:atxfinance
) or hedge?`;
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain(") or hedge?");
    expect(out).toContain("`XF_CITE:atx_function` ) or");
    expect(out.split("\n").some((line) => line.includes(") or hedge?") && line.includes("XF_CITE:atx_function"))).toBe(
      true
    );
  });

  it("wraps mid-line bare XF_CITE / XF_TOOL so chips render instead of raw sentinels", () => {
    const raw = "Current symbols XF_CITE:atx_function and XF_TOOL:yahoo_finance for context.";
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain("`XF_CITE:atx_function`");
    expect(out).toContain("`XF_TOOL:yahoo_finance`");
    expect(out).not.toMatch(/[^`]XF_CITE:atx_function[^`]/);
  });

  it("repairs trailing extra backticks on a lone XF_CITE chip without leaking raw sentinel", () => {
    const raw = [
      "These guide our strategy discussions.",
      "`XF_CITE:atx_function``"
    ].join("\n");
    const out = preprocessXchatMarkdown(raw);
    expect(out).toBe("These guide our strategy discussions.\n`XF_CITE:atx_function`");
    expect(out).not.toMatch(/XF_CITE:atx_function``/);
  });

  it("dedupes wrapped chip plus bare duplicate atx_function cite lines", () => {
    const raw = [
      "These guide our strategy discussions.",
      "`XF_CITE:atx_function`",
      "XF_CITE:atx_function"
    ].join("\n");
    const out = preprocessXchatMarkdown(raw);
    expect(out).toBe("These guide our strategy discussions.\n`XF_CITE:atx_function`");
  });

  it("wraps bare XF_CITE lines with pipe labels and drops orphan colon before tables", () => {
    const raw = [
      "Watchlist (4 symbols, all tech/AI/EV exposure): 100% skewed to Technology. Here's the breakdown by hypothetical 100-share notional",
      "XF_CITE:atx_function|Watchlist",
      ":",
      "Symbol\tSpot Price\t100-Share Notional\tSector",
      "AMD\t$455.19\t$45,519\tSemiconductors"
    ].join("\n");
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain("`XF_CITE:atx_function|Watchlist`");
    expect(out).not.toMatch(/^\s*:\s*$/m);
    expect(out).not.toMatch(/[^`]XF_CITE:atx_function/);
  });
});
