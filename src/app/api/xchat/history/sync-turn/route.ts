import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { getXchatSessionLogByIdForUser } from "@/modules/xchat/repository";
import { syncXchatSessionLogToUserCollection } from "@/modules/xchat/user-history-agent";

const bodySchema = z.object({
  logId: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!ObjectId.isValid(parsed.data.logId)) {
    return NextResponse.json({ error: "Invalid logId" }, { status: 400 });
  }

  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  const logId = new ObjectId(parsed.data.logId);

  const log = await getXchatSessionLogByIdForUser({
    logId,
    userId,
    tenantId
  });

  if (!log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  const result = await syncXchatSessionLogToUserCollection(log);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ data: { ok: true } });
}
