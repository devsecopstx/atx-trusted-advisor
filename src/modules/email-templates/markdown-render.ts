/**
 * Minimal CommonMark-compatible subset for admin-authored email bodies. Designed for safe
 * server-side rendering with no extra dependencies. Supports:
 *
 * - ATX headings: `#`, `##`, `###`
 * - Paragraphs (blank-line separated)
 * - Unordered lists (`-` or `*`) and ordered lists (`1.` … `9.`)
 * - Block quotes (`> …`)
 * - Horizontal rule (`---`)
 * - Inline: `**bold**`, `*italic*` / `_italic_`, `` `code` ``, `[label](url)`
 *
 * The input is assumed to have already been Mustache-substituted with **HTML-escaped** variable
 * values, so we accept pre-escaped entities (`&amp;`) and avoid double-escaping. Markdown control
 * characters that survive in the source (e.g. `<` from a URL) are still escaped here.
 *
 * Not supported: code fences, tables, images, raw HTML, footnotes, emphasis nesting beyond bold/italic.
 * Authors needing those should use the existing branded preview path instead.
 */

const HTML_SAFE = /[&<>"']/g;
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(input: string): string {
  return input.replace(HTML_SAFE, (c) => HTML_ENTITIES[c] ?? c);
}

/**
 * Mustache step already HTML-escapes variable values, producing strings like `Acme &amp; Co`.
 * Re-escaping would yield `Acme &amp;amp; Co`. We therefore detect existing entities via
 * `&[a-zA-Z]+;` or `&#\d+;` and skip re-escaping the leading `&` only.
 */
function escapeHtmlPreservingEntities(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "&") {
      const entityMatch = input.slice(i).match(/^&(?:[a-zA-Z]+|#\d+);/);
      if (entityMatch) {
        out += entityMatch[0];
        i += entityMatch[0].length;
        continue;
      }
      out += "&amp;";
      i += 1;
      continue;
    }
    out += HTML_ENTITIES[ch] ?? ch;
    i += 1;
  }
  return out;
}

const INLINE_CODE = /`([^`\n]+)`/g;
const STRONG = /\*\*([^*\n]+)\*\*/g;
const EM_STAR = /(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g;
const EM_UNDER = /(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function renderInline(input: string): string {
  let out = escapeHtmlPreservingEntities(input);
  out = out.replace(INLINE_CODE, (_, code: string) => `<code>${code}</code>`);
  out = out.replace(STRONG, (_, inner: string) => `<strong>${inner}</strong>`);
  out = out.replace(EM_STAR, (_, lead: string, inner: string) => `${lead}<em>${inner}</em>`);
  out = out.replace(EM_UNDER, (_, lead: string, inner: string) => `${lead}<em>${inner}</em>`);
  out = out.replace(LINK, (_, label: string, href: string) => {
    const safe = sanitizeUrl(href);
    if (!safe) {
      return label;
    }
    return `<a href="${safe}" rel="noopener noreferrer">${label}</a>`;
  });
  return out;
}

const URL_SCHEMES = ["https://", "http://", "mailto:"] as const;

function sanitizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  for (const scheme of URL_SCHEMES) {
    if (trimmed.toLowerCase().startsWith(scheme)) {
      return escapeHtmlPreservingEntities(trimmed);
    }
  }
  return null;
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "blockquote"; lines: string[] }
  | { kind: "hr" };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, text: headingMatch[2]! });
      i += 1;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) {
        inner.push(lines[i]!.replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "blockquote", lines: inner });
      continue;
    }
    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|\s*>|---+\s*$)/.test(lines[i]!)) {
      paragraphLines.push(lines[i]!);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraphLines.join(" ") });
  }
  return blocks;
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
    case "paragraph":
      return `<p>${renderInline(block.text)}</p>`;
    case "ul":
      return `<ul>${block.items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol>${block.items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ol>`;
    case "blockquote":
      return `<blockquote>${block.lines
        .map((ln) => `<p>${renderInline(ln)}</p>`)
        .join("")}</blockquote>`;
    case "hr":
      return "<hr />";
  }
}

/**
 * Render a Markdown source (already Mustache-substituted) to HTML. Output is wrapped in a
 * branded shell consistent with `desk-notification-email-preview.ts` so live sends and
 * preview look the same.
 */
export function renderMarkdownToHtml(markdown: string): string {
  const blocks = parseBlocks(markdown.trim());
  return blocks.map(renderBlock).join("\n");
}

export function renderMarkdownEmail(input: { subject: string; markdown: string }): string {
  const subjectSafe = escapeHtml(input.subject);
  const body = renderMarkdownToHtml(input.markdown);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${subjectSafe}</title>
<style>
body{margin:0;background:#050505;color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;}
.wrap{max-width:640px;margin:0 auto;border-radius:16px;border:1px solid rgba(57,255,20,0.22);background:linear-gradient(165deg,rgba(24,24,27,0.95),rgba(9,9,11,0.98));padding:22px 22px 18px;box-shadow:0 0 42px -18px rgba(57,255,20,0.35);}
.brand{font-weight:800;letter-spacing:0.06em;font-size:11px;color:#39ff14;text-transform:uppercase;margin:0 0 14px;}
h1,h2,h3{color:#f8fafc;line-height:1.25;margin:18px 0 8px;}
p{font-size:14px;color:#cbd5e1;line-height:1.5;margin:8px 0;}
ul,ol{font-size:14px;color:#cbd5e1;line-height:1.5;padding-left:20px;margin:8px 0;}
li{margin:2px 0;}
a{color:#39ff14;}
code{background:rgba(148,163,184,0.16);padding:1px 5px;border-radius:4px;font-family:ui-monospace,Menlo,monospace;font-size:12px;}
blockquote{border-left:3px solid rgba(57,255,20,0.35);padding-left:12px;color:#94a3b8;margin:8px 0;}
hr{border:none;border-top:1px solid rgba(148,163,184,0.18);margin:18px 0;}
.foot{margin-top:18px;font-size:11px;color:#64748b;line-height:1.4;}
</style></head><body><div class="wrap"><p class="brand">aTx⚡Finance · desk digest</p>
${body}
<p class="foot">Automated portfolio digest. Not financial advice.</p>
</div></body></html>`;
}

/**
 * Plain-text fallback derived from the same Markdown source — strips inline markers but keeps
 * structure so SMTP `multipart/alternative` recipients see something readable.
 */
export function renderMarkdownToPlainText(markdown: string): string {
  const blocks = parseBlocks(markdown.trim());
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
        lines.push(stripInline(block.text));
        lines.push("");
        break;
      case "paragraph":
        lines.push(stripInline(block.text));
        lines.push("");
        break;
      case "ul":
        for (const it of block.items) {
          lines.push(`- ${stripInline(it)}`);
        }
        lines.push("");
        break;
      case "ol":
        block.items.forEach((it, idx) => {
          lines.push(`${idx + 1}. ${stripInline(it)}`);
        });
        lines.push("");
        break;
      case "blockquote":
        for (const ln of block.lines) {
          lines.push(`> ${stripInline(ln)}`);
        }
        lines.push("");
        break;
      case "hr":
        lines.push("---");
        lines.push("");
        break;
    }
  }
  return lines.join("\n").trim();
}

function stripInline(input: string): string {
  return input
    .replace(INLINE_CODE, (_, code: string) => code)
    .replace(STRONG, (_, inner: string) => inner)
    .replace(EM_STAR, (_, lead: string, inner: string) => `${lead}${inner}`)
    .replace(EM_UNDER, (_, lead: string, inner: string) => `${lead}${inner}`)
    .replace(LINK, (_, label: string) => label)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
