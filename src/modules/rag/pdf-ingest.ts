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
    getXaiCollectionFieldDefinitionKeys,
    listXaiCollectionDocuments,
    removeDocumentFromXaiCollection,
    uploadFileToXai
} from "@/lib/xai";
import { getXaiFinanceCollectionId } from "@/lib/xai-finance-collection";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    extractFinanceKbFrontmatterMetadata,
    financeKbLogicalUploadName,
    financeKbMetadataToXaiFields,
    indexFinanceKbRemoteDocumentsByLogicalName,
    type FinanceKbSyncChange
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
  xaiSyncedAt: z.string().datetime().nullable().optional()
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

export function chunkMarkdownFilename(slug: string, index: number, total: number): string {
  if (total <= 1) {
    return `${slug}.md`;
  }
  return `${slug}-part-${String(index).padStart(3, "0")}.md`;
}

async function runPythonPdfIngest(pdfPath: string, maxChunkChars = 12_000): Promise<PythonIngestResult> {
  const scriptPath = join(process.cwd(), "services", "pdf-ingest", "ingest_pdf.py");
  const py = process.env.PDF_INGEST_PYTHON?.trim() || "python3";

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
        resolve(JSON.parse(stdout) as PythonIngestResult);
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
      xaiSyncedAt: manifest.xaiSyncedAt ?? null
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
      xaiSyncedAt: manifest.xaiSyncedAt ?? null
    }),
    manifest,
    chunkFiles
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

export async function seedPdfIngestSlugToMongo(slug: string): Promise<{ slug: string; upserted: boolean }> {
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
  return { slug, upserted: res.upsertedCount > 0 || res.modifiedCount > 0 };
}

export async function syncPdfIngestSlugToXai(slug: string): Promise<{
  collectionId: string;
  changes: FinanceKbSyncChange[];
  errors: Array<{ source: string; message: string }>;
}> {
  const repoRoot = process.cwd();
  const detail = await getPdfIngestFolderDetail(repoRoot, slug);
  if (!detail) {
    throw new Error(`ingest folder not found: ${slug}`);
  }
  const outDir = pdfIngestFolderPath(repoRoot, slug);
  const collectionId = getXaiFinanceCollectionId();
  const errors: Array<{ source: string; message: string }> = [];
  const changes: FinanceKbSyncChange[] = [];
  const segment = detail.manifest.segment;

  let documentsByLogicalName = new Map<string, string>();
  try {
    const listed = await listXaiCollectionDocuments(collectionId);
    documentsByLogicalName = indexFinanceKbRemoteDocumentsByLogicalName(listed);
  } catch (error) {
    throw new Error(
      `listXaiCollectionDocuments failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let collectionFieldDefinitionKeys: string[] = [];
  try {
    collectionFieldDefinitionKeys = await getXaiCollectionFieldDefinitionKeys(collectionId);
  } catch {
    /* continue without native fields */
  }
  const allowedFieldKeys = new Set(collectionFieldDefinitionKeys);

  for (const fileName of detail.manifest.chunkFiles) {
    const rel = `${slug}/${fileName}`;
    try {
      const bytes = await readFile(join(outDir, fileName));
      const text = bytes.toString("utf8");
      const fm = extractFinanceKbFrontmatterMetadata(text, { kbSegment: segment });
      const metadata: Record<string, unknown> = {
        source: segment,
        slug: detail.manifest.slug,
        category: "pdf_ingest",
        ingest_slug: detail.manifest.slug,
        last_updated: new Date().toISOString(),
        ...fm
      };
      const logicalFilename = financeKbLogicalUploadName(segment, rel);
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
      changes.push({
        source: segment,
        relativePath: rel,
        logicalName: logicalFilename,
        action: previousFileId ? "updated" : "created",
        ...(previousFileId ? { previousFileId } : {}),
        newFileId: uploaded.fileId,
        fieldKeysSent: Object.keys(fields),
        alreadyLinked: link.alreadyLinked
      });
    } catch (error) {
      errors.push({
        source: rel,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const manifestPath = join(outDir, PDF_INGEST_MANIFEST_FILENAME);
  const manifest = pdfIngestManifestSchema.parse({
    ...detail.manifest,
    xaiSyncedAt: new Date().toISOString()
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { collectionId, changes, errors };
}

export async function resolvePdfIngestKbFiles(repoRoot: string): Promise<
  Array<{ abs: string; rel: string; source: PdfIngestKbSegment }>
> {
  const summaries = await listPdfIngestFolders(repoRoot);
  const out: Array<{ abs: string; rel: string; source: PdfIngestKbSegment }> = [];
  for (const row of summaries) {
    const outDir = pdfIngestFolderPath(repoRoot, row.slug);
    const detail = await getPdfIngestFolderDetail(repoRoot, row.slug);
    if (!detail) {
      continue;
    }
    for (const file of detail.manifest.chunkFiles) {
      out.push({
        abs: join(outDir, file),
        rel: `${row.slug}/${file}`,
        source: detail.manifest.segment
      });
    }
  }
  return out;
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
