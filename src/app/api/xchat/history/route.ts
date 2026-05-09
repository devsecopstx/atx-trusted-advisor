import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAndAppTenantObjectId } from "@/lib/require-app-user-tenant";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { logXchatHistoryListDebug } from "@/lib/xchat-debug";
import { runWithXchatTenantDebugAsync } from "@/lib/xchat-debug-context";
import { isTenantXchatDebugPreferenceEnabled } from "@/modules/identity/tenant-branding-preferences";
import {
    deleteXChatHistoryByUser,
    listXChatHistoryByUser
} from "@/modules/xchat/repository";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  cursorId: z.string().optional(),
  threadId: z.string().trim().min(1).max(128).optional()
});

export async function GET(request: Request) {
  const auth = await requireSessionAndAppTenantObjectId();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { session, tenantOid } = auth;

  const tenantForDebug = await getTenantByHexIdCached(session.tenantId);
  const tenantDebugFlag = isTenantXchatDebugPreferenceEnabled(tenantForDebug);

  return runWithXchatTenantDebugAsync(tenantDebugFlag, async () => {
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    cursorId: url.searchParams.get("cursorId") ?? undefined,
    threadId: url.searchParams.get("threadId") ?? undefined
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

  const take = parsed.data.limit;
  const rows = await listXChatHistoryByUser({
    userId,
    tenantId: tenantOid,
    limit: take + 1,
    threadId: parsed.data.threadId,
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
  });
}

export async function DELETE(request: Request) {
  const auth = await requireSessionAndAppTenantObjectId();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { session, tenantOid } = auth;

  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user id" }, { status: 400 });
  }

  const userId = new ObjectId(session.userId);
  const url = new URL(request.url);
  const parsedThreadId = url.searchParams.get("threadId") ?? undefined;

  const deletedCount = await deleteXChatHistoryByUser({
    userId,
    tenantId: tenantOid,
    threadId: parsedThreadId
  });

  return NextResponse.json({
    data: {
      ok: true,
      deletedCount
    }
  });
}
