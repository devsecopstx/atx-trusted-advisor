import { describe, expect, it } from "vitest";

import {
    applyLeakedMarkupRules,
    encodeCitationInlineMarkdown,
    encodeToolBadgeInlineMarkdown,
    expandBracketCitationsToInlineCode,
    extractXmlAttr,
    grokRenderBlocksToCitationMarkdown,
    grokRenderSelfClosingToCitationMarkdown,
    inferCitationSlugFromGrokInner,
    parseInlineCitationCode,
    parseInlineToolBadgeCode,
    parseInlineXfChipCode,
    parseXfCitationFenceJson,
    resolveCitationPresentation,
    resolveGrokRenderSlug,
    wrapBareXfCiteLines
} from "@/lib/xchat-citations";

describe("xchat-citations", () => {
  it("parses inline XF_CITE and XF_TOOL payloads", () => {
    expect(parseInlineCitationCode("XF_CITE:market_quote")).toEqual({ slug: "market_quote" });
    expect(parseInlineToolBadgeCode("XF_TOOL:yahoo_finance|Chain")).toEqual({
      slug: "yahoo_finance",
      label: "Chain"
    });
    expect(parseInlineXfChipCode("XF_CITE:web_search")).toEqual({ slug: "web_search" });
    expect(parseInlineXfChipCode("XF_TOOL:atxfinance")).toEqual({ slug: "atx_function" });
    expect(parseInlineCitationCode("not a cite")).toBeNull();
  });

  it("encodes bracket citation and tool syntax", () => {
    expect(expandBracketCitationsToInlineCode("x [@citation:web_search] y")).toBe("x `XF_CITE:web_search` y");
    expect(expandBracketCitationsToInlineCode("[@tool:market_quote|Q]")).toBe("`XF_TOOL:market_quote|Q`");
    expect(expandBracketCitationsToInlineCode("[@citation:atxfinance]")).toBe("`XF_CITE:atx_function`");
  });

  it("wraps bare XF_CITE lines and aliases atxfinance → atx_function", () => {
    expect(wrapBareXfCiteLines("a\nXF_CITE:atxfinance\nb")).toBe("a\n`XF_CITE:atx_function`\nb");
    expect(wrapBareXfCiteLines("XF_CITE:atx_function")).toBe("`XF_CITE:atx_function`");
  });

  it("wraps bare XF_CITE with comma or trailing prose on same line", () => {
    expect(wrapBareXfCiteLines("XF_CITE:yahoo_finance, pls confirm")).toBe(
      "`XF_CITE:yahoo_finance`, pls confirm"
    );
    expect(wrapBareXfCiteLines("XF_CITE:yahoo_finance,")).toBe("`XF_CITE:yahoo_finance`");
    expect(wrapBareXfCiteLines("XF_CITE:market_quote see below")).toBe("`XF_CITE:market_quote` see below");
    expect(wrapBareXfCiteLines("XF_TOOL:yahoo_finance, source note")).toBe("`XF_TOOL:yahoo_finance`, source note");
  });

  it("maps grok blocks using type and source attributes", () => {
    expect(
      grokRenderBlocksToCitationMarkdown(
        '<grok:render type="render_inline_citation"> ? atx market_quote </grok:render>'
      )
    ).toBe("`XF_CITE:market_quote`");

    expect(
      grokRenderBlocksToCitationMarkdown(
        '<grok:render type="render_inline_citation" source="yahoo_finance"></grok:render>'
      )
    ).toBe("`XF_CITE:yahoo_finance`");

    expect(
      grokRenderBlocksToCitationMarkdown('<grok:render type="render_tool_badge">x</grok:render>')
    ).toBe("`XF_CITE:tool_call`");
  });

  it("maps self-closing grok:render with attributes", () => {
    expect(grokRenderSelfClosingToCitationMarkdown('a<grok:render type="render_inline_citation" source="market_quote"/>b')).toBe(
      "a`XF_CITE:market_quote`b"
    );
  });

  it("strips leaked pseudo-execution XML", () => {
    const raw = 'Hello<function_calls>{"x":1}</function_calls>world';
    expect(applyLeakedMarkupRules(raw)).toBe("Helloworld");
  });

  it("infers slug from grok inner text", () => {
    expect(inferCitationSlugFromGrokInner("? atx market_quote")).toBe("market_quote");
    expect(inferCitationSlugFromGrokInner("code_interpreter run")).toBe("code_interpreter");
    expect(inferCitationSlugFromGrokInner("x_search results")).toBe("x_search");
    expect(inferCitationSlugFromGrokInner("atxfinance workspace")).toBe("atx_function");
    expect(inferCitationSlugFromGrokInner("positions_snapshot")).toBe("atx_function");
  });

  it("extractXmlAttr reads quoted attributes", () => {
    expect(extractXmlAttr(' type="render_inline_citation" ', "type")).toBe("render_inline_citation");
    expect(extractXmlAttr(" source='yahoo_finance' ", "source")).toBe("yahoo_finance");
  });

  it("resolveGrokRenderSlug uses rules and fallbacks", () => {
    expect(
      resolveGrokRenderSlug({
        typeAttr: "render_unknown_thing",
        sourceAttr: null,
        nameAttr: null,
        inner: "noop"
      })
    ).toBe("tool_call");

    expect(
      resolveGrokRenderSlug({
        typeAttr: null,
        sourceAttr: "market_quote hint",
        nameAttr: null,
        inner: ""
      })
    ).toBe("market_quote");
  });

  it("resolves presentation with optional label override", () => {
    const p = resolveCitationPresentation("market_quote", "Custom");
    expect(p.title).toBe("Custom");
    expect(p.href).toBe("/xoptions");
    expect(resolveCitationPresentation("atxfinance").title).toBe("Workspace tools");
    expect(resolveCitationPresentation("atxfinance").href).toBe("/portfolio");
  });

  it("parses xf-citation fence JSON", () => {
    expect(parseXfCitationFenceJson('{"slug":"file_search","label":"KB"}')).toEqual({
      slug: "file_search",
      label: "KB"
    });
    expect(parseXfCitationFenceJson('{"slug":"atxfinance"}')?.slug).toBe("atx_function");
    expect(parseXfCitationFenceJson("{}")).toBeNull();
  });

  it("encodeCitationInlineMarkdown rejects bad slugs", () => {
    expect(encodeCitationInlineMarkdown("bad slug")).toBe("");
    expect(encodeToolBadgeInlineMarkdown("ok_slug")).toBe("`XF_TOOL:ok_slug`");
  });
});
