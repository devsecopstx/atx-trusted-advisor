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
});
