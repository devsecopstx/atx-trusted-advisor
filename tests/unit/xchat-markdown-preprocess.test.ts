import { describe, expect, it } from "vitest";

import { preprocessXchatMarkdown } from "@/app/xchat/ui/xchat-markdown-preprocess";

describe("preprocessXchatMarkdown", () => {
  it("includes citation repair so doubled-backtick adjacent XF_CITE chips do not leak raw sentinels", () => {
    const raw = "Quick math `XF_CITE:yahoo_finance``XF_CITE:atxfinance` after";
    const out = preprocessXchatMarkdown(raw);
    expect(out).not.toMatch(/yahoo_finance``XF_CITE/);
    expect(out).toContain("`XF_CITE:yahoo_finance`");
    expect(out).toContain("`XF_CITE:atxfinance`");
  });

  it("rejoins cite between parenthesis lines so closing ) is not orphaned by paragraph breaks", () => {
    const raw = `Diversify (e.g., add ASTS from watchlist
XF_CITE:atxfinance
) or hedge?`;
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain(") or hedge?");
    expect(out).toContain("`XF_CITE:atxfinance` ) or");
    expect(out.split("\n").some((line) => line.includes(") or hedge?") && line.includes("XF_CITE:atxfinance"))).toBe(
      true
    );
  });

  it("wraps mid-line bare XF_CITE / XF_TOOL so chips render instead of raw sentinels", () => {
    const raw = "Current symbols XF_CITE:atxfinance and XF_TOOL:yahoo_finance for context.";
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain("`XF_CITE:atxfinance`");
    expect(out).toContain("`XF_TOOL:yahoo_finance`");
    expect(out).not.toMatch(/[^`]XF_CITE:atxfinance[^`]/);
  });
});
