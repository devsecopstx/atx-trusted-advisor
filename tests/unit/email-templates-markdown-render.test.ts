import { describe, expect, it } from "vitest";

import {
    renderMarkdownEmail,
    renderMarkdownToHtml,
    renderMarkdownToPlainText
} from "@/modules/email-templates/markdown-render";

describe("renderMarkdownToHtml", () => {
  it("renders headings, paragraphs, bold and italic", () => {
    const md = "# Hello\n\nThis is **bold** and *italic*.";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders unordered and ordered lists", () => {
    const md = "- one\n- two\n\n1. a\n2. b";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>a</li><li>b</li></ol>");
  });

  it("renders block quotes and horizontal rule", () => {
    const md = "> quoted\n\n---\n\nafter";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain("<blockquote><p>quoted</p></blockquote>");
    expect(html).toContain("<hr />");
  });

  it("renders safe https links and drops javascript: URLs", () => {
    expect(renderMarkdownToHtml("[home](https://example.com)")).toContain(
      '<a href="https://example.com" rel="noopener noreferrer">home</a>'
    );
    expect(renderMarkdownToHtml("[bad](javascript:alert(1))")).toContain("bad");
    expect(renderMarkdownToHtml("[bad](javascript:alert(1))")).not.toContain("javascript");
  });

  it("preserves entities from upstream Mustache substitution and avoids double-escaping", () => {
    expect(renderMarkdownToHtml("Acme &amp; Co")).toContain("Acme &amp; Co");
    expect(renderMarkdownToHtml("Acme &amp; Co")).not.toContain("&amp;amp;");
  });

  it("escapes raw < and > but keeps existing entities", () => {
    expect(renderMarkdownToHtml("a < b > c")).toContain("a &lt; b &gt; c");
  });
});

describe("renderMarkdownToPlainText", () => {
  it("flattens headings and inline markers", () => {
    const md = "# Title\n\n**bold** *italic* `code` [link](https://example.com)";
    const text = renderMarkdownToPlainText(md);
    expect(text).toContain("Title");
    expect(text).toContain("bold italic code link");
    expect(text).not.toContain("**");
    expect(text).not.toContain("https://example.com");
  });
});

describe("renderMarkdownEmail", () => {
  it("wraps html with branded shell + escaped subject", () => {
    const html = renderMarkdownEmail({ subject: "weekly <digest>", markdown: "# h" });
    expect(html).toContain("<title>weekly &lt;digest&gt;</title>");
    expect(html).toContain("aTx⚡Finance · desk digest");
    expect(html).toContain("<h1>h</h1>");
  });
});
