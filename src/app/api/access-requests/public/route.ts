import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAccessRequestPlanInput } from "@/lib/access-request-plans";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey
} from "@/lib/distributed-rate-limit";
import { buildAccessRequestNotification, sendSlackNotification } from "@/lib/slack";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    AccessRequestDuplicatePendingError,
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";
import { ensureCoreUserByEmail } from "@/modules/identity/repository";

const guestAccessRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  requestedPlan: z.string().trim().optional()
});

const ACCESS_REQUEST_PUBLIC_WINDOW_MS = 60_000;
const ACCESS_REQUEST_PUBLIC_MAX = 6;

export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  const limit = await checkDistributedRateLimit({
    key: `access-requests:public:${extractClientRateLimitKey(request)}`,
    windowMs: ACCESS_REQUEST_PUBLIC_WINDOW_MS,
    max: ACCESS_REQUEST_PUBLIC_MAX
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Too many guest access requests. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = guestAccessRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const requestedPlan =
    parsed.data.requestedPlan === undefined
      ? "basic"
      : parseAccessRequestPlanInput(parsed.data.requestedPlan);
  if (!requestedPlan) {
    return NextResponse.json(
      { error: "Invalid requestedPlan. Expected Basic, Premium, or Premium+." },
      { status: 400 }
    );
  }
  const requestedRole = "viewer" as const;

  const user = await ensureCoreUserByEmail({ email });
  if (!user._id) {
    return NextResponse.json({ error: "Unable to resolve user for access request" }, { status: 500 });
  }
  const userId = user._id.toHexString();

  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId,
    requestedRole,
    tenantId: undefined
  });
  if (existingPending) {
    return NextResponse.json(
      {
        ok: true,
        data: {
          requestedRole: existingPending.requestedRole,
          requestedPlan: existingPending.requestedPlan,
          status: existingPending.status,
          requestedAt: existingPending.requestedAt.toISOString(),
          existing: true
        }
      },
      { status: 200 }
    );
  }

  let created;
  try {
    created = await createAccessRequest({
      userId,
      contactEmail: email,
      requestedRole,
      requestedPlan,
      reason: `Guest xChat registration from ${name}`,
      status: "pending"
    });
  } catch (error) {
    if (error instanceof AccessRequestDuplicatePendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (created._id) {
    await createAuditEvent({
      entityType: "access_request",
      entityId: created._id.toHexString(),
      action: "guest_self_requested",
      actor: {
        userId,
        email
      },
      details: {
        requestedRole: created.requestedRole,
        requestedPlan: created.requestedPlan,
        reason: created.reason,
        source: "xchat_guest_register",
        displayName: name
      }
    });
  }

  void sendSlackNotification(
    buildAccessRequestNotification({
      email,
      requestedRole,
      reason: `Guest xChat registration from ${name} (${requestedPlan})`
    })
  );

  return NextResponse.json(
    {
      ok: true,
      data: {
        requestedRole: created.requestedRole,
        requestedPlan: created.requestedPlan,
        status: created.status,
        requestedAt: created.requestedAt.toISOString()
      }
    },
    { status: 201 }
  );
}
