import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
    getPdfIngestFolderDetail,
    PDF_INGEST_SLUG_RE,
    updatePdfIngestManifestMetadata,
    writePdfIngestAudit
} from "@/modules/rag/pdf-ingest";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(256).optional(),
  riskLevel: z.enum(["conservative", "balanced", "aggressive"]).optional(),
  outlook: z.string().trim().min(1).max(128).optional(),
  tags: z.array(z.string().min(1).max(64)).max(32).optional(),
  segment: z.enum(["options-strategy-advanced", "options-strategy-core", "finance-core"]).optional()
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { slug } = await context.params;
  if (!PDF_INGEST_SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const detail = await getPdfIngestFolderDetail(process.cwd(), slug);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: detail });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { slug } = await context.params;
  if (!PDF_INGEST_SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updatePdfIngestManifestMetadata(process.cwd(), slug, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await writePdfIngestAudit({
    action: "global_admin:pdf-ingest-metadata",
    slug,
    actor: { userId: session.userId, email: session.email, username: session.username },
    details: parsed.data
  });

  const detail = await getPdfIngestFolderDetail(process.cwd(), slug);
  return NextResponse.json({ data: detail });
}
