import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { addFileToXaiCollection, uploadFileToXai } from "@/lib/xai";
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
  | "finance-reference-docs";

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

function financeKbFrontmatterKeySetForSegment(segment: FinanceKbUploadSegment | string): Set<string> {
  if (segment === "atx-response-guidelines") {
    return FINANCE_KB_RESPONSE_GUIDELINES_FRONTMATTER_METADATA_KEYS;
  }
  return FINANCE_KB_STRATEGY_FRONTMATTER_METADATA_KEYS;
}

export type ExtractFinanceKbFrontmatterMetadataOptions = {
  /** When set to `atx-response-guidelines`, allows guideline fields (`doc_type`, `audience`, …). */
  kbSegment?: FinanceKbUploadSegment | string;
};

export function extractFinanceKbFrontmatterMetadata(
  raw: string,
  options?: ExtractFinanceKbFrontmatterMetadataOptions
): Record<string, unknown> {
  const m = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m?.[1]) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(m[1]);
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

export type FinanceKbSyncResult = {
  collectionId: string;
  collectionDisplayName: string;
  filesUploaded: number;
  fileCandidates: number;
  errors: FinanceKbSyncError[];
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

function normalizeLogicalUploadName(source: string, relativePosixPath: string): string {
  const raw = relativePosixPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  const prefix = source.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}__${safe}`;
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

export function resolveFinanceKbRoots(repoRoot: string): Array<{ dir: string; source: string }> {
  const roots: Array<{ dir: string; source: string }> = [];
  const candidates: Array<{ segments: string[]; source: string }> = [
    { segments: ["atx-docs", "rag-collection", "options-strategy-core"], source: "options-strategy-core" },
    { segments: ["atx-docs", "rag-collection", "options-strategy-advanced"], source: "options-strategy-advanced" },
    { segments: ["atx-docs", "rag-collection", "atx-response-guidelines"], source: "atx-response-guidelines" },
    { segments: ["atx-docs", "rag-collection", "finance"], source: "finance" },
    { segments: ["atx-docs", "rag-collection", "finance-reference-docs"], source: "finance-reference-docs" }
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
  const roots = resolveFinanceKbRoots(input.repoRoot);
  const files: WalkedFile[] = [];
  for (const root of roots) {
    files.push(...(await walkIngestFiles(root.dir, root.source)));
  }

  let filesUploaded = 0;
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
      const metadata = {
        source: file.source,
        slug: file.rel.replace(/\.[^.]+$/, ""),
        ...(riskProfile ? { risk_profile: riskProfile } : {}),
        category: file.source,
        last_updated: new Date().toISOString(),
        ...fm
      };
      const logicalFilename = normalizeLogicalUploadName(file.source, file.rel);
      const payload = Buffer.concat([
        bytes,
        Buffer.from(`\n\n<!-- xfinance-kb-metadata: ${JSON.stringify(metadata)} -->\n`, "utf8")
      ]);
      const uploaded = await uploadFileToXai(logicalFilename, Uint8Array.from(payload));
      await addFileToXaiCollection({ collectionId, fileId: uploaded.fileId });
      filesUploaded += 1;
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
    errors
  };
}
