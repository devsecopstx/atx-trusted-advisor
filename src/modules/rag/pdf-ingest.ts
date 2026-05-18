import { spawn } from "node:child_process";
import {
    access,
    copyFile,
    constants as fsConstants,
    mkdir,
    readdir,
    readFile,
    stat,
    writeFile
} from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";

import { getDb } from "@/lib/mongodb";
import {
    addFileToXaiCollection,
    addXaiCollectionFieldDefinitions,
    createXaiCollection,
    getXaiCollectionFieldDefinitionKeys,
    listXaiCollectionDocuments,
    listXaiCollections,
    removeDocumentFromXaiCollection,
    uploadFileToXai,
    type XaiFieldDefinitionInput
} from "@/lib/xai";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    extractFinanceKbFrontmatterMetadata,
    financeKbMetadataToXaiFields,
    indexFinanceKbRemoteDocumentsByLogicalName
} from "@/modules/xchat/finance-kb-sync";

export const PDF_INGEST_SLUG_RE = /^[a-z][a-z0-9-]{0,62}$/;

/** Top-level rag-collection segments — not PDF-ingest slug folders. */
export const RAG_COLLECTION_RESERVED_DIRS = new Set([
  "xpersonas",
  "finance-core",
  "finance",
  "options-strategy",
  "options-strategy-core",
  "options-strategy-advanced",
  "atx-response-guidelines",
  "example-prompts",
  "exam-finra"
]);

export const PDF_INGEST_MANIFEST_FILENAME = "ingest.manifest.json";
export const PDF_INGEST_SOURCE_COPY_NAME = "source.pdf";

export type PdfIngestKbSegment = "options-strategy-advanced" | "options-strategy-core" | "finance-core";

const riskLevelSchema = z.enum(["conservative", "balanced", "aggressive"]);

export const pdfIngestManifestSchema = z.object({
  version: z.literal(1),
  slug: z.string().regex(PDF_INGEST_SLUG_RE),
  title: z.string().min(1).max(256),
  riskLevel: riskLevelSchema,
  outlook: z.string().min(1).max(128),
  tags: z.array(z.string().min(1).max(64)).max(32),
  sourcePdf: z.string().min(1).max(256),
  ingestedAt: z.string().datetime(),
  chunkFiles: z.array(z.string().min(1)).min(1),
  segment: z.enum(["options-strategy-advanced", "options-strategy-core", "finance-core"]),
  pageCount: z.number().int().nonnegative().optional(),
  mongoSeededAt: z.string().datetime().nullable().optional(),
  xaiSyncedAt: z.string().datetime().nullable().optional(),
  xaiCollectionId: z.string().nullable().optional(),
  xaiCollectionName: z.string().nullable().optional()
});

export type PdfIngestManifest = z.infer<typeof pdfIngestManifestSchema>;

export type PdfIngestCliInput = {
  file: string;
  slug: string;
  title: string;
  risk: string;
  outlook: string;
  tags: string[];
  segment?: PdfIngestKbSegment;
};

export type PdfIngestFolderSummary = {
  slug: string;
  title: string;
  riskLevel: string;
  outlook: string;
  tags: string[];
  segment: PdfIngestKbSegment;
  ingestedAt: string;
  chunkCount: number;
  firstChunkPreview: string;
  mongoSeededAt: string | null;
  xaiSyncedAt: string | null;
  xaiCollectionId: string | null;
  xaiCollectionName: string | null;
};

export type PdfIngestMongoSeedResult = {
  ok: true;
  slug: string;
  upserted: boolean;
  mongoCollection: "options_strategy";
  title: string;
  chunkCount: number;
  seededAt: string;
};

export type PdfIngestXaiSeedResult = {
  ok: boolean;
  collectionId: string;
  collectionName: string;
  collectionCreated: boolean;
  fieldDefinitionKeys: string[];
  filesUploaded: number;
  documentsCreated: number;
  documentsUpdated: number;
  errors: Array<{ source: string; message: string }>;
  seededAt: string;
};

