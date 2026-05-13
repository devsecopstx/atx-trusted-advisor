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
  /** Citation slug aligned with xAI custom tool wire name `atx_function`. Legacy `atxfinance` aliases here. */
  atx_function: { title: "Workspace tools", href: "/portfolio" },
  code_interpreter: { title: "Code interpreter" },
  tool_call: { title: "Tool data" }
};

const SLUG_RE = /^[a-z0-9_]+$/;

/**
 * Map wire / model variants → canonical chip slug in inline `XF_CITE:` / fences.
 */
const CITATION_SLUG_ALIASES: Record<string, string> = {
  atxfinance: "atx_function"
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
  const title = (label?.trim() || meta?.title || humanizeSlug(c)).trim();
  return {
    title,
    href: meta?.href,
    external: meta?.external
  };
}

/**
 * Whether an inline citation chip should render. Unknown slugs without a custom label are dropped
 * (model hallucination / stale wire id) so the UI does not show empty or meaningless chips.
 */
export function citationChipRenderable(slug: string, label?: string): boolean {
  const c = canonicalizeCitationSlug(slug.trim());
  if (!c || !SLUG_RE.test(c)) {
    return false;
  }
  const hasLabel = Boolean(label?.trim());
  const meta = CITATION_KIND_META[c];
  if (!meta && !hasLabel) {
    return false;
  }
  const { title } = resolveCitationPresentation(slug, label);
  return title.length > 0;
}

/** Remove `` `XF_CITE:…` `` / `` `XF_TOOL:…` `` spans that would not render as chips. */
export function stripNonRenderableCitationInlineSpans(markdown: string): string {
  let s = markdown.replace(/`XF_CITE:([a-z0-9_]+)(\|[^`]+)?`/gi, (full, rawSlug: string, labelPipe?: string) => {
    const label = labelPipe ? String(labelPipe).slice(1).trim() : undefined;
    const slug = canonicalizeCitationSlug(rawSlug);
    return citationChipRenderable(slug, label) ? full : "";
  });
  s = s.replace(/`XF_TOOL:([a-z0-9_]+)(\|[^`]+)?`/gi, (full, rawSlug: string, labelPipe?: string) => {
    const label = labelPipe ? String(labelPipe).slice(1).trim() : undefined;
    const slug = canonicalizeCitationSlug(rawSlug);
    return citationChipRenderable(slug, label) ? full : "";
  });
  return s;
}

function bareXfSentinelProbeFromLine(line: string): string | null {
  const t = line.trim();
  const m = t.match(/^(?:> ?)?[ \t]*((?:XF_CITE|xf_cite|XF_TOOL|xf_tool):.*)$/i);
  return m ? m[1].trim() : null;
}

function parseBareXfSentinelFromLine(line: string): { slug: string; label?: string } | null {
  const probe = bareXfSentinelProbeFromLine(line);
  if (!probe) {
    return null;
  }
  const normalized = stripCitationFootnoteMarkers(probe).replace(/\.\s*$/, "").trim();
  return parseInlineXfChipCode(normalized);
}

/**
 * Drop lines that are only a bare XF_CITE/XF_TOOL sentinel when the slug is invalid or not renderable.
 */
