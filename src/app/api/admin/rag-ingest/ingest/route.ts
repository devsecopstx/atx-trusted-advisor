import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
    ingestPdfToRagCollection,
    normalizeRiskLevel,
    PDF_INGEST_SLUG_RE,
    writePdfIngestAudit,
    type PdfIngestKbSegment
} from "@/modules/rag/pdf-ingest";

const ingestFormSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(PDF_INGEST_SLUG_RE),
  title: z.string().trim().min(1).max(256),
  risk: z.string().trim().min(1).max(64),
  outlook: z.string().trim().min(1).max(128),
  tags: z.string().trim().max(512).optional(),
  segment: z.enum(["options-strategy-advanced", "options-strategy-core", "finance-core"]).optional()
});

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const parsed = ingestFormSchema.safeParse({
    slug: String(form.get("slug") ?? ""),
    title: String(form.get("title") ?? ""),
    risk: String(form.get("risk") ?? "Balanced"),
    outlook: String(form.get("outlook") ?? "Neutral"),
    tags: form.get("tags") != null ? String(form.get("tags")) : undefined,
    segment: form.get("segment") != null ? String(form.get("segment")) : undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form fields", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const tmpDir = join(tmpdir(), `atx-pdf-ingest-${randomBytes(8).toString("hex")}`);
  await mkdir(tmpDir, { recursive: true });
  const tmpPdf = join(tmpDir, "upload.pdf");
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPdf, bytes);

  try {
    const { manifest } = await ingestPdfToRagCollection(process.cwd(), {
      file: tmpPdf,
      slug: parsed.data.slug,
      title: parsed.data.title,
      risk: parsed.data.risk,
      outlook: parsed.data.outlook,
      tags,
      ...(parsed.data.segment ? { segment: parsed.data.segment as PdfIngestKbSegment } : {})
    });

    await writePdfIngestAudit({
      action: "global_admin:pdf-ingest",
      slug: manifest.slug,
      actor: { userId: session.userId, email: session.email, username: session.username },
      details: {
        title: manifest.title,
        riskLevel: normalizeRiskLevel(parsed.data.risk),
        chunkCount: manifest.chunkFiles.length,
        segment: manifest.segment
      }
    });

    return NextResponse.json({ data: manifest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
