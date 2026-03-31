/**
 * xChat citation + Grok/xAI leak handling (extend like a small template registry).
 *
 * **Stable author syntax:** `[@citation:slug]` / `[@citation:slug|Label]` → preprocess → `XF_CITE:` inline code
 * → {@link XchatMarkdownBody} renders {@link XchatCitationChip}.
 *
 * **Extend here:**
 * - {@link LEAKED_ASSISTANT_MARKUP_RULES} — strip pseudo-tool XML that must never show as prose.
 * - {@link GROK_RENDER_TYPE_RULES} — map `type="…"` on `<grok:render>` (plus `source=` + body) → citation slug.
 * - {@link CITATION_KIND_META} — slug → label + in-app link for chips.
 * - {@link inferCitationSlugFromGrokInner} — heuristics from free-form inner text / `source=` hints.
 * - {@link XF_INLINE_CHIP_PREFIXES} — extra inline-code sentinels that render the same chip (see markdown `code` map).
 */

export const XF_INLINE_CITE_PREFIX = "XF_CITE:";
/** Same chip UI; use when preprocess maps tool-oriented leaks to a sentinel */
export const XF_TOOL_BADGE_PREFIX = "XF_TOOL:";

export type CitationPresentation = {
  title: string;
  href?: string;
  external?: boolean;
};

/** Known slugs → default label + optional navigation target */
export const CITATION_KIND_META: Record<string, CitationPresentation> = {
  market_quote: { title: "Market quote", href: "/xoptions" },
  yahoo_finance: { title: "Yahoo Finance", href: "/xoptions" },
  file_search: { title: "Knowledge search" },
  web_search: { title: "Web search" },
  x_search: { title: "X search" },
  /** Citation slug for workspace tools (xAI tool name remains `atx_function`). */
  atxfinance: { title: "Workspace tools", href: "/portfolio" },
  code_interpreter: { title: "Code interpreter" },
  tool_call: { title: "Tool data" }
};

const SLUG_RE = /^[a-z0-9_]+$/;

/**
 * Map wire / model variants → canonical chip slug in inline `XF_CITE:` / fences.
 * Keep workspace cites as `atxfinance` so unwrapped prose is less GFM-fragile than `atx_function` (`_…` emphasis).
 */
const CITATION_SLUG_ALIASES: Record<string, string> = {
  atx_function: "atxfinance"
};

export function canonicalizeCitationSlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  return CITATION_SLUG_ALIASES[s] ?? s;
}

function humanizeSlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function resolveCitationPresentation(slug: string, label?: string): CitationPresentation {
  const c = canonicalizeCitationSlug(slug);
  const meta = CITATION_KIND_META[c];
  const title = label?.trim() || meta?.title || humanizeSlug(c);
  return {
    title,
    href: meta?.href,
    external: meta?.external
  };
}

/** `type="…"` / `name="…"` on `<grok:render …>` */
export type GrokRenderResolveContext = {
  typeAttr: string | null;
  sourceAttr: string | null;
  nameAttr: string | null;
  inner: string;
};

export type GrokRenderTypeRule = {
  id: string;
  /** Exact match on normalized `type` (case-insensitive) */
  typeEquals?: string;
  /** Test normalized `type` string */
  typeRegex?: RegExp;
  /** Resolved slug; function runs after type match */
  slug: string | ((ctx: GrokRenderResolveContext) => string);
};

/**
 * First matching rule wins (order = specificity). Add narrow `typeEquals` before broad `typeRegex`.
 */
export const GROK_RENDER_TYPE_RULES: GrokRenderTypeRule[] = [
  {
    id: "render_inline_citation",
    typeEquals: "render_inline_citation",
    slug: (ctx) => pickSlugFromGrokContext(ctx)
  },
  {
    id: "render_citation",
    typeRegex: /^render_.*citation/i,
    slug: (ctx) => pickSlugFromGrokContext(ctx)
  },
  {
    id: "inline_source",
    typeRegex: /^(source|inline_source|render_source)$/i,
    slug: (ctx) => pickSlugFromGrokContext(ctx)
  },
  {
    id: "tool_badge",
    typeRegex: /tool|badge|function/i,
    slug: () => "tool_call"
  }
];

