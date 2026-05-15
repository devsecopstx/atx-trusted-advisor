/**
 * Parse persona specs from in-memory text (YAML, or markdown + YAML frontmatter).
 * Used by disk seed scripts and admin “sync from xAI collection” (file content).
 */
import { parse as parseYaml } from "yaml";

import { PERSONA_VALIDATION_LIMITS } from "@/modules/xchat/persona-validation";

/** Parse `---\nfm\n---\nbody` markdown; return mapping for persona derivation. */
export function markdownFrontmatterToPersonaDoc(
  text: string,
  fileLabel: string
): { doc: Record<string, unknown> } | { error: string } {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("---")) {
    return {
      error: `${fileLabel}: expected markdown with YAML frontmatter (starts with ---)`
    };
  }
  const afterOpen = trimmed.slice(3).replace(/^\s*/, "");
  const delim = /\n---\s*(?:\n|$)/;
  const m = afterOpen.match(delim);
  if (!m || m.index === undefined) {
    return { error: `${fileLabel}: unclosed or missing closing --- frontmatter delimiter` };
  }
  const fmRaw = afterOpen.slice(0, m.index).trim();
  const body = afterOpen.slice(m.index + m[0].length).trim();

  let fm: unknown;
  try {
    fm = parseYaml(fmRaw);
  } catch (e) {
    return {
      error: `${fileLabel}: frontmatter YAML: ${e instanceof Error ? e.message : String(e)}`
    };
  }
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) {
    return { error: `${fileLabel}: frontmatter must be a YAML mapping` };
  }
  const o = fm as Record<string, unknown>;
  const name = String(o.name ?? o.id ?? "").trim();
  if (!name) {
    return { error: `${fileLabel}: frontmatter must set name or id` };
  }

  const systemFromFm = typeof o.system_prompt === "string" ? o.system_prompt.trim() : "";
  const desc = typeof o.description === "string" ? o.description.trim() : "";
  let systemPrompt = systemFromFm;
  if (!systemPrompt) {
    const parts: string[] = [];
    if (desc) {
      parts.push(`## Summary\n\n${desc}`);
    }
    if (body) {
      parts.push(`## Strategy reference\n\n${body}`);
    }
    systemPrompt = parts.join("\n\n");
  }

  const doc: Record<string, unknown> = {
    ...o,
    name,
    system_prompt: systemPrompt
  };
  return { doc };
}

export function parseYamlRoot(text: string, fileLabel: string): { doc: Record<string, unknown> } | { error: string } {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (e) {
    return {
      error: `${fileLabel}: ${e instanceof Error ? e.message : String(e)}`
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: `${fileLabel}: invalid YAML root` };
  }
  return { doc: parsed as Record<string, unknown> };
}

export function loadPersonaDocFromText(
  relLabel: string,
  text: string,
  fileName: string
): { rel: string; doc: Record<string, unknown> } | { error: string } {
  const low = fileName.toLowerCase();
  if (low === "readme.md") {
    return { error: `${relLabel}: skipped readme` };
  }
  if (low.endsWith(".md")) {
    const r = markdownFrontmatterToPersonaDoc(text, relLabel);
    if ("error" in r) {
      return r;
    }
    return { rel: relLabel, doc: r.doc };
  }
  if (low.endsWith(".yaml") || low.endsWith(".yml")) {
    const y = parseYamlRoot(text, relLabel);
    if ("error" in y) {
      return y;
    }
    return { rel: relLabel, doc: y.doc };
  }
  return { error: `${relLabel}: unsupported extension (use .yaml, .yml, or frontmatter .md)` };
}

/**
 * xAI collection document names may omit extensions (ingest normalizes paths). Try frontmatter markdown first,
 * then whole-document YAML.
 */
export function loadPersonaDocFromUnknownText(
  relLabel: string,
  text: string
): { rel: string; doc: Record<string, unknown> } | { error: string } {
  const trimmed = text.trimStart();
  let mdErr = "";
  if (trimmed.startsWith("---")) {
    const m = markdownFrontmatterToPersonaDoc(text, relLabel);
    if (!("error" in m)) {
      return { rel: relLabel, doc: m.doc };
    }
    mdErr = m.error;
  }
  const y = parseYamlRoot(text, relLabel);
  if (!("error" in y)) {
    return { rel: relLabel, doc: y.doc };
  }
  return { error: mdErr || y.error };
}

function isProbablyBinaryText(t: string): boolean {
  const sample = t.slice(0, 4096);
  if (sample.length === 0) {
    return true;
  }
  let ctrl = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0 || (c < 32 && c !== 9 && c !== 10 && c !== 13)) {
      ctrl++;
    }
  }
  return ctrl / sample.length > 0.03;
}

const INGEST_ROOT_PREFIX_RES: RegExp[] = [
  /^xai:/i,
  /^xpersonas__/i,
  /^finance_core__/i,
  /^finance-core__/i,
  /^finance_reference_docs__/i,
  /^finance-reference-docs__/i,
  /^example_prompts__/i,
  /^example-prompts__/i,
  /^options_strategy__/i,
  /^options-strategy__/i,
  /^atx_rag_xpersonas__/i,
  /^atx-rag-xpersonas__/i
];

