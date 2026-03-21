import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { pollRagFileReadiness } from "@/modules/xchat/rag-file-readiness";

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, context: RouteParams) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { fileId } = await context.params;
  if (!ObjectId.isValid(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const readiness = await pollRagFileReadiness(new ObjectId(fileId));
  if (!readiness) {
    return NextResponse.json({ error: "RAG file not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: readiness
  });
}