export type LeakedMarkupRule = {
  id: string;
  pattern: RegExp;
  /** Empty string removes match */
  replaceWith: string | ((substring: string, ...args: string[]) => string);
};

/**
 * Strip leaked pseudo-execution markup (extend when models emit new XML-ish noise).
 * Runs **before** `<grok:render>` → citation conversion.
 */
export const LEAKED_ASSISTANT_MARKUP_RULES: LeakedMarkupRule[] = [
  {
    id: "function_calls_block",
    pattern: /<function_calls\b[^>]*>[\s\S]*?<\/function_calls>/gi,
    replaceWith: ""
  },
  {
    id: "function_call_singular",
    pattern: /<function_call\b[^>]*>[\s\S]*?<\/function_call>/gi,
    replaceWith: ""
  },
  {
    id: "tool_calls_block",
    pattern: /<tool_calls\b[^>]*>[\s\S]*?<\/tool_calls>/gi,
    replaceWith: ""
  },
  {
    id: "tool_call_singular",
    pattern: /<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi,
    replaceWith: ""
  },
  {
    id: "xai_tool",
    pattern: /<xai-tool\b[^>]*>[\s\S]*?<\/xai-tool>/gi,
    replaceWith: ""
  },
  {
    id: "invoke_block",
    pattern: /<invoke\b[^>]*>[\s\S]*?<\/invoke>/gi,
    replaceWith: ""
  },
  {
    id: "xai_function_stub",
    pattern: /<xai:function_call\b[^>]*>[\s\S]*?<\/xai:function_call>/gi,
    replaceWith: ""
  }
];

export function applyLeakedMarkupRules(markdown: string): string {
  let s = markdown;
  for (const rule of LEAKED_ASSISTANT_MARKUP_RULES) {
    if (typeof rule.replaceWith === "function") {
      s = s.replace(rule.pattern, rule.replaceWith);
    } else {
      s = s.replace(rule.pattern, rule.replaceWith);
    }
  }
  return s;
}

