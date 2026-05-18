import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
    PDF_INGEST_SLUG_RE,
    seedPdfIngestSlugToMongo,
    syncPdfIngestSlugToXai,
    writePdfIngestAudit
} from "@/modules/rag/pdf-ingest";

const bodySchema = z.object({
  mongo: z.boolean().optional(),
  xai: z.boolean().optional()
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { slug } = await context.params;
  if (!PDF_INGEST_SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const doMongo = parsed.data.mongo !== false;
  const doXai = parsed.data.xai !== false;
  const actor = { userId: session.userId, email: session.email, username: session.username };

  const result: {
    mongo?: { slug: string; upserted: boolean };
    xai?: { collectionId: string; changeCount: number; errorCount: number };
  } = {};

  try {
    if (doMongo) {
      result.mongo = await seedPdfIngestSlugToMongo(slug);
    }
    if (doXai) {
      const xai = await syncPdfIngestSlugToXai(slug);
      result.xai = {
        collectionId: xai.collectionId,
        changeCount: xai.changes.length,
        errorCount: xai.errors.length
      };
      if (xai.errors.length > 0) {
        result.xai.errorCount = xai.errors.length;
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }

  await writePdfIngestAudit({
    action: "global_admin:pdf-ingest-seed",
    slug,
    actor,
    details: result
  });

  return NextResponse.json({ data: result });
}
