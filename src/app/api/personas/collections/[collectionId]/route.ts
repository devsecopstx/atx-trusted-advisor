import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getXaiCollectionById, XaiCollectionNotFoundError } from "@/lib/xai";

type RouteParams = { params: Promise<{ collectionId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { collectionId } = await params;
  const normalized = collectionId?.trim();
  if (!normalized) {
    return NextResponse.json({ error: "Collection ID required" }, { status: 400 });
  }

  try {
    const stats = await getXaiCollectionById(normalized);
    return NextResponse.json({
      data: {
        id: stats.id,
        name: stats.name,
        stats: {
          documentCount: stats.documentCount ?? null,
          chunkCount: stats.chunkCount ?? null,
          fileCount: stats.fileCount ?? null,
          indexStatus: stats.indexStatus ?? null,
          createdAt: stats.createdAt ?? null,
          updatedAt: stats.updatedAt ?? null
        }
      }
    });
  } catch (error) {
    if (error instanceof XaiCollectionNotFoundError) {
      return NextResponse.json({ error: error.message, code: "collection_not_found" }, { status: 404 });
    }
    console.error("xpersona collection stats fetch failed", {
      collectionId: normalized,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json(
      { error: "Failed to load collection stats" },
      { status: 502 }
    );
  }
}
