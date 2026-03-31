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

  it("does not promote SPY vs QQQ comparison titles or parenthetical ticker lines", () => {
    const spyQqq = "SPY vs. QQQ: Today's Performance (as of March 30 close / post-market)";
    expect(preprocessXchatMarkdown(spyQqq)).toBe(spyQqq);
    const etfLine = "SPY (S&P 500 ETF): Closed at 631.97 (-2.12, -0.33% from prev close 634.09).";
    expect(preprocessXchatMarkdown(etfLine)).toBe(etfLine);
  });

  it("SPY vs QQQ style answer keeps prose intact and wraps bare yahoo_finance cite", () => {
    const raw = [
      "SPY vs. QQQ: Today's Performance (as of March 30 close / post-market)",
      "XF_CITE:yahoo_finance",
      "",
      "SPY (S&P 500 ETF): Closed at 631.97 (-2.12, -0.33% from prev close 634.09)."
    ].join("\n");
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain("`XF_CITE:yahoo_finance`");
    expect(out).not.toContain("### SPY vs. QQQ");
    expect(out).not.toContain("### SPY (S&P");
    expect(out).toContain("SPY vs. QQQ: Today's Performance");
    expect(out).toContain("Closed at 631.97");
  });

  it("does not touch table rows", () => {
    const t = "| A | B |\n| 1 | 2 |";
    expect(preprocessXchatMarkdown(t)).toBe(t);
  });

  it("maps grok:render citation blocks to inline citation tokens", () => {
    const raw =
      "Price moved.<grok:render type=\"render_inline_citation\"> ? atx market_quote </grok:render> Next sentence.";
    expect(preprocessXchatMarkdown(raw)).toBe("Price moved.`XF_CITE:market_quote` Next sentence.");
  });

  it("expands bracket citations and @tool to inline tokens", () => {
    expect(preprocessXchatMarkdown("See [@citation:market_quote] now.")).toBe("See `XF_CITE:market_quote` now.");
    expect(preprocessXchatMarkdown("Ref [@citation:yahoo_finance|Chain] end.")).toBe(
      "Ref `XF_CITE:yahoo_finance|Chain` end."
    );
    expect(preprocessXchatMarkdown("T [@tool:web_search] done.")).toBe("T `XF_TOOL:web_search` done.");
    expect(preprocessXchatMarkdown("[@citation:atxfinance]")).toBe("`XF_CITE:atxfinance`");
  });

  it("wraps bare XF_CITE lines (model prose) into inline citation tokens", () => {
    const inMd = "Holdings intro.\nXF_CITE:atxfinance\nNext paragraph.";
    expect(preprocessXchatMarkdown(inMd)).toBe("Holdings intro.\n`XF_CITE:atxfinance`\nNext paragraph.");
  });

  it("dedupes consecutive duplicate bare XF_CITE lines into a single chip", () => {
    const raw = "Key Risks: exposure.\nXF_CITE:yahoo_finance\nXF_CITE:yahoo_finance\n";
    const out = preprocessXchatMarkdown(raw);
    expect(out).toContain("### Key Risks\nexposure.");
    expect(out).toMatch(/`XF_CITE:yahoo_finance`/);
    expect(out.match(/`XF_CITE:yahoo_finance`/g)?.length).toBe(1);
  });

  it("wraps bare XF_CITE:slug, prose on same line into chip + readable tail", () => {
    const inMd = "Current Market Values (postmarket):\nXF_CITE:yahoo_finance, NVDA last …";
    expect(preprocessXchatMarkdown(inMd)).toBe(
      "Current Market Values (postmarket):\n`XF_CITE:yahoo_finance`, NVDA last …"
    );
  });

  it("maps self-closing grok:render to citation token when typed", () => {
    expect(preprocessXchatMarkdown("a<grok:render type=\"render_tool_badge\"/>b")).toBe("a`XF_CITE:tool_call`b");
  });

  it("strips leaked function_calls before markdown", () => {
    expect(preprocessXchatMarkdown("Hi<function_calls>[]</function_calls>there.")).toBe("Hithere.");
  });
});
