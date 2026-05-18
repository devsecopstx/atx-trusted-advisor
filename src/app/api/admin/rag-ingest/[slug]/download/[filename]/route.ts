import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
    getPdfIngestFolderDetail,
    PDF_INGEST_MANIFEST_FILENAME,
    PDF_INGEST_SLUG_RE,
    PDF_INGEST_SOURCE_COPY_NAME,
    pdfIngestFolderPath,
    safeDownloadBasename
} from "@/modules/rag/pdf-ingest";

type RouteContext = { params: Promise<{ slug: string; filename: string }> };

const ALLOWED_DOWNLOADS = new Set([
  PDF_INGEST_MANIFEST_FILENAME,
  PDF_INGEST_SOURCE_COPY_NAME
]);

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { slug, filename: filenameParam } = await context.params;
  if (!PDF_INGEST_SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const filename = safeDownloadBasename(filenameParam);
  if (!filename) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const detail = await getPdfIngestFolderDetail(process.cwd(), slug);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isMarkdown = filename.endsWith(".md");
  if (isMarkdown && !detail.manifest.chunkFiles.includes(filename)) {
    return NextResponse.json({ error: "File not allowed" }, { status: 400 });
  }
  if (!isMarkdown && !ALLOWED_DOWNLOADS.has(filename)) {
    return NextResponse.json({ error: "File not allowed" }, { status: 400 });
  }

  const abs = join(pdfIngestFolderPath(process.cwd(), slug), filename);
  try {
    const bytes = await readFile(abs);
    const contentType = filename.endsWith(".pdf")
      ? "application/pdf"
      : filename.endsWith(".json")
        ? "application/json"
        : "text/markdown; charset=utf-8";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
