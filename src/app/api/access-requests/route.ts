import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { buildAccessRequestNotification, sendSlackNotification } from "@/lib/slack";
import { createAuditEvent } from "@/modules/audit/repository";
import {
  createAccessRequest,
  getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";

const selfRequestSchema = z.object({
  requestedRole: z.enum(["advisor", "operator", "viewer"]).optional().default("viewer"),
  reason: z.string().min(3).max(500)
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = selfRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId: session.userId,
    requestedRole: parsed.data.requestedRole,
    tenantId: session.tenantId
  });

  if (existingPending) {
    return NextResponse.json(
      {
        error: "You already have a pending access request.",
        data: {
          requestedRole: existingPending.requestedRole,
          status: existingPending.status,
          requestedAt: existingPending.requestedAt.toISOString()
        }
      },
      { status: 409 }
    );
  }

  const created = await createAccessRequest({
    tenantId: session.tenantId,
    userId: session.userId,
    requestedRole: parsed.data.requestedRole,
    reason: parsed.data.reason
  });

  if (created._id) {
    await createAuditEvent({
      entityType: "access_request",
      entityId: created._id.toHexString(),
      action: "self_requested",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        requestedRole: created.requestedRole,
        reason: created.reason
      }
    });
  }

  void sendSlackNotification(
    buildAccessRequestNotification({
      email: session.email,
      username: session.username,
      requestedRole: parsed.data.requestedRole,
      reason: parsed.data.reason
    })
  );

  return NextResponse.json(
    {
      ok: true,
      data: {
        requestedRole: created.requestedRole,
        status: created.status,
        requestedAt: created.requestedAt.toISOString()
      }
    },
    { status: 201 }
  );
}