export function extractXmlAttr(attrString: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([^"']*)\\1`, "i");
  const m = re.exec(attrString);
  const v = m?.[2]?.trim();
  return v && v.length > 0 ? v : null;
}

function normalizeType(typeAttr: string | null): string {
  return typeAttr?.trim().toLowerCase() ?? "";
}

function pickSlugFromGrokContext(ctx: GrokRenderResolveContext): string {
  const hints = [ctx.sourceAttr, ctx.nameAttr, ctx.inner].filter(Boolean).join(" ");
  const fromHints = inferCitationSlugFromGrokInner(hints);
  if (fromHints !== "tool_call") {
    return fromHints;
  }
  return inferCitationSlugFromGrokInner(ctx.inner);
}

export function resolveGrokRenderSlug(ctx: GrokRenderResolveContext): string {
  const t = normalizeType(ctx.typeAttr);
  for (const rule of GROK_RENDER_TYPE_RULES) {
    if (rule.typeEquals && t === rule.typeEquals.toLowerCase()) {
      return typeof rule.slug === "function" ? rule.slug(ctx) : rule.slug;
    }
    if (rule.typeRegex && t.length > 0 && rule.typeRegex.test(t)) {
      return typeof rule.slug === "function" ? rule.slug(ctx) : rule.slug;
    }
  }
  if (!t) {
    return pickSlugFromGrokContext(ctx);
  }
  const fallback = pickSlugFromGrokContext(ctx);
  if (fallback !== "tool_call") {
    return fallback;
  }
  return "tool_call";
}

const GROK_RENDER_BLOCK_RE = /<grok:render\b([^>]*)>([\s\S]*?)<\/grok:render>/gi;

export function grokRenderBlocksToCitationMarkdown(markdown: string): string {
  return markdown.replace(GROK_RENDER_BLOCK_RE, (_full, attrs: string, inner: string) => {
    const typeAttr = extractXmlAttr(attrs, "type");
    const sourceAttr = extractXmlAttr(attrs, "source");
    const nameAttr = extractXmlAttr(attrs, "name");
    const slug = resolveGrokRenderSlug({
      typeAttr,
      sourceAttr,
      nameAttr,
      inner: String(inner)
    });
    return encodeCitationInlineMarkdown(slug) || "";
  });
}

const GROK_RENDER_SELF_CLOSE_RE = /<grok:render\b([^/]*)\/>/gi;

export function grokRenderSelfClosingToCitationMarkdown(markdown: string): string {
  return markdown.replace(GROK_RENDER_SELF_CLOSE_RE, (_full, attrs: string) => {
    const typeAttr = extractXmlAttr(attrs, "type");
    const sourceAttr = extractXmlAttr(attrs, "source");
    const nameAttr = extractXmlAttr(attrs, "name");
    const slug = resolveGrokRenderSlug({
      typeAttr,
      sourceAttr,
      nameAttr,
      inner: ""
    });
    return encodeCitationInlineMarkdown(slug) || "";
  });
}

function parseSlugLabelAfterPrefix(trimmed: string, prefix: string): { slug: string; label?: string } | null {
  if (!trimmed.startsWith(prefix)) {
    return null;
  }
  const rest = trimmed.slice(prefix.length);
  const pipe = rest.indexOf("|");
  if (pipe === -1) {
    const raw = rest.trim().toLowerCase();
    if (!SLUG_RE.test(raw)) {
      return null;
    }
    return { slug: canonicalizeCitationSlug(raw) };
  }
  const raw = rest.slice(0, pipe).trim().toLowerCase();
  const label = rest.slice(pipe + 1).trim();
  if (!SLUG_RE.test(raw)) {
    return null;
  }
  return { slug: canonicalizeCitationSlug(raw), label: label || undefined };
}

export function parseInlineCitationCode(text: string): { slug: string; label?: string } | null {
  return parseSlugLabelAfterPrefix(text.trim(), XF_INLINE_CITE_PREFIX);
}

export function parseInlineToolBadgeCode(text: string): { slug: string; label?: string } | null {
  return parseSlugLabelAfterPrefix(text.trim(), XF_TOOL_BADGE_PREFIX);
}

/** Single hook for {@link XchatMarkdownBody} `components.code` (inline). */
export function parseInlineXfChipCode(text: string): { slug: string; label?: string } | null {
  return parseInlineCitationCode(text) ?? parseInlineToolBadgeCode(text);
}

export const XF_INLINE_CHIP_PREFIXES = [XF_INLINE_CITE_PREFIX, XF_TOOL_BADGE_PREFIX] as const;

/** Markdown snippet: inline code token that {@link XchatMarkdownBody} renders as a chip */
export function encodeCitationInlineMarkdown(slug: string, label?: string): string {
  const s = canonicalizeCitationSlug(slug);
  if (!SLUG_RE.test(s)) {
    return "";
  }
  const safeLabel = label?.replace(/`/g, "").trim();
  if (safeLabel) {
    return `\`${XF_INLINE_CITE_PREFIX}${s}|${safeLabel}\``;
  }
  return `\`${XF_INLINE_CITE_PREFIX}${s}\``;
}

export function encodeToolBadgeInlineMarkdown(slug: string, label?: string): string {
  const s = canonicalizeCitationSlug(slug);
  if (!SLUG_RE.test(s)) {
    return "";
  }
  const safeLabel = label?.replace(/`/g, "").trim();
  if (safeLabel) {
    return `\`${XF_TOOL_BADGE_PREFIX}${s}|${safeLabel}\``;
  }
  return `\`${XF_TOOL_BADGE_PREFIX}${s}\``;
}

/** `[@citation:market_quote]` or `[@citation:market_quote|Yahoo]` */
const BRACKET_CITATION_RE = /\[@citation:([a-z0-9_]+)(?:\|([^\]]+))?\]/gi;

/** `[@tool:market_quote]` — same chip pipeline as citation */
const BRACKET_TOOL_RE = /\[@tool:([a-z0-9_]+)(?:\|([^\]]+))?\]/gi;

export function expandBracketCitationsToInlineCode(markdown: string): string {
  let s = markdown.replace(BRACKET_CITATION_RE, (_, slug: string, label?: string) => {
    const enc = encodeCitationInlineMarkdown(slug, label?.trim());
    return enc || _;
  });
  s = s.replace(BRACKET_TOOL_RE, (_, slug: string, label?: string) => {
    const enc = encodeToolBadgeInlineMarkdown(slug, label?.trim());
    return enc || _;
  });
  return s;
}

