import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getXchatTokenUsageStatsForUser } from "@/modules/xchat/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }

  const tenantId =
    session.tenantId && ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;

  const stats = await getXchatTokenUsageStatsForUser({
    userId: new ObjectId(session.userId),
    tenantId
  });

  return NextResponse.json(
    { data: stats },
    {
      headers: {
        "Cache-Control": "private, max-age=55"
      }
    }
  );
}
