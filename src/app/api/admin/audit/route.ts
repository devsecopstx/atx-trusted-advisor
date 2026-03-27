import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { listAuditEvents } from "@/modules/audit/repository";
import type { AuditEvent } from "@/modules/audit/types";

const auditQuerySchema = z.object({
  entityType: z
    .enum([
      "xpersona",
      "access_request",
      "core_user",
      "deploy_note_config",
      "xchat_session",
      "core_scanner"
    ])
    .optional(),
  entityId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  actor: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const parsed = auditQuerySchema.safeParse({
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const events = await listAuditEvents({
    limit: parsed.data.limit,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    action: parsed.data.action,
    actor: parsed.data.actor,
    fromDate: parsed.data.from ? new Date(parsed.data.from) : undefined,
    toDate: parsed.data.to ? new Date(parsed.data.to) : undefined
  });

  return NextResponse.json({ data: events.map(serializeAuditEvent) });
}

function serializeAuditEvent(event: AuditEvent) {
  return {
    _id: event._id?.toHexString(),
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    actor: event.actor,
    details: event.details,
    createdAt: event.createdAt.toISOString()
  };
}
