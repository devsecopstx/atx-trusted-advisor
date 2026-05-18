import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { resolvePdfIngestKbFiles } from "@/modules/rag/pdf-ingest";

import {
    addFileToXaiCollection,
    getXaiCollectionFieldDefinitionKeys,
    listXaiCollectionDocuments,
    removeDocumentFromXaiCollection,
    uploadFileToXai
} from "@/lib/xai";
import {
    getXaiFinanceCollectionId,
    XAI_FINANCE_COLLECTION_DISPLAY_NAME
} from "@/lib/xai-finance-collection";

const INGEST_EXTENSIONS = new Set([".md", ".markdown", ".yaml", ".yml"]);
const SKIP_FILE_NAMES = new Set(["readme.md", ".ds_store"]);

/** Segment id from `resolveFinanceKbRoots` → `walkIngestFiles` (`WalkedFile.source`). */
export type FinanceKbUploadSegment =
  | "options-strategy-core"
  | "options-strategy-advanced"
  | "atx-response-guidelines"
  | "finance"
  | "finance-core";

/** YAML keys merged for options-strategy-* markdown (Finance KB). */
const FINANCE_KB_STRATEGY_FRONTMATTER_METADATA_KEYS = new Set([
  "id",
  "name",
  "description",
  "strategy_type",
  "risk_level",
  "market_condition",
  "complexity",
  "underlying_type",
  "tags"
]);

/** YAML keys merged for `atx-response-guidelines` (xChat / report voice & contracts). */
const FINANCE_KB_RESPONSE_GUIDELINES_FRONTMATTER_METADATA_KEYS = new Set([
  "id",
  "name",
  "description",
  "tags",
  "doc_type",
  "audience",
  "surface",
  "compliance_scope"
]);

/** `finance-core` / `finance` tree: strategy-style tags plus guideline-style doc typing (xAI field_definitions often mix both). */
const FINANCE_KB_FINANCE_CORE_FRONTMATTER_METADATA_KEYS = new Set([
  ...FINANCE_KB_STRATEGY_FRONTMATTER_METADATA_KEYS,
  "doc_type",
  "audience",
  "surface",
  "compliance_scope"
]);

function financeKbFrontmatterKeySetForSegment(segment: FinanceKbUploadSegment | string): Set<string> {
  if (segment === "atx-response-guidelines") {
    return FINANCE_KB_RESPONSE_GUIDELINES_FRONTMATTER_METADATA_KEYS;
  }
  if (segment === "finance-core" || segment === "finance") {
    return FINANCE_KB_FINANCE_CORE_FRONTMATTER_METADATA_KEYS;
  }
  return FINANCE_KB_STRATEGY_FRONTMATTER_METADATA_KEYS;
}

