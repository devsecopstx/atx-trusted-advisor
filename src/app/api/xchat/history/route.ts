import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { logXchatHistoryListDebug } from "@/lib/xchat-debug";
import { listXChatHistoryByUser } from "@/modules/xchat/repository";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  cursorId: z.string().optional()
});

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    cursorId: url.searchParams.get("cursorId") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid history query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const cursorIdRaw = parsed.data.cursorId?.trim();
  if (cursorIdRaw && !ObjectId.isValid(cursorIdRaw)) {
    return NextResponse.json(
      { error: "Invalid history query", details: { formErrors: [], fieldErrors: { cursorId: ["Invalid ObjectId"] } } },
      { status: 400 }
    );
  }

  const userId = new ObjectId(session.userId);
  const tenantId = ObjectId.isValid(session.tenantId)
    ? new ObjectId(session.tenantId)
    : null;

  const take = parsed.data.limit;
  const rows = await listXChatHistoryByUser({
    userId,
    tenantId,
    limit: take + 1,
    before: parsed.data.cursor ? new Date(parsed.data.cursor) : undefined,
    beforeId: cursorIdRaw ? new ObjectId(cursorIdRaw) : undefined
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null;
  const nextCursorId = hasMore ? items[items.length - 1]?.id ?? null : null;
  logXchatHistoryListDebug({
    userId: session.userId,
    email: session.email,
    limit: take,
    itemCount: items.length,
    hasMore,
    nextCursor
  });

  return NextResponse.json({
    data: {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString()
      })),
      nextCursor,
      nextCursorId,
      hasMore
    }
  });
}
