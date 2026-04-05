import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import {
    getXchatUserPreferences,
    upsertXchatUserPreferences
} from "@/modules/xchat/user-preferences-repository";

const updateSchema = z.object({
  keepLastTenMessages: z.boolean()
});

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }
  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  const row = await getXchatUserPreferences({ userId, tenantId });
  return NextResponse.json({
    data: {
      keepLastTenMessages: row?.keepLastTenMessages === true,
      consentedAt: row?.consentedAt?.toISOString() ?? null
    }
  });
}

export async function PUT(request: Request) {
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
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  const row = await upsertXchatUserPreferences({
    userId,
    tenantId,
    keepLastTenMessages: parsed.data.keepLastTenMessages
  });
  return NextResponse.json({
    data: {
      keepLastTenMessages: row.keepLastTenMessages,
      consentedAt: row.consentedAt?.toISOString() ?? null
    }
  });
}
