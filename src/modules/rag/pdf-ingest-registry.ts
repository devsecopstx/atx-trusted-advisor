import { getDb } from "@/lib/mongodb";

import type { PdfIngestKbSegment, PdfIngestManifest } from "@/modules/rag/pdf-ingest";

const COLLECTION = "pdf_ingest_registry";

export type PdfIngestRegistryRow = {
  slug: string;
  title?: string;
  riskLevel?: PdfIngestManifest["riskLevel"];
  outlook?: string;
  tags?: string[];
  segment?: PdfIngestKbSegment;
  mongoSeededAt?: string | null;
  xaiSyncedAt?: string | null;
  xaiCollectionId?: string | null;
  xaiCollectionName?: string | null;
  updatedAt: Date;
};

export function applyRegistryToManifest(
  manifest: PdfIngestManifest,
  row: PdfIngestRegistryRow | null
): PdfIngestManifest {
  if (!row) {
    return manifest;
  }
  return {
    ...manifest,
    ...(row.title != null ? { title: row.title } : {}),
    ...(row.riskLevel != null ? { riskLevel: row.riskLevel } : {}),
    ...(row.outlook != null ? { outlook: row.outlook } : {}),
    ...(row.tags != null ? { tags: row.tags } : {}),
    ...(row.segment != null ? { segment: row.segment } : {}),
    mongoSeededAt: row.mongoSeededAt !== undefined ? row.mongoSeededAt : (manifest.mongoSeededAt ?? null),
    xaiSyncedAt: row.xaiSyncedAt !== undefined ? row.xaiSyncedAt : (manifest.xaiSyncedAt ?? null),
    xaiCollectionId:
      row.xaiCollectionId !== undefined ? row.xaiCollectionId : (manifest.xaiCollectionId ?? null),
    xaiCollectionName:
      row.xaiCollectionName !== undefined ? row.xaiCollectionName : (manifest.xaiCollectionName ?? null)
  };
}

export async function getPdfIngestRegistry(slug: string): Promise<PdfIngestRegistryRow | null> {
  const db = await getDb();
  const doc = await db.collection<PdfIngestRegistryRow>(COLLECTION).findOne({ slug });
  return doc;
}

export async function upsertPdfIngestRegistry(
  slug: string,
  patch: Partial<Omit<PdfIngestRegistryRow, "slug" | "updatedAt">>
): Promise<PdfIngestRegistryRow> {
  const db = await getDb();
  const col = db.collection<PdfIngestRegistryRow>(COLLECTION);
  await col.createIndex({ slug: 1 }, { name: "uniq_pdf_ingest_registry_slug", unique: true });
  const now = new Date();
  const $set: Partial<PdfIngestRegistryRow> = { updatedAt: now };
  if (patch.title !== undefined) {
    $set.title = patch.title;
  }
  if (patch.riskLevel !== undefined) {
    $set.riskLevel = patch.riskLevel;
  }
  if (patch.outlook !== undefined) {
    $set.outlook = patch.outlook;
  }
  if (patch.tags !== undefined) {
    $set.tags = patch.tags;
  }
  if (patch.segment !== undefined) {
    $set.segment = patch.segment;
  }
  if (patch.mongoSeededAt !== undefined) {
    $set.mongoSeededAt = patch.mongoSeededAt;
  }
  if (patch.xaiSyncedAt !== undefined) {
    $set.xaiSyncedAt = patch.xaiSyncedAt;
  }
  if (patch.xaiCollectionId !== undefined) {
    $set.xaiCollectionId = patch.xaiCollectionId;
  }
  if (patch.xaiCollectionName !== undefined) {
    $set.xaiCollectionName = patch.xaiCollectionName;
  }
  await col.updateOne({ slug }, { $set, $setOnInsert: { slug } }, { upsert: true });
  const row = await col.findOne({ slug });
  if (!row) {
    throw new Error(`pdf_ingest_registry upsert failed for ${slug}`);
  }
  return row;
}