export function inferCitationSlugFromGrokInner(inner: string): string {
  const t = inner.toLowerCase();
  if (t.includes("code_interpreter") || t.includes("code interpreter")) {
    return "code_interpreter";
  }
  if (t.includes("x_search") || /\bx\s*search\b/.test(t)) {
    return "x_search";
  }
  if (t.includes("market_quote") || t.includes("market quote")) {
    return "market_quote";
  }
  if (t.includes("yahoo_finance") || /\byahoo\b/.test(t)) {
    return "yahoo_finance";
  }
  if (t.includes("file_search")) {
    return "file_search";
  }
  if (t.includes("web_search")) {
    return "web_search";
  }
  if (
    t.includes("atx_function") ||
    t.includes("atx function") ||
    t.includes("atxfinance") ||
    t.includes("positions_snapshot") ||
    t.includes("portfolio_summary") ||
    t.includes("watchlist_snapshot") ||
    t.includes("account_health") ||
    t.includes("workspace snapshot")
  ) {
    return "atxfinance";
  }
  return "tool_call";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Blockquote / indent models sometimes emit before bare sentinels */
const MD_BARE_CITE_LINE_LEAD = "(?:> ?)?[ \\t]*";

function stripInvisibleWhitespace(markdown: string): string {
  return markdown.replace(/\uFEFF/g, "").replace(/[\u200B-\u200D]/g, "");
}

/** Line is only a bare XF_CITE/XF_TOOL sentinel (optional blockquote indent, footnote markers, trailing period). */
function bareXfLineDedupeKey(line: string): string | null {
  const t = line.trimEnd();
  const cite = t.match(
    /^(?:> ?)?[ \t]*(?:XF_CITE|xf_cite):\s*([a-z0-9_]+)(?:\s*\[\d+\])*(?:\s*\.?)?\s*$/i
  );
  if (cite) {
    return `c:${cite[1].toLowerCase()}`;
  }
  const tool = t.match(
    /^(?:> ?)?[ \t]*(?:XF_TOOL|xf_tool):\s*([a-z0-9_]+)(?:\s*\[\d+\])*(?:\s*\.?)?\s*$/i
  );
  if (tool) {
    return `t:${tool[1].toLowerCase()}`;
  }
  return null;
}

/**
 * Grok often emits the same bare `XF_CITE:yahoo_finance` on consecutive lines — chips would duplicate.
 * Run **before** {@link wrapBareXfCiteLines}.
 */
export function collapseAdjacentDuplicateBareXfLines(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let prevKey: string | null = null;
  for (const line of lines) {
    const key = bareXfLineDedupeKey(line);
    if (key !== null) {
      if (key === prevKey) {
        continue;
      }
      prevKey = key;
    } else {
      prevKey = null;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** `XF_CITE:yahoo_finance XF_CITE:yahoo_finance` on one line → single sentinel. */
export function dedupeInlineRepeatedBareXfSentinels(markdown: string): string {
  let s = markdown;
  s = s.replace(
    /(XF_CITE:\s*([a-z0-9_]+)(?:\s*\[\d+\])*)(?:\s+XF_CITE:\s*\2(?:\s*\[\d+\])*)+/gi,
    "$1"
  );
  s = s.replace(
    /(XF_TOOL:\s*([a-z0-9_]+)(?:\s*\[\d+\])*)(?:\s+XF_TOOL:\s*\2(?:\s*\[\d+\])*)+/gi,
    "$1"
  );
  return s;
}

/** After wrapping, collapse consecutive lines that are only the same `` `XF_CITE:slug` `` chip. */
export function collapseAdjacentDuplicateWrappedXfChipLines(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let prevKey: string | null = null;
  for (const line of lines) {
    const tr = line.trim();
    if (tr === "") {
      out.push(line);
      prevKey = null;
      continue;
    }
    const c = tr.match(/^`XF_CITE:([a-z0-9_]+)`$/);
    const t = tr.match(/^`XF_TOOL:([a-z0-9_]+)`$/);
    const key = c ? `c:${c[1]}` : t ? `t:${t[1]}` : null;
    if (key !== null) {
      if (key === prevKey) {
        continue;
      }
      prevKey = key;
    } else {
      prevKey = null;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Models print `XF_CITE:slug` / `XF_TOOL:slug` without backticks (own line, or same line as trailing prose).
 * Wrap so markdown emits inline `code` → {@link XchatCitationChip}. Drops a dangling ", " when the tail is empty.
 *
 * Tolerates: optional space after `:`, leading spaces / `> ` blockquote, odd `xf_cite:` casing.
 */
export function wrapBareXfCiteLines(markdown: string): string {
  let s = stripInvisibleWhitespace(markdown);
  s = s.replace(
    new RegExp(`^(${MD_BARE_CITE_LINE_LEAD})xf_cite:`, "gim"),
    `$1${XF_INLINE_CITE_PREFIX}`
  );
  s = s.replace(
    new RegExp(`^(${MD_BARE_CITE_LINE_LEAD})xf_tool:`, "gim"),
    `$1${XF_TOOL_BADGE_PREFIX}`
  );

  const lead = `^(${MD_BARE_CITE_LINE_LEAD})`;
  for (const prefix of [XF_INLINE_CITE_PREFIX, XF_TOOL_BADGE_PREFIX] as const) {
    const p = escapeRegExp(prefix);
    const comma = new RegExp(`${lead}${p}\\s*([a-z0-9_]+)\\s*,\\s*(.*)$`, "gim");
    s = s.replace(comma, (_full: string, indent: string, rawSlug: string, rest: string) => {
      const slug = canonicalizeCitationSlug(rawSlug);
      const chip = `\`${prefix}${slug}\``;
      const tail = rest.trim();
      return tail ? `${indent}${chip}, ${tail}` : `${indent}${chip}`;
    });
    /** Before `spaced`, so lines like `XF_CITE:yahoo_finance [1] [2]` are not treated as slug + prose. */
    const lone = new RegExp(
      `${lead}${p}\\s*([a-z0-9_]+)(?:\\s*\\[\\d+\\])*(?:\\s*\\.?)?\\s*$`,
      "gim"
    );
    s = s.replace(lone, (_full: string, indent: string, rawSlug: string) => {
      const slug = canonicalizeCitationSlug(rawSlug);
      return `${indent}\`${prefix}${slug}\``;
    });
    const spaced = new RegExp(`${lead}${p}\\s*([a-z0-9_]+)[ \\t]+(.+)$`, "gim");
    s = s.replace(spaced, (_full: string, indent: string, rawSlug: string, prose: string) => {
      const slug = canonicalizeCitationSlug(rawSlug);
      return `${indent}\`${prefix}${slug}\` ${prose.trimStart()}`;
    });
  }

  const citeTail =
    /(^|[\n ])(XF_CITE:\s*([a-z0-9_]+))(?:\s*\[\d+\])*(?:\s*\.?)?\s*$/gim;
  s = s.replace(citeTail, (_full: string, before: string, _sent: string, rawSlug: string) => {
    const slug = canonicalizeCitationSlug(rawSlug);
    return `${before}\`${XF_INLINE_CITE_PREFIX}${slug}\``;
  });
  const toolTail =
    /(^|[\n ])(XF_TOOL:\s*([a-z0-9_]+))(?:\s*\[\d+\])*(?:\s*\.?)?\s*$/gim;
  s = s.replace(toolTail, (_full: string, before: string, _sent: string, rawSlug: string) => {
    const slug = canonicalizeCitationSlug(rawSlug);
    return `${before}\`${XF_TOOL_BADGE_PREFIX}${slug}\``;
  });

  return s;
}

/** Optional fenced block: ```xf-citation { "slug": "market_quote", "label": "…" } ``` */
export type XfCitationFencePayload = {
  slug?: string;
  label?: string;
};

export function parseXfCitationFenceJson(text: string): { slug: string; label?: string } | null {
  const t = text.trim();
  if (!t.startsWith("{")) {
    return null;
  }
  try {
    const j = JSON.parse(t) as XfCitationFencePayload;
    const raw = typeof j.slug === "string" ? j.slug.trim().toLowerCase() : "";
    const slug = canonicalizeCitationSlug(raw);
    if (!slug || !SLUG_RE.test(slug)) {
      return null;
    }
    const label = typeof j.label === "string" ? j.label.replace(/`/g, "").trim() : undefined;
    return { slug, label: label || undefined };
  } catch {
    return null;
  }
}