/** First YAML frontmatter block: anchored `---` (options tree) or first newline-delimited `---` block (e.g. `# title` line before YAML in finance-core). */
export function matchFinanceKbYamlFrontmatterInner(raw: string): string | undefined {
  const anchored = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (anchored?.[1]) {
    return anchored[1];
  }
  const afterTitle = raw.match(/\r?\n---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (afterTitle?.[1]) {
    return afterTitle[1];
  }
  return undefined;
}

export type ExtractFinanceKbFrontmatterMetadataOptions = {
  /**
   * Segment drives YAML key whitelist:
   * - `atx-response-guidelines` — guideline keys (`doc_type`, `surface`, …)
   * - `finance-core` / `finance` — strategy keys **plus** guideline keys (for mixed xAI `field_definitions`)
   * - default — options-strategy keys only
   */
  kbSegment?: FinanceKbUploadSegment | string;
};

export function extractFinanceKbFrontmatterMetadata(
  raw: string,
  options?: ExtractFinanceKbFrontmatterMetadataOptions
): Record<string, unknown> {
  const inner = matchFinanceKbYamlFrontmatterInner(raw);
  if (!inner) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(inner);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const allowed = financeKbFrontmatterKeySetForSegment(options?.kbSegment ?? "");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (allowed.has(k) && v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out;
}

export type FinanceKbSyncError = {
  source: string;
  message: string;
};

export type FinanceKbSyncChangeAction = "created" | "updated";

export type FinanceKbSyncChange = {
  source: string;
  relativePath: string;
  logicalName: string;
  action: FinanceKbSyncChangeAction;
  previousFileId?: string;
  newFileId: string;
  fieldKeysSent: string[];
  alreadyLinked: boolean;
};

export type FinanceKbSyncResult = {
  collectionId: string;
  collectionDisplayName: string;
  filesUploaded: number;
  fileCandidates: number;
  errors: FinanceKbSyncError[];
  /** Distinct logical filenames seen in the collection before this run (best-effort). */
  existingRemoteDocuments: number;
  /** Keys returned from the collection `field_definitions` (may be empty). */
  collectionFieldDefinitionKeys: string[];
  documentsCreated: number;
  documentsUpdated: number;
  changes: FinanceKbSyncChange[];
};

type WalkedFile = {
  abs: string;
  rel: string;
  source: string;
};

/** Strategy folder slug (nested `slug/slug.md`) or flat file stem (`stem.md`). */
export function strategySlugFromRelativePath(relativePath: string): string {
  const posix = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = posix.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return parts[0]!.toLowerCase();
  }
  const file = parts[0] ?? "";
  return file.replace(/\.[^.]+$/i, "").toLowerCase();
}

export function inferRiskProfile(relativePath: string): string | undefined {
  const slug = strategySlugFromRelativePath(relativePath);
  const conservative = new Set([
    "cash-secured-puts",
    "covered-calls",
    "wheel",
    "poor-mans-covered-call"
  ]);
  const balanced = new Set([
    "iron-condor",
    "calendar-spread",
    "bull-put-credit-spread",
    "bull-call-debit-spread",
    "jade-lizard"
  ]);
  const aggressive = new Set(["ratio-spread", "zebra", "diagonal-spread", "broken-wing-butterfly"]);
  const conservativeAliases = new Set(["wheel-strategy", "covered-call-and-csp"]);
  const balancedAliases = new Set(["iron-condor-jade-lizard", "straddle-strangle"]);
  if (conservativeAliases.has(slug)) {
    return "conservative";
  }
  if (balancedAliases.has(slug)) {
    return "balanced";
  }
  if (conservative.has(slug)) {
    return "conservative";
  }
  if (balanced.has(slug)) {
    return "balanced";
  }
  if (aggressive.has(slug)) {
    return "aggressive";
  }
  return undefined;
}

/** Stable upload / `file_metadata.name` used to match remote rows for replace + metadata sync. */
export function financeKbLogicalUploadName(source: string, relativePosixPath: string): string {
  const raw = relativePosixPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  const prefix = source.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}__${safe}`;
}

/** Coerce Finance KB metadata values to xAI `fields` scalars (string | number). */
export function coerceFinanceKbValueForXaiField(value: unknown): string | number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => {
      if (item === null || item === undefined) {
        return "";
      }
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return String(item);
      }
      return JSON.stringify(item);
    });
    return parts.filter(Boolean).join(",");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Loose key match: lowercase and strip underscores (maps `risk_profile` ↔ `riskProfile`, `doc_type` ↔ `docType`). */
export function normalizeFinanceKbMetadataFieldKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "");
}

/** Map merged metadata to xAI document `fields` using collection `field_definitions` keys only. */
export function financeKbMetadataToXaiFields(
  metadata: Record<string, unknown>,
  allowedKeys: Set<string>
): Record<string, string | number> {
  const looseToActual = new Map<string, string>();
  for (const metaKey of Object.keys(metadata)) {
    looseToActual.set(normalizeFinanceKbMetadataFieldKey(metaKey), metaKey);
  }
  const out: Record<string, string | number> = {};
  for (const fieldKey of allowedKeys) {
    const exact = Object.prototype.hasOwnProperty.call(metadata, fieldKey) ? fieldKey : undefined;
    const actualMetaKey =
      exact ?? looseToActual.get(normalizeFinanceKbMetadataFieldKey(fieldKey)) ?? undefined;
    if (!actualMetaKey) {
      continue;
    }
    const coerced = coerceFinanceKbValueForXaiField(metadata[actualMetaKey]);
    if (coerced !== undefined) {
      out[fieldKey] = coerced;
    }
  }
  return out;
}

/** Last-wins index by logical file name (matches `financeKbLogicalUploadName`). */
export function indexFinanceKbRemoteDocumentsByLogicalName(
  docs: Array<{ fileId: string; name?: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of docs) {
    const n = row.name?.trim();
    if (n && row.fileId) {
      map.set(n, row.fileId);
    }
  }
  return map;
}

async function walkIngestFiles(rootDir: string, source: string): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];
  async function walk(absDir: string, rel = ""): Promise<void> {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".")) {
        continue;
      }
      const abs = join(absDir, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(abs, r);
      } else if (ent.isFile()) {
        const low = ent.name.toLowerCase();
        if (SKIP_FILE_NAMES.has(low)) {
          continue;
        }
        const ext = low.slice(low.lastIndexOf("."));
        if (!INGEST_EXTENSIONS.has(ext)) {
          continue;
        }
        out.push({ abs, rel: r.replace(/\\/g, "/"), source });
      }
    }
  }
  await walk(rootDir);
  return out;
}

/** Nested `options-strategy/<slug>/<slug>.md` quant desk playbooks uploaded via `refresh-finance` (single source; not full nested tree). */
export const QUANT_DESK_OPTIONS_STRATEGY_SUBDIRS = [
  "quant-monte-carlo-wheel",
  "portfolio-level-quant-aggregation",
  "drawdown-and-risk-metric-playbook",
  "iv-rank-strategy-selection-and-filtering",
  "conservative-balanced-aggressive-quant-parameters"
] as const;

export type WalkedFinanceKbFile = {
  abs: string;
  rel: string;
  source: FinanceKbUploadSegment | string;
};

/** Resolve quant desk markdown from nested options-strategy folders for Finance KB sync. */
export function resolveQuantDeskKbFiles(repoRoot: string): WalkedFinanceKbFile[] {
  const base = join(repoRoot, "atx-docs", "rag-collection", "options-strategy");
  const out: WalkedFinanceKbFile[] = [];
  for (const sub of QUANT_DESK_OPTIONS_STRATEGY_SUBDIRS) {
    const abs = join(base, sub, `${sub}.md`);
    if (existsSync(abs)) {
      out.push({
        abs,
        rel: `${sub}/${sub}.md`,
        source: "options-strategy-core"
      });
    }
  }
  return out;
}

export function resolveFinanceKbRoots(repoRoot: string): Array<{ dir: string; source: string }> {
  const roots: Array<{ dir: string; source: string }> = [];
  const candidates: Array<{ segments: string[]; source: string }> = [
    { segments: ["atx-docs", "rag-collection", "options-strategy-core"], source: "options-strategy-core" },
    { segments: ["atx-docs", "rag-collection", "options-strategy-advanced"], source: "options-strategy-advanced" },
    { segments: ["atx-docs", "rag-collection", "atx-response-guidelines"], source: "atx-response-guidelines" },
    { segments: ["atx-docs", "rag-collection", "finance"], source: "finance" },
    { segments: ["atx-docs", "rag-collection", "finance-core"], source: "finance-core" }
  ];
  for (const row of candidates) {
    const dir = join(repoRoot, ...row.segments);
    if (existsSync(dir)) {
      roots.push({ dir, source: row.source });
    }
  }
  return roots;
}

export async function syncFinanceKnowledgeBaseToXai(input: {
  repoRoot: string;
  maxFileBytes?: number;
}): Promise<FinanceKbSyncResult> {
  const maxBytes = input.maxFileBytes ?? 24 * 1024 * 1024;
  const collectionId = getXaiFinanceCollectionId();
  const errors: FinanceKbSyncError[] = [];
  const changes: FinanceKbSyncChange[] = [];
  const roots = resolveFinanceKbRoots(input.repoRoot);
  const files: WalkedFile[] = [];
  for (const root of roots) {
    files.push(...(await walkIngestFiles(root.dir, root.source)));
  }
  files.push(...resolveQuantDeskKbFiles(input.repoRoot));
  const pdfIngest = await resolvePdfIngestKbFiles(input.repoRoot);
  for (const row of pdfIngest) {
    files.push({ abs: row.abs, rel: row.rel, source: row.source });
  }

  let documentsByLogicalName = new Map<string, string>();
  try {
    const listed = await listXaiCollectionDocuments(collectionId);
    documentsByLogicalName = indexFinanceKbRemoteDocumentsByLogicalName(listed);
  } catch (error) {
    errors.push({
      source: "__collection__",
      message: `listXaiCollectionDocuments failed: ${error instanceof Error ? error.message : String(error)}`
    });
    return {
      collectionId,
      collectionDisplayName: XAI_FINANCE_COLLECTION_DISPLAY_NAME,
      filesUploaded: 0,
      fileCandidates: files.length,
      errors,
      existingRemoteDocuments: 0,
      collectionFieldDefinitionKeys: [],
      documentsCreated: 0,
      documentsUpdated: 0,
      changes: []
    };
  }

  const existingRemoteDocuments = documentsByLogicalName.size;

  let collectionFieldDefinitionKeys: string[] = [];
  try {
    collectionFieldDefinitionKeys = await getXaiCollectionFieldDefinitionKeys(collectionId);
  } catch (error) {
    errors.push({
      source: "__collection__",
      message: `getXaiCollectionFieldDefinitionKeys failed: ${error instanceof Error ? error.message : String(error)} (continuing without native fields)`
    });
  }
  const allowedFieldKeys = new Set(collectionFieldDefinitionKeys);

  let filesUploaded = 0;
  let documentsCreated = 0;
  let documentsUpdated = 0;

  for (const file of files) {
    try {
      const st = await stat(file.abs);
      if (st.size > maxBytes) {
        errors.push({
          source: file.rel,
          message: `skip: file exceeds ${maxBytes} bytes`
        });
        continue;
      }
      const bytes = await readFile(file.abs);
      const text = bytes.toString("utf8");
      const riskProfile = inferRiskProfile(file.rel);
      const fm =
        file.rel.toLowerCase().endsWith(".md") || file.rel.toLowerCase().endsWith(".markdown")
          ? extractFinanceKbFrontmatterMetadata(text, { kbSegment: file.source })
          : {};
      const metadata: Record<string, unknown> = {
        source: file.source,
        slug: file.rel.replace(/\.[^.]+$/, ""),
        ...(riskProfile ? { risk_profile: riskProfile } : {}),
        category: file.source,
        last_updated: new Date().toISOString(),
        ...fm
      };
      const logicalFilename = financeKbLogicalUploadName(file.source, file.rel);
      const payload = Buffer.concat([
        bytes,
        Buffer.from(`\n\n<!-- xfinance-kb-metadata: ${JSON.stringify(metadata)} -->\n`, "utf8")
      ]);

      const previousFileId = documentsByLogicalName.get(logicalFilename);
      const uploaded = await uploadFileToXai(logicalFilename, Uint8Array.from(payload));
      if (previousFileId) {
        await removeDocumentFromXaiCollection({ collectionId, fileId: previousFileId });
        documentsByLogicalName.delete(logicalFilename);
      }

      const fields = financeKbMetadataToXaiFields(metadata, allowedFieldKeys);
      const link = await addFileToXaiCollection({
        collectionId,
        fileId: uploaded.fileId,
        ...(Object.keys(fields).length > 0 ? { fields } : {})
      });

      documentsByLogicalName.set(logicalFilename, uploaded.fileId);
      filesUploaded += 1;
      if (previousFileId) {
        documentsUpdated += 1;
      } else {
        documentsCreated += 1;
      }
      changes.push({
        source: file.source,
        relativePath: file.rel,
        logicalName: logicalFilename,
        action: previousFileId ? "updated" : "created",
        ...(previousFileId ? { previousFileId } : {}),
        newFileId: uploaded.fileId,
        fieldKeysSent: Object.keys(fields),
        alreadyLinked: link.alreadyLinked
      });
    } catch (error) {
      errors.push({
        source: file.rel,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    collectionId,
    collectionDisplayName: XAI_FINANCE_COLLECTION_DISPLAY_NAME,
    filesUploaded,
    fileCandidates: files.length,
    errors,
    existingRemoteDocuments,
    collectionFieldDefinitionKeys,
    documentsCreated,
    documentsUpdated,
    changes
  };
}
