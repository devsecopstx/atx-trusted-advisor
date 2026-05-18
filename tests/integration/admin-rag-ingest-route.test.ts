import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const ingestMocks = vi.hoisted(() => ({
  listPdfIngestFolders: vi.fn(),
  getPdfIngestFolderDetail: vi.fn(),
  seedPdfIngestSlugToMongo: vi.fn(),
  syncPdfIngestSlugToXai: vi.fn(),
  writePdfIngestAudit: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/rag/pdf-ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/rag/pdf-ingest")>();
  return {
    ...actual,
    listPdfIngestFolders: ingestMocks.listPdfIngestFolders,
    getPdfIngestFolderDetail: ingestMocks.getPdfIngestFolderDetail,
    seedPdfIngestSlugToMongo: ingestMocks.seedPdfIngestSlugToMongo,
    syncPdfIngestSlugToXai: ingestMocks.syncPdfIngestSlugToXai,
    writePdfIngestAudit: ingestMocks.writePdfIngestAudit
  };
});

import { POST as seedSlug } from "@/app/api/admin/rag-ingest/[slug]/seed/route";
import { GET as listIngest } from "@/app/api/admin/rag-ingest/route";

const slug = "options-strategy-risk";

describe("/api/admin/rag-ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    ingestMocks.listPdfIngestFolders.mockResolvedValue([
      {
        slug,
        title: "Options strategy risk",
        riskLevel: "balanced",
        outlook: "Neutral",
        tags: ["options", "strategy", "risk"],
        segment: "options-strategy-advanced",
        ingestedAt: "2026-05-18T12:00:00.000Z",
        chunkCount: 38,
        firstChunkPreview: "# Preview",
        mongoSeededAt: "2026-05-18T13:00:00.000Z",
        xaiSyncedAt: "2026-05-18T13:05:00.000Z",
        xaiCollectionId: "collection_test",
        xaiCollectionName: "xfinance-pdf-ingest-options-strategy-risk"
      }
    ]);
    ingestMocks.seedPdfIngestSlugToMongo.mockResolvedValue({
      ok: true,
      slug,
      upserted: true,
      mongoCollection: "options_strategy",
      title: "Options strategy risk",
      chunkCount: 38,
      seededAt: "2026-05-18T14:00:00.000Z"
    });
    ingestMocks.syncPdfIngestSlugToXai.mockResolvedValue({
      ok: true,
      collectionId: "collection_test",
      collectionName: "xfinance-pdf-ingest-options-strategy-risk",
      collectionCreated: false,
      fieldDefinitionKeys: ["slug", "title", "tags", "risk_level"],
      filesUploaded: 38,
      documentsCreated: 0,
      documentsUpdated: 38,
      errors: [],
      seededAt: "2026-05-18T14:01:00.000Z"
    });
    ingestMocks.writePdfIngestAudit.mockResolvedValue(undefined);
  });

  it("GET list returns ingest folder summaries", async () => {
    const res = await listIngest();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { slug: string; xaiCollectionName: string | null }[] };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.slug).toBe(slug);
    expect(json.data[0]?.xaiCollectionName).toContain("xfinance-pdf-ingest-");
  });

  it("POST seed returns separate mongo and xai payloads", async () => {
    const res = await seedSlug(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mongo: true, xai: true })
      }),
      { params: Promise.resolve({ slug }) }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        mongo?: { mongoCollection: string; chunkCount: number };
        xai?: { collectionName: string; filesUploaded: number; fieldDefinitionKeys: string[] };
      };
    };
    expect(json.data.mongo?.mongoCollection).toBe("options_strategy");
    expect(json.data.mongo?.chunkCount).toBe(38);
    expect(json.data.xai?.collectionName).toBe("xfinance-pdf-ingest-options-strategy-risk");
    expect(json.data.xai?.filesUploaded).toBe(38);
    expect(json.data.xai?.fieldDefinitionKeys).toContain("tags");
    expect(ingestMocks.writePdfIngestAudit).toHaveBeenCalled();
  });

  it("POST seed rejects non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await seedSlug(
      new Request("http://test", { method: "POST", body: "{}" }),
      { params: Promise.resolve({ slug }) }
    );
    expect(res.status).toBe(403);
  });
});
