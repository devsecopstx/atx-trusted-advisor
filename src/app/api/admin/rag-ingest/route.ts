import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getPdfIngestCapabilities, listPdfIngestFolders } from "@/modules/rag/pdf-ingest";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const rows = await listPdfIngestFolders(process.cwd());
  return NextResponse.json({ data: rows, capabilities: getPdfIngestCapabilities() });
}
