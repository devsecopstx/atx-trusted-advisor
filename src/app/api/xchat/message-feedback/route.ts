import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { updateXchatLogUserFeedback } from "@/modules/xchat/repository";

const bodySchema = z.object({
  logId: z.string().min(1).max(32),
  vote: z.enum(["up", "down"])
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isGlobalAdmin(session.roles) && !canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (!ObjectId.isValid(parsed.data.logId)) {
    return NextResponse.json({ error: "Invalid logId" }, { status: 400 });
  }

  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  const updated = await updateXchatLogUserFeedback({
    logId: new ObjectId(parsed.data.logId),
    userId: new ObjectId(session.userId),
    tenantId,
    vote: parsed.data.vote
  });
  if (!updated) {
    return NextResponse.json({ error: "Log not found", code: "log_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true as const });
}
