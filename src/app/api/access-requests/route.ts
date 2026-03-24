import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { buildAccessRequestNotification, sendSlackNotification } from "@/lib/slack";
import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    AccessRequestDuplicatePendingError,
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";

const selfRequestSchema = z.object({
  requestedRole: z.enum(["advisor", "operator", "viewer"]).optional().default("viewer"),
  reason: z.string().min(3).max(500)
});

/** Signed-in self-service: prefer this URL for viewer/operator/advisor requests (`global_admin` is admin-only). */
export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

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
        error: "You already have an open access request for this role.",
        data: {
          requestedRole: existingPending.requestedRole,
          status: existingPending.status,
          requestedAt: existingPending.requestedAt.toISOString()
        }
      },
      { status: 409 }
    );
  }

  let created;
  try {
    created = await createAccessRequest({
      tenantId: session.tenantId,
      userId: session.userId,
      contactEmail: isXIdentityPlaceholderEmail(session.email) ? undefined : session.email,
      requestedRole: parsed.data.requestedRole,
      reason: parsed.data.reason
    });
  } catch (e) {
    if (e instanceof AccessRequestDuplicatePendingError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

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
