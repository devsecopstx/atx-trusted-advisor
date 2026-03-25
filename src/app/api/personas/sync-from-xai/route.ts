import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { syncPersonasFromXaiCollection } from "@/modules/xchat/persona-sync-from-xai";

const bodySchema = z.object({
  collectionDisplayName: z.string().trim().min(1).max(200).optional(),
  mode: z.enum(["merge", "replace"]).optional()
});

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const data = await syncPersonasFromXaiCollection({
      actorUserId: session.userId,
      collectionDisplayName: parsed.data.collectionDisplayName,
      mode: parsed.data.mode
    });
    return NextResponse.json({ data });
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "XAI_COLLECTION_NOT_FOUND" || msg.includes("No xAI collection named")) {
      return NextResponse.json({ error: msg, code: "XAI_COLLECTION_NOT_FOUND" }, { status: 404 });
    }
    if (msg.includes("XAI_MANAGEMENT_API_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.warn("[personas/sync-from-xai]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