function stripAllIngestRootPrefixes(input: string): string {
  let t = input.trim();
  for (let round = 0; round < 8; round++) {
    let changed = false;
    for (const re of INGEST_ROOT_PREFIX_RES) {
      if (re.test(t)) {
        t = t.replace(re, "");
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return t;
}

function stripTypeMarkerFromSegment(seg: string): string {
  return seg
    .replace(/\.(ya?ml|md|txt|markdown)$/i, "")
    .replace(/_(ya?ml|md|txt|markdown)$/i, "");
}

/**
 * Strip seed/RAG “apex” path segments and type suffixes (`_yaml`, `_md`, …) from an xAI collection
 * document name; return the canonical stem (usually the folder/file stem).
 */
export function friendlyStemFromXaiIngestFileName(fileName: string): string {
  const t = stripAllIngestRootPrefixes(fileName);
  const parts = t.split("__").map((p) => stripTypeMarkerFromSegment(p.trim())).filter(Boolean);
  if (parts.length === 0) {
    return stripTypeMarkerFromSegment(t);
  }
  const last = parts[parts.length - 1];
  if (parts.length >= 2) {
    const prev = parts[parts.length - 2];
    if (prev === last) {
      return last;
    }
    if (last.startsWith(`${prev}_`)) {
      return last;
    }
  }
  return last;
}

function clampPersonaDisplayName(s: string, max = PERSONA_VALIDATION_LIMITS.nameLength): string {
  const t = s.trim();
  if (t.length <= max) {
    return t;
  }
  return t.slice(0, max).trimEnd();
}

function toFriendlyTitleWords(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** True when the YAML `name` looks like a raw ingest path (not admin-authored display text). */
export function yamlNameLooksLikeIngestPath(raw: string): boolean {
  const s = raw.trim();
  if (!s) {
    return true;
  }
  if (/__/.test(s)) {
    return true;
  }
  if (/_ya?ml$|_md$|_txt$|_markdown$/i.test(s)) {
    return true;
  }
  const lower = s.toLowerCase();
  if (lower.startsWith("xpersonas__") || lower.startsWith("xpersonas/")) {
    return true;
  }
  const roots = [
    "finance_core",
    "finance-core",
    "finance_reference_docs",
    "finance-reference-docs",
    "example_prompts",
    "example-prompts",
    "options_strategy",
    "options-strategy",
    "atx_rag_xpersonas",
    "atx-rag-xpersonas"
  ];
  for (const p of roots) {
    if (lower.startsWith(`${p}__`) || lower.startsWith(`${p}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Human-friendly Mongo `name` for admin “Sync from xAI → DB”: trims ingest apex/suffix noise,
 * title-cases slug stems, preserves intentional mixed-case / spaced names from YAML.
 */
export function friendlyDisplayNameForSyncedXpersona(opts: {
  yamlName: string;
  fileName?: string;
  fileId: string;
}): string {
  const raw = opts.yamlName.trim();
  if (raw && !yamlNameLooksLikeIngestPath(raw)) {
    if (/[A-Z]/.test(raw) || /\s/.test(raw)) {
      return clampPersonaDisplayName(raw);
    }
    return clampPersonaDisplayName(toFriendlyTitleWords(raw));
  }
  const stem = opts.fileName?.trim()
    ? friendlyStemFromXaiIngestFileName(opts.fileName)
    : raw
      ? friendlyStemFromXaiIngestFileName(raw)
      : "";
  const fromStem = stem ? toFriendlyTitleWords(stem) : "";
  if (fromStem.length >= 2) {
    return clampPersonaDisplayName(fromStem);
  }
  const fallback =
    opts.fileId.replace(/^file_/, "").replace(/-/g, "").slice(-8) || "import";
  return clampPersonaDisplayName(`Persona ${fallback}`);
}

/** When `friendlyDisplayNameForSyncedXpersona` collides with another persona, append a short file id fragment. */
export function disambiguateSyncedPersonaDisplayName(base: string, fileId: string): string {
  const tail = fileId.replace(/^file_/, "").replace(/-/g, "").slice(-6) || "x";
  const suffix = ` ${tail}`;
  const max = PERSONA_VALIDATION_LIMITS.nameLength;
  if (base.length + suffix.length <= max) {
    return base + suffix;
  }
  const headLen = Math.max(2, max - suffix.length);
  return `${base.slice(0, headLen).trimEnd()}${suffix}`;
}

/** When strict YAML/frontmatter parse fails, allow plain-text persona for obvious text uploads (seed RAG names). */
export function shouldOfferSyntheticPersonaFromIngest(opts: {
  fileName?: string;
  contentType?: string;
}): boolean {
  const n = (opts.fileName ?? "").toLowerCase();
  const ct = (opts.contentType ?? "").toLowerCase();

  if (ct.includes("pdf") || ct.startsWith("image/")) {
    return false;
  }

  if (/\.(ya?ml|md|txt|markdown)$/i.test(n) || /_(ya?ml|md|txt)$/i.test(n)) {
    return true;
  }

  if (!ct || ct.startsWith("text/")) {
    return true;
  }
  if (ct.includes("yaml") || ct.includes("json") || ct.includes("markdown")) {
    return true;
  }

  return false;
}

/**
 * Build a minimal persona doc from raw file text (filename-derived display name + file id suffix for uniqueness).
 */
export function buildSyntheticPersonaDocFromIngestedFile(input: {
  sourceLabel: string;
  fileId: string;
  displayFileName?: string;
  text: string;
}): { doc: Record<string, unknown> } | { error: string } {
  const trimmed = input.text.trim();
  if (trimmed.length < 10) {
    return { error: `${input.sourceLabel}: content too short for synthetic persona` };
  }
  if (isProbablyBinaryText(trimmed)) {
    return { error: `${input.sourceLabel}: content looks binary — not a text persona` };
  }

  const maxSp = PERSONA_VALIDATION_LIMITS.systemPromptLength;
  const systemPrompt = trimmed.length > maxSp ? trimmed.slice(0, maxSp) : trimmed;

  const name = friendlyDisplayNameForSyncedXpersona({
    yamlName: "",
    fileName: input.displayFileName,
    fileId: input.fileId
  });

  return {
    doc: {
      name,
      system_prompt: systemPrompt,
      enable_rag: true,
      default_scope: "global"
    }
  };
}