export type PdfIngestFolderDetail = PdfIngestFolderSummary & {
  manifest: PdfIngestManifest;
  chunkFiles: Array<{ name: string; bytes: number }>;
};

type PythonChunk = {
  index: number;
  markdown: string;
};

type PythonIngestResult = {
  pageCount: number;
  title: string;
  chunks: PythonChunk[];
};

/** pymupdf4llm may print progress before JSON; extract the payload object. */
export function parsePythonIngestStdout(stdout: string): PythonIngestResult {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as PythonIngestResult;
  } catch {
    const marker = trimmed.indexOf('{"pageCount"');
    if (marker >= 0) {
      return JSON.parse(trimmed.slice(marker)) as PythonIngestResult;
    }
    const brace = trimmed.lastIndexOf("{");
    if (brace >= 0) {
      return JSON.parse(trimmed.slice(brace)) as PythonIngestResult;
    }
    throw new Error("no JSON object in python stdout");
  }
}

export function ragCollectionRoot(repoRoot: string): string {
  return join(repoRoot, "atx-docs", "rag-collection");
}

export function pdfIngestFolderPath(repoRoot: string, slug: string): string {
  return join(ragCollectionRoot(repoRoot), slug);
}

export function normalizeRiskLevel(input: string): z.infer<typeof riskLevelSchema> {
  const raw = input.trim().toLowerCase();
  if (raw === "conservative" || raw.startsWith("conserv")) {
    return "conservative";
  }
  if (raw === "aggressive" || raw.startsWith("aggress")) {
    return "aggressive";
  }
  return "balanced";
}

