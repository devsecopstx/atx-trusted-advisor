import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAccessRequestPlanInput } from "@/lib/access-request-plans";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminAccessRequestsRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import {
    createAuditEvent,
    listLatestAuditEventsForEntities
} from "@/modules/audit/repository";
import {
    AccessRequestDuplicatePendingError,
    createAccessRequest,
    getPendingAccessRequestByUserAndRole,
    listAccessRequests
} from "@/modules/core-admin/repository";
import type { AccessRequestListItem, AccessRequestUserSummary } from "@/modules/core-admin/types";
import { accessRequestStatusValues } from "@/modules/core-admin/types";
import { ensureCoreUserByEmail } from "@/modules/identity/repository";

const createAccessRequestSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  requestedRole: z.enum(["global_admin", "advisor", "operator", "viewer"]),
  requestedPlan: z.string().trim().optional().default("basic"),
  reason: z.string().min(5),
  status: z.enum(accessRequestStatusValues).optional()
}).superRefine((value, ctx) => {
  const hasUserId = Boolean(value.userId);
  const hasEmail = Boolean(value.email);
  if (!hasUserId && !hasEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either userId or email.",
      path: ["userId"]
    });
  }
  if (hasUserId && hasEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide only one identifier: userId or email.",
      path: ["email"]
    });
  }
});

const accessRequestQuerySchema = z.object({
  status: z
    .union([z.enum(accessRequestStatusValues), z.literal("all"), z.literal("open")])
    .optional()
    .default("open")
});

export async function GET(request: Request) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const parsed = accessRequestQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const raw = parsed.data.status;
  const requests =
    raw === "all"
      ? await listAccessRequests({ tenantId: undefined })
      : raw === "open"
        ? await listAccessRequests({
            statuses: ["new", "triaged", "pending"],
            tenantId: undefined
          })
        : await listAccessRequests({ status: raw, tenantId: undefined });
  const serialized = requests.map(serializeAccessRequest);
  const latestAuditByRequestId = await listLatestAuditEventsForEntities({
    entityType: "access_request",
    entityIds: serialized.flatMap((item) => (item._id ? [item._id] : []))
  });
  return NextResponse.json({
    data: serialized.map((item) => ({
      ...item,
      user: serializeAccessUserSummary(item.user),
      reviewedByUser: serializeAccessUserSummary(item.reviewedByUser),
      latestAuditEvent: item._id ? serializeAuditEvent(latestAuditByRequestId[item._id]) : null
    }))
  });
}

export async function POST(request: Request) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json();
  const parsed = createAccessRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const requestedPlan = parseAccessRequestPlanInput(parsed.data.requestedPlan);
  if (!requestedPlan) {
    return NextResponse.json(
      { error: "Invalid requestedPlan. Expected Basic, Premium, or Premium+." },
      { status: 400 }
    );
  }

  let resolvedUserId = parsed.data.userId;
  let resolvedEmail: string | undefined;

  if (parsed.data.email) {
    const ensuredUser = await ensureCoreUserByEmail({
      email: parsed.data.email
    });
    if (!ensuredUser._id) {
      return NextResponse.json(
        { error: "Unable to create or resolve user for access request" },
        { status: 500 }
      );
    }
    resolvedUserId = ensuredUser._id.toHexString();
    resolvedEmail = ensuredUser.email;
  }

  if (!resolvedUserId) {
    return NextResponse.json({ error: "Unable to resolve user id" }, { status: 400 });
  }

  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId: resolvedUserId,
    requestedRole: parsed.data.requestedRole,
    tenantId: undefined
  });
  if (existingPending) {
    return NextResponse.json(
      {
        error: "An open access request already exists for this user and role.",
        data: serializeAccessRequest(existingPending)
      },
      { status: 409 }
    );
  }

  let created;
  try {
    created = await createAccessRequest({
      tenantId: session.tenantId,
      userId: resolvedUserId,
      contactEmail: resolvedEmail,
      requestedRole: parsed.data.requestedRole,
      requestedPlan,
      reason: parsed.data.reason,
      status: parsed.data.email ? "pending" : parsed.data.status
    });
  } catch (e) {
    if (e instanceof AccessRequestDuplicatePendingError) {
      return NextResponse.json(
        { error: e.message },
        { status: 409 }
      );
    }
    throw e;
  }
  if (created._id) {
    await createAuditEvent({
      entityType: "access_request",
      entityId: created._id.toHexString(),
      action: "created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        requestedRole: created.requestedRole,
        requestedPlan: created.requestedPlan,
        reason: created.reason
      }
    });
  }
  return NextResponse.json(
    {
      data: serializeAccessRequest(created),
      meta: {
        resolvedUserId,
        resolvedEmail
      }
    },
    { status: 201 }
  );
}

function serializeAccessRequest(request: AccessRequestListItem) {
  return {
    ...request,
    requestedPlan: normalizeSubscriptionPlan(request.requestedPlan),
    _id: request._id?.toHexString(),
    tenantId: request.tenantId?.toHexString(),
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString()
  };
}

function serializeAccessUserSummary(user: AccessRequestUserSummary | undefined) {
  if (!user) {
    return undefined;
  }
  const lastLoginAt =
    user.lastLoginAt instanceof Date
      ? user.lastLoginAt.toISOString()
      : typeof user.lastLoginAt === "string"
        ? user.lastLoginAt
        : undefined;
  return {
    ...user,
    lastLoginAt
  };
}

function serializeAuditEvent(
  event:
    | {
        action: string;
        createdAt: Date;
        actor: { userId: string; email?: string; username?: string };
        details?: Record<string, unknown>;
      }
    | undefined
) {
  if (!event) {
    return null;
  }
  return {
    action: event.action,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
    details: event.details
  };
}
