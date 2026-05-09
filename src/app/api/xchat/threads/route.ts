import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAndAppTenantObjectId } from "@/lib/require-app-user-tenant";
import { listXChatThreadsByUser } from "@/modules/xchat/repository";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

export async function GET(request: Request) {
  const auth = await requireSessionAndAppTenantObjectId();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { session, tenantOid } = auth;
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid threads query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const rows = await listXChatThreadsByUser({
    userId: new ObjectId(session.userId),
    tenantId: tenantOid,
    limit: parsed.data.limit
  });

  return NextResponse.json({
    data: {
      items: rows.map((row) => ({
        ...row,
        lastMessageAt: row.lastMessageAt.toISOString()
      }))
    }
  });
}