export function slugifyOutlook(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function buildPdfIngestFrontmatter(input: {
  slug: string;
  title: string;
  riskLevel: z.infer<typeof riskLevelSchema>;
  outlook: string;
  tags: string[];
  chunkIndex: number;
  chunkTotal: number;
  pageCount?: number;
}): string {
  const id = `xfinance-pdf-ingest-${input.slug}${input.chunkTotal > 1 ? `-part-${String(input.chunkIndex).padStart(3, "0")}` : ""}`;
  const market = slugifyOutlook(input.outlook) || "neutral";
  const lines = [
    "---",
    `id: ${id}`,
    `name: ${id}`,
    `description: ${input.title.replace(/"/g, '\\"')}${input.chunkTotal > 1 ? ` (part ${input.chunkIndex}/${input.chunkTotal})` : ""}`,
    "strategy_type: pdf_ingest",
    `risk_level: ${input.riskLevel}`,
    `market_condition: ${market}`,
    "complexity: advanced",
    "underlying_type: stock",
    `tags: [pdf_ingest, ${input.tags.join(", ")}]`,
    "---",
    "",
    `<!-- INGEST: pdf → markdown via pymupdf4llm; slug=${input.slug}; outlook=${input.outlook.replace(/-->/g, "")} -->`,
    ""
  ];
  if (input.pageCount && input.pageCount > 0) {
    lines.push(`*Source PDF: ${input.pageCount} page(s).*`, "");
  }
  return lines.join("\n");
}

/** xAI collection name for a PDF ingest slug (one collection per ingest folder). */
export function pdfIngestXaiCollectionName(slug: string): string {
  return `xfinance-pdf-ingest-${slug}`;
}

/** Metadata fields created on the per-slug xAI collection (`tags` is optional — edit manifest and re-sync). */
export const PDF_INGEST_XAI_FIELD_DEFINITIONS: XaiFieldDefinitionInput[] = [
  { key: "slug", required: true, inject_into_chunk: true, description: "Ingest folder slug" },
  { key: "title", inject_into_chunk: true, description: "Desk document title" },
  { key: "risk_level", description: "conservative | balanced | aggressive" },
  { key: "market_condition", description: "Outlook / regime (from ingest metadata)" },
  { key: "strategy_type", description: "Strategy type or pdf_ingest" },
  { key: "tags", description: "Comma-separated tags — update via admin metadata + re-sync" },
  { key: "complexity", description: "core | advanced" },
  { key: "underlying_type", description: "stock | index" },
  { key: "chunk_file", description: "Markdown chunk filename in repo" },
  { key: "last_updated", description: "ISO timestamp of last xAI sync" }
];

export function chunkMarkdownFilename(slug: string, index: number, total: number): string {
  if (total <= 1) {
    return `${slug}.md`;
  }
  return `${slug}-part-${String(index).padStart(3, "0")}.md`;
}

async function runPythonPdfIngest(pdfPath: string, maxChunkChars = 12_000): Promise<PythonIngestResult> {
  const scriptPath = join(process.cwd(), "services", "pdf-ingest", "ingest_pdf.py");
  const py =
    process.env.PDF_INGEST_PYTHON?.trim() ||
    process.env.PYTHON_BIN?.trim() ||
    "python3";

  return new Promise((resolve, reject) => {
    const child = spawn(py, [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        let message = stderr.trim() || `python exited ${code}`;
        try {
          const parsed = JSON.parse(stderr) as { error?: string };
          if (parsed.error) {
            message = parsed.error;
          }
        } catch {
          /* ignore */
        }
        reject(new Error(message));
        return;
      }
      try {
        resolve(parsePythonIngestStdout(stdout));
      } catch (err) {
        reject(new Error(`invalid python stdout: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
    child.stdin.write(JSON.stringify({ pdfPath, maxChunkChars }));
    child.stdin.end();
  });
}

export async function ingestPdfToRagCollection(
  repoRoot: string,
  input: PdfIngestCliInput
): Promise<{ manifest: PdfIngestManifest; outDir: string }> {
  const slug = input.slug.trim().toLowerCase();
  if (!PDF_INGEST_SLUG_RE.test(slug)) {
    throw new Error(`invalid slug: ${slug}`);
  }
  if (RAG_COLLECTION_RESERVED_DIRS.has(slug)) {
    throw new Error(`slug conflicts with reserved rag-collection segment: ${slug}`);
  }

  const pdfPath = input.file.trim();
  try {
    await access(pdfPath, fsConstants.R_OK);
  } catch {
    throw new Error(`PDF not readable: ${pdfPath}`);
  }

  const parsed = await runPythonPdfIngest(pdfPath);
  const riskLevel = normalizeRiskLevel(input.risk);
  const title = input.title.trim() || parsed.title.trim() || slug;
  const outlook = input.outlook.trim() || "Neutral";
  const tags = input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const segment = input.segment ?? "options-strategy-advanced";
  const outDir = pdfIngestFolderPath(repoRoot, slug);
  await mkdir(outDir, { recursive: true });

  const chunkTotal = parsed.chunks.length;
  const chunkFiles: string[] = [];
  for (const chunk of parsed.chunks) {
    const filename = chunkMarkdownFilename(slug, chunk.index, chunkTotal);
    const body = buildPdfIngestFrontmatter({
      slug,
      title,
      riskLevel,
      outlook,
      tags,
      chunkIndex: chunk.index,
      chunkTotal,
      pageCount: parsed.pageCount
    });
    const content = `${body}${chunk.markdown.trim()}\n`;
    await writeFile(join(outDir, filename), content, "utf8");
    chunkFiles.push(filename);
  }

  await copyFile(pdfPath, join(outDir, PDF_INGEST_SOURCE_COPY_NAME));

  const manifest: PdfIngestManifest = {
    version: 1,
    slug,
    title,
    riskLevel,
    outlook,
    tags,
    sourcePdf: PDF_INGEST_SOURCE_COPY_NAME,
    ingestedAt: new Date().toISOString(),
    chunkFiles,
    segment,
    pageCount: parsed.pageCount,
    mongoSeededAt: null,
    xaiSyncedAt: null
  };
  await writeFile(join(outDir, PDF_INGEST_MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifest, outDir };
}

async function readManifestFile(absPath: string): Promise<PdfIngestManifest | null> {
  try {
    const raw = await readFile(absPath, "utf8");
    const parsed = pdfIngestManifestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function firstChunkPreview(outDir: string, manifest: PdfIngestManifest): Promise<string> {
  const first = manifest.chunkFiles[0];
  if (!first) {
    return "";
  }
  try {
    const raw = await readFile(join(outDir, first), "utf8");
    const withoutFm = raw.replace(/^---[\s\S]*?---\s*/u, "").trim();
    return withoutFm.slice(0, 480);
  } catch {
    return "";
  }
}

export async function listPdfIngestFolders(repoRoot: string): Promise<PdfIngestFolderSummary[]> {
  const root = ragCollectionRoot(repoRoot);
  let entries: string[] = [];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }

  const rows: PdfIngestFolderSummary[] = [];
  for (const name of entries) {
    if (RAG_COLLECTION_RESERVED_DIRS.has(name) || name.startsWith(".")) {
      continue;
    }
    const outDir = join(root, name);
    const manifestPath = join(outDir, PDF_INGEST_MANIFEST_FILENAME);
    const manifest = await readManifestFile(manifestPath);
    if (!manifest) {
      continue;
    }
    rows.push({
      slug: manifest.slug,
      title: manifest.title,
      riskLevel: manifest.riskLevel,
      outlook: manifest.outlook,
      tags: manifest.tags,
      segment: manifest.segment,
      ingestedAt: manifest.ingestedAt,
      chunkCount: manifest.chunkFiles.length,
      firstChunkPreview: await firstChunkPreview(outDir, manifest),
      mongoSeededAt: manifest.mongoSeededAt ?? null,
      xaiSyncedAt: manifest.xaiSyncedAt ?? null,
      xaiCollectionId: manifest.xaiCollectionId ?? null,
      xaiCollectionName: manifest.xaiCollectionName ?? null
    });
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

export async function getPdfIngestFolderDetail(
  repoRoot: string,
  slug: string
): Promise<PdfIngestFolderDetail | null> {
  const outDir = pdfIngestFolderPath(repoRoot, slug);
  const manifest = await readManifestFile(join(outDir, PDF_INGEST_MANIFEST_FILENAME));
  if (!manifest) {
    return null;
  }
  const chunkFiles: Array<{ name: string; bytes: number }> = [];
  for (const name of manifest.chunkFiles) {
    try {
      const st = await stat(join(outDir, name));
      chunkFiles.push({ name, bytes: st.size });
    } catch {
      chunkFiles.push({ name, bytes: 0 });
    }
  }
  const summary = (await listPdfIngestFolders(repoRoot)).find((r) => r.slug === slug);
  return {
    ...(summary ?? {
      slug: manifest.slug,
      title: manifest.title,
      riskLevel: manifest.riskLevel,
      outlook: manifest.outlook,
      tags: manifest.tags,
      segment: manifest.segment,
      ingestedAt: manifest.ingestedAt,
      chunkCount: manifest.chunkFiles.length,
      firstChunkPreview: await firstChunkPreview(outDir, manifest),
      mongoSeededAt: manifest.mongoSeededAt ?? null,
      xaiSyncedAt: manifest.xaiSyncedAt ?? null,
      xaiCollectionId: manifest.xaiCollectionId ?? null,
      xaiCollectionName: manifest.xaiCollectionName ?? null
    }),
    manifest,
    chunkFiles
  };
}

async function findOrCreatePdfIngestXaiCollection(input: {
  slug: string;
  title: string;
  existingCollectionId?: string | null;
}): Promise<{ id: string; name: string; created: boolean }> {
  const collectionName = pdfIngestXaiCollectionName(input.slug);
  const storedId = input.existingCollectionId?.trim();
  if (storedId) {
    try {
      const keys = await getXaiCollectionFieldDefinitionKeys(storedId);
      await ensurePdfIngestXaiFieldDefinitions(storedId, keys);
      return { id: storedId, name: collectionName, created: false };
    } catch {
      /* fall through — recreate lookup by name */
    }
  }

  const listed = await listXaiCollections();
  const match = listed.find(
    (row) =>
      row.name?.toLowerCase() === collectionName.toLowerCase() || row.id === storedId
  );
  if (match?.id) {
    const keys = await getXaiCollectionFieldDefinitionKeys(match.id);
    await ensurePdfIngestXaiFieldDefinitions(match.id, keys);
    return { id: match.id, name: match.name ?? collectionName, created: false };
  }

  const created = await createXaiCollection(collectionName, {
    collectionDescription: `PDF ingest: ${input.title} (slug ${input.slug})`,
    fieldDefinitions: PDF_INGEST_XAI_FIELD_DEFINITIONS
  });
  return { id: created.id, name: created.name, created: true };
}

async function ensurePdfIngestXaiFieldDefinitions(
  collectionId: string,
  existingKeys: string[]
): Promise<string[]> {
  const have = new Set(existingKeys.map((k) => k.toLowerCase()));
  const missing = PDF_INGEST_XAI_FIELD_DEFINITIONS.filter(
    (row) => !have.has(row.key.toLowerCase())
  );
  if (missing.length > 0) {
    await addXaiCollectionFieldDefinitions(collectionId, missing);
  }
  return getXaiCollectionFieldDefinitionKeys(collectionId);
}

export function buildPdfIngestDocumentFields(input: {
  manifest: PdfIngestManifest;
  chunkFile: string;
  frontmatter: Record<string, unknown>;
}): Record<string, unknown> {
  const tags =
    input.manifest.tags.length > 0
      ? input.manifest.tags.join(",")
      : typeof input.frontmatter.tags === "string"
        ? input.frontmatter.tags
        : Array.isArray(input.frontmatter.tags)
          ? input.frontmatter.tags.map(String).join(",")
          : "";
  return {
    ...input.frontmatter,
    slug: input.manifest.slug,
    title: input.manifest.title,
    risk_level: input.manifest.riskLevel,
    market_condition: slugifyOutlook(input.manifest.outlook),
    strategy_type:
      typeof input.frontmatter.strategy_type === "string"
        ? input.frontmatter.strategy_type
        : "pdf_ingest",
    tags,
    complexity:
      typeof input.frontmatter.complexity === "string" ? input.frontmatter.complexity : "advanced",
    underlying_type:
      typeof input.frontmatter.underlying_type === "string"
        ? input.frontmatter.underlying_type
        : "stock",
    chunk_file: input.chunkFile,
    last_updated: new Date().toISOString()
  };
}

export async function updatePdfIngestManifestMetadata(
  repoRoot: string,
  slug: string,
  patch: Partial<Pick<PdfIngestManifest, "title" | "riskLevel" | "outlook" | "tags" | "segment">>
): Promise<PdfIngestManifest | null> {
  const outDir = pdfIngestFolderPath(repoRoot, slug);
  const manifestPath = join(outDir, PDF_INGEST_MANIFEST_FILENAME);
  const existing = await readManifestFile(manifestPath);
  if (!existing) {
    return null;
  }
  const next: PdfIngestManifest = {
    ...existing,
    ...patch,
    slug: existing.slug,
    version: 1
  };
  const parsed = pdfIngestManifestSchema.parse(next);
  await writeFile(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return parsed;
}

export async function seedPdfIngestSlugToMongo(slug: string): Promise<PdfIngestMongoSeedResult> {
  const repoRoot = process.cwd();
  const detail = await getPdfIngestFolderDetail(repoRoot, slug);
  if (!detail) {
    throw new Error(`ingest folder not found: ${slug}`);
  }
  const outDir = pdfIngestFolderPath(repoRoot, slug);
  const parts: string[] = [];
  for (const file of detail.manifest.chunkFiles) {
    parts.push(await readFile(join(outDir, file), "utf8"));
  }
  const description = parts.join("\n\n---\n\n");
  const db = await getDb();
  const col = db.collection("options_strategy");
  const now = new Date();
  await col.createIndex({ slug: 1 }, { name: "uniq_options_strategy_slug", unique: true });
  const res = await col.updateOne(
    { slug },
    {
      $set: {
        slug,
        name: detail.manifest.title,
        description,
        sourceRelPath: `${slug}/${detail.manifest.chunkFiles[0] ?? `${slug}.md`}`,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now, filters: null }
    },
    { upsert: true }
  );
  const manifestPath = join(outDir, PDF_INGEST_MANIFEST_FILENAME);
  const manifest = pdfIngestManifestSchema.parse({
    ...detail.manifest,
    mongoSeededAt: now.toISOString()
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    ok: true,
    slug,
    upserted: res.upsertedCount > 0 || res.modifiedCount > 0,
    mongoCollection: "options_strategy",
    title: detail.manifest.title,
    chunkCount: detail.manifest.chunkFiles.length,
    seededAt: now.toISOString()
  };
}

export async function syncPdfIngestSlugToXai(slug: string): Promise<PdfIngestXaiSeedResult> {
  const repoRoot = process.cwd();
  const detail = await getPdfIngestFolderDetail(repoRoot, slug);
  if (!detail) {
    throw new Error(`ingest folder not found: ${slug}`);
  }
  const outDir = pdfIngestFolderPath(repoRoot, slug);
  const errors: Array<{ source: string; message: string }> = [];
  const segment = detail.manifest.segment;
  const seededAt = new Date().toISOString();

  const collection = await findOrCreatePdfIngestXaiCollection({
    slug,
    title: detail.manifest.title,
    existingCollectionId: detail.manifest.xaiCollectionId
  });
  const collectionId = collection.id;
  const fieldDefinitionKeys = await ensurePdfIngestXaiFieldDefinitions(
    collectionId,
    await getXaiCollectionFieldDefinitionKeys(collectionId)
  );
  const allowedFieldKeys = new Set(fieldDefinitionKeys);

  let documentsByLogicalName = new Map<string, string>();
  try {
    const listed = await listXaiCollectionDocuments(collectionId);
    documentsByLogicalName = indexFinanceKbRemoteDocumentsByLogicalName(listed);
  } catch (error) {
    throw new Error(
      `listXaiCollectionDocuments failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let filesUploaded = 0;
  let documentsCreated = 0;
  let documentsUpdated = 0;

  for (const fileName of detail.manifest.chunkFiles) {
    try {
      const bytes = await readFile(join(outDir, fileName));
      const text = bytes.toString("utf8");
      const fm = extractFinanceKbFrontmatterMetadata(text, { kbSegment: segment });
      const metadata = buildPdfIngestDocumentFields({
        manifest: detail.manifest,
        chunkFile: fileName,
        frontmatter: fm
      });
      const logicalFilename = fileName;
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
      await addFileToXaiCollection({
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
    } catch (error) {
      errors.push({
        source: fileName,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const manifestPath = join(outDir, PDF_INGEST_MANIFEST_FILENAME);
  const manifest = pdfIngestManifestSchema.parse({
    ...detail.manifest,
    xaiSyncedAt: seededAt,
    xaiCollectionId: collectionId,
    xaiCollectionName: collection.name
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    ok: errors.length === 0,
    collectionId,
    collectionName: collection.name,
    collectionCreated: collection.created,
    fieldDefinitionKeys,
    filesUploaded,
    documentsCreated,
    documentsUpdated,
    errors,
    seededAt
  };
}

export async function writePdfIngestAudit(input: {
  action: string;
  actor: { userId: string; email?: string; username?: string };
  slug: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await createAuditEvent({
    entityType: "system",
    entityId: `pdf-ingest:${input.slug}`,
    action: input.action,
    actor: input.actor,
    details: input.details ?? {}
  }).catch((error) => {
    console.error("[pdf-ingest] audit write failed", { error: String(error) });
  });
}

export function safeDownloadBasename(name: string): string | null {
  const base = basename(name);
  if (!base || base.includes("..") || base.includes("/") || base.includes("\\")) {
    return null;
  }
  return base;
}