export function stripNonRenderableBareCitationLines(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (bareXfSentinelProbeFromLine(line) !== null) {
      const parsed = parseBareXfSentinelFromLine(line);
      if (!parsed || !citationChipRenderable(parsed.slug, parsed.label)) {
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Models sometimes emit a lone `:` between a cite sentinel and a table or list. */
export function stripOrphanColonOnlyLines(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === ":") {
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
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

/** Same footnote suffix as bare-line / wrap rules — models often put `[7]` inside or after `` `XF_CITE:slug` ``. */
function stripCitationFootnoteMarkers(token: string): string {
  return token.replace(/(?:\s*\[\d+\])+/g, "").trim();
}

function parseSlugLabelAfterPrefix(trimmed: string, prefix: string): { slug: string; label?: string } | null {
  if (!trimmed.startsWith(prefix)) {
    return null;
  }
  const rest = trimmed.slice(prefix.length);
  const pipe = rest.indexOf("|");
  if (pipe === -1) {
    const raw = stripCitationFootnoteMarkers(rest).toLowerCase();
    if (!SLUG_RE.test(raw)) {
      return null;
    }
    return { slug: canonicalizeCitationSlug(raw) };
  }
  const raw = stripCitationFootnoteMarkers(rest.slice(0, pipe)).toLowerCase();
  const label = rest.slice(pipe + 1).trim();
  if (!SLUG_RE.test(raw)) {
    return null;
  }
  return { slug: canonicalizeCitationSlug(raw), label: label || undefined };
}

/**
 * Normalizes wire/model noise before {@link parseSlugLabelAfterPrefix} (inline `code` from react-markdown).
 * Grok often emits `xf_cite:` / `xf_tool:`; ZWSP / fullwidth colon breaks strict `XF_CITE:` parsing.
 */
export function normalizeXfInlineChipProbeText(text: string): string {
  let s = text
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\uFF1A/g, ":");
  s = s.trim();
  s = s.replace(/^xf_cite:/i, XF_INLINE_CITE_PREFIX);
  s = s.replace(/^xf_tool:/i, XF_TOOL_BADGE_PREFIX);
  return s;
}

export function parseInlineCitationCode(text: string): { slug: string; label?: string } | null {
  return parseSlugLabelAfterPrefix(normalizeXfInlineChipProbeText(text), XF_INLINE_CITE_PREFIX);
}

export function parseInlineToolBadgeCode(text: string): { slug: string; label?: string } | null {
  return parseSlugLabelAfterPrefix(normalizeXfInlineChipProbeText(text), XF_TOOL_BADGE_PREFIX);
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
    t.includes("user_workspace_summary") ||
    t.includes("watchlist_snapshot") ||
    t.includes("account_health") ||
    t.includes("workspace snapshot")
  ) {
    return "atx_function";
  }
  return "tool_call";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Blockquote / indent models sometimes emit before bare sentinels */
const MD_BARE_CITE_LINE_LEAD = "(?:> ?)?[ \\t]*";

/**
 * Document-level noise removal before cite/tool wrapping (ZWSP, BOM, fullwidth colon after sentinels).
 */
export function normalizeXchatMarkdownNoise(markdown: string): string {
  let s = markdown.replace(/\uFEFF/g, "").replace(/[\u200B-\u200D\u2060]/g, "");
  s = s.replace(/(XF_CITE|XF_TOOL|xf_cite|xf_tool)\uFF1A/gi, "$1:");
  return s;
}

/** Line is only a bare XF_CITE/XF_TOOL sentinel (optional blockquote indent, footnote markers, trailing period). */
function bareXfLineDedupeKey(line: string): string | null {
  const parsed = parseBareXfSentinelFromLine(line);
  if (!parsed) {
    return null;
  }
  const probe = bareXfSentinelProbeFromLine(line);
  const kind = probe?.toLowerCase().startsWith("xf_tool") ? "t" : "c";
  return `${kind}:${parsed.slug}:${parsed.label ?? ""}`;
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

/**
 * Models sometimes jam two inline citation codes with an extra backtick (` … `` … `),
 * e.g. `` `XF_CITE:yahoo_finance``XF_CITE:atxfinance` ``, which breaks GFM and leaks raw `XF_CITE:` in prose.
 * Split into two valid inline codes separated by a space.
 */
/** `XF_CITE:slug`` / `` `XF_CITE:slug``` `` → single valid inline chip markdown. */
export function repairMangledXfInlineBacktickRuns(markdown: string): string {
  let s = markdown.replace(
    /`XF_(CITE|TOOL):([a-z0-9_]+)(\|[^`\n]*)?`{2,}/gi,
    (full, kind: string, slug: string, labelPipe?: string) => {
      const label = labelPipe ? String(labelPipe).replace(/^\|/, "").trim() || undefined : undefined;
      const slugCanon = canonicalizeCitationSlug(String(slug));
      const chip =
        String(kind).toUpperCase() === "TOOL"
          ? encodeToolBadgeInlineMarkdown(slugCanon, label)
          : encodeCitationInlineMarkdown(slugCanon, label);
      return chip || full;
    }
  );
  s = s.replace(
    /(^|[\n `])(XF_(?:CITE|TOOL):([a-z0-9_]+)(?:\|[^\s`\n]*)?)`{2,}(?=\s*$)/gim,
    (full, before: string, _sent: string, slug: string) => {
      const chip = encodeCitationInlineMarkdown(canonicalizeCitationSlug(String(slug)));
      return chip ? `${before}${chip}` : full;
    }
  );
  return s;
}

export function repairAdjacentMangledXfInlineChips(markdown: string): string {
  let s = repairMangledXfInlineBacktickRuns(markdown);
  const doubled =
    /`XF_(CITE|TOOL):([a-z0-9_]+)(\|[^`]+)?`{2,}XF_(CITE|TOOL):([a-z0-9_]+)(\|[^`]+)?`/gi;
  for (let i = 0; i < 24; i++) {
    const next = s.replace(doubled, (full, k1: string, s1: string, l1: string | undefined, k2: string, s2: string, l2: string | undefined) => {
      const slug1 = canonicalizeCitationSlug(String(s1));
      const slug2 = canonicalizeCitationSlug(String(s2));
      const label1 = l1 ? String(l1).replace(/^\|/, "").trim() || undefined : undefined;
      const label2 = l2 ? String(l2).replace(/^\|/, "").trim() || undefined : undefined;
      const a =
        String(k1).toUpperCase() === "CITE"
          ? encodeCitationInlineMarkdown(slug1, label1)
          : encodeToolBadgeInlineMarkdown(slug1, label1);
      const b =
        String(k2).toUpperCase() === "CITE"
          ? encodeCitationInlineMarkdown(slug2, label2)
          : encodeToolBadgeInlineMarkdown(slug2, label2);
      if (!a || !b) {
        return full;
      }
      return `${a} ${b}`;
    });
    if (next === s) {
      break;
    }
    s = next;
  }

  const missingSecondOpen =
    /(`XF_(CITE|TOOL):([a-z0-9_]+)(\|[^`]+)?`)XF_(CITE|TOOL):([a-z0-9_]+)(\|[^`]+)?`/gi;
  for (let i = 0; i < 24; i++) {
    const next = s.replace(
      missingSecondOpen,
      (full, firstChip: string, _k1: string, _s1: string, _l1: string | undefined, k2: string, s2: string, l2: string | undefined) => {
        const slug2 = canonicalizeCitationSlug(String(s2));
        const label2 = l2 ? String(l2).replace(/^\|/, "").trim() || undefined : undefined;
        const second =
          String(k2).toUpperCase() === "CITE"
            ? encodeCitationInlineMarkdown(slug2, label2)
            : encodeToolBadgeInlineMarkdown(slug2, label2);
        return second ? `${firstChip} ${second}` : full;
      }
    );
    if (next === s) {
      break;
    }
    s = next;
  }

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
    const c = tr.match(/^`XF_CITE:([a-z0-9_]+)(?:\|[^`]+)?`$/);
    const t = tr.match(/^`XF_TOOL:([a-z0-9_]+)(?:\|[^`]+)?`$/);
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
  let s = normalizeXchatMarkdownNoise(markdown);
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
    const lone = new RegExp(`${lead}${p}\\s*(.+?)(?:\\s*\\.?)?\\s*$`, "gim");
    s = s.replace(lone, (_full: string, indent: string, tailRaw: string) => {
      const tail = stripCitationFootnoteMarkers(String(tailRaw)).trim();
      const parsed =
        prefix === XF_INLINE_CITE_PREFIX
          ? parseInlineCitationCode(`${XF_INLINE_CITE_PREFIX}${tail}`)
          : parseInlineToolBadgeCode(`${XF_TOOL_BADGE_PREFIX}${tail}`);
      if (!parsed) {
        return _full;
      }
      const chip =
        prefix === XF_INLINE_CITE_PREFIX
          ? encodeCitationInlineMarkdown(parsed.slug, parsed.label)
          : encodeToolBadgeInlineMarkdown(parsed.slug, parsed.label);
      return chip ? `${indent}${chip}` : _full;
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

/** `(?!-)` avoids wrapping a partial slug before a hyphen (`XF_CITE:bad-slug` must not become cite `bad`). */
const MID_BARE_XF_CITE_IN_PLAIN =
  /(^|[^A-Za-z0-9_])((?:XF_CITE|xf_cite):\s*[a-z0-9_]+(?:\|[^\s`\n[\]]+)?)(?!-)(?:\s*\[\d+\])*(?![a-z0-9_])/gi;
const MID_BARE_XF_TOOL_IN_PLAIN =
  /(^|[^A-Za-z0-9_])((?:XF_TOOL|xf_tool):\s*[a-z0-9_]+(?:\|[^\s`\n[\]]+)?)(?!-)(?:\s*\[\d+\])*(?![a-z0-9_])/gi;

function findClosingInlineBacktickRun(s: string, from: number, run: number): number {
  const fence = "`".repeat(run);
  for (let i = from; i <= s.length - run; i++) {
    if (s.slice(i, i + run) !== fence) {
      continue;
    }
    if (i + run < s.length && s[i + run] === "`") {
      continue;
    }
    return i;
  }
  return -1;
}

/**
 * Plain segments only (not inside inline `…` / `` … `` / run≥3); used by {@link wrapMidLineBareXfSentinels}.
 */
function wrapBareXfSentinelsInPlainText(plain: string): string {
  let s = plain.replace(MID_BARE_XF_CITE_IN_PLAIN, (full, before: string, sentinel: string) => {
    const parsed = parseInlineCitationCode(stripCitationFootnoteMarkers(sentinel).trim());
    const enc = parsed ? encodeCitationInlineMarkdown(parsed.slug, parsed.label) : "";
    return enc ? `${before}${enc}` : full;
  });
  s = s.replace(MID_BARE_XF_TOOL_IN_PLAIN, (full, before: string, sentinel: string) => {
    const parsed = parseInlineToolBadgeCode(stripCitationFootnoteMarkers(sentinel).trim());
    const enc = parsed ? encodeToolBadgeInlineMarkdown(parsed.slug, parsed.label) : "";
    return enc ? `${before}${enc}` : full;
  });
  return s;
}

function walkInlineCodeCopyingSpans(segment: string, onPlain: (plain: string) => string): string {
  let out = "";
  let i = 0;
  while (i < segment.length) {
    if (segment[i] !== "`") {
      const next = segment.indexOf("`", i);
      const end = next === -1 ? segment.length : next;
      out += onPlain(segment.slice(i, end));
      if (next === -1) {
        break;
      }
      i = next;
      continue;
    }
    let run = 0;
    let j = i;
    while (j < segment.length && segment[j] === "`") {
      run++;
      j++;
    }
    const close = findClosingInlineBacktickRun(segment, j, run);
    if (close === -1) {
      out += segment.slice(i);
      break;
    }
    out += segment.slice(i, close + run);
    i = close + run;
  }
  return out;
}

function splitMarkdownByTripleBacktickFences(markdown: string): Array<{ kind: "prose" | "fence"; text: string }> {
  const out: Array<{ kind: "prose" | "fence"; text: string }> = [];
  let i = 0;
  while (i < markdown.length) {
    if (markdown.slice(i, i + 3) !== "```") {
      const next = markdown.indexOf("```", i);
      if (next === -1) {
        out.push({ kind: "prose", text: markdown.slice(i) });
        break;
      }
      if (next > i) {
        out.push({ kind: "prose", text: markdown.slice(i, next) });
      }
      i = next;
      continue;
    }
    const afterOpen = i + 3;
    const nl = markdown.indexOf("\n", afterOpen);
    const searchFrom = nl === -1 ? afterOpen : nl + 1;
    const closeIdx = markdown.indexOf("```", searchFrom);
    if (closeIdx === -1) {
      out.push({ kind: "fence", text: markdown.slice(i) });
      break;
    }
    out.push({ kind: "fence", text: markdown.slice(i, closeIdx + 3) });
    i = closeIdx + 3;
  }
  return out;
}

/**
 * Wrap bare `XF_CITE:slug` / `XF_TOOL:slug` when they appear **mid-line** in prose (not only line-start / tail).
 * Skips fenced ``` blocks and inline `…` / `` … `` so code samples and already-wrapped chips are untouched.
 * Run after {@link wrapBareXfCiteLines}.
 */
export function wrapMidLineBareXfSentinels(markdown: string): string {
  const chunks = splitMarkdownByTripleBacktickFences(normalizeXchatMarkdownNoise(markdown));
  return chunks
    .map((chunk) => {
      if (chunk.kind === "fence") {
        return chunk.text;
      }
      return walkInlineCodeCopyingSpans(chunk.text, wrapBareXfSentinelsInPlainText);
    })
    .join("");
}

const WRAPPED_XF_CHIP_ONLY_LINE =
  /^\s*`XF_(CITE|TOOL):[a-z0-9_]+(?:\|[^`]+)?`\s*$/;

function netAsciiParenCount(line: string): number {
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "(") {
      n++;
    } else if (c === ")") {
      n--;
    }
  }
  return n;
}

/**
 * Models often emit a cite-only line between an opening `(` and a line that starts with `)`,
 * which splits CommonMark into paragraphs and makes the closing `)` look missing or broken.
 * Merge those three lines into one (cite stays inline).
 *
 * Run after {@link wrapBareXfCiteLines} / {@link wrapMidLineBareXfSentinels}.
 */
export function rejoinWrappedCiteSplitAcrossParens(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const a = lines[i] ?? "";
    const b = lines[i + 1] ?? "";
    const c = lines[i + 2] ?? "";
    if (
      i + 2 < lines.length &&
      netAsciiParenCount(a) > 0 &&
      WRAPPED_XF_CHIP_ONLY_LINE.test(b) &&
      c.trimStart().startsWith(")")
    ) {
      out.push(`${a.trimEnd()} ${b.trim()} ${c.trimStart()}`);
      i += 3;
      continue;
    }
    out.push(a);
    i += 1;
  }
  return out.join("\n");
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
