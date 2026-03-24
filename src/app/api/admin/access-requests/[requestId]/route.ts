import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { createAuditEvent, listAuditEventsForEntity } from "@/modules/audit/repository";
import { enqueueAccessRequestBootstrap } from "@/modules/core-admin/access-request-bootstrap";
import {
    deleteAccessRequest,
    getAccessRequestById,
    provisionDefaultPortfolioForUser,
    reviewAccessRequestById,
    updateAccessRequestPlanById
} from "@/modules/core-admin/repository";
import {
    ACTIONABLE_ACCESS_REQUEST_STATUSES,
    type AccessRequest
} from "@/modules/core-admin/types";
import {
    addRoleToCoreUser,
    getCoreUserById,
    updateCoreUserSubscriptionPlan
} from "@/modules/identity/repository";

const reviewAccessRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]).optional(),
  requestedPlan: z.enum(["free", "pro", "enterprise"]).optional()
}).refine((value) => value.status !== undefined || value.requestedPlan !== undefined, {
  message: "Provide status or requestedPlan."
});

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return handleUpdate(request, context);
}

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { requestId } = await context.params;
  const existing = await getAccessRequestById(requestId, {
    tenantId: undefined
  });
  if (!existing) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  const auditTrail = await listAuditEventsForEntity({
    entityType: "access_request",
    entityId: requestId
  });

  return NextResponse.json({
    data: {
      ...serializeAccessRequest(existing),
      auditTrail: auditTrail.map(serializeAuditEvent)
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return handleUpdate(request, context);
}

async function handleUpdate(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { requestId } = await context.params;
  const body = await request.json();
  const parsed = reviewAccessRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await getAccessRequestById(requestId, {
    tenantId: undefined
  });
  if (!existing?._id) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  if (!ACTIONABLE_ACCESS_REQUEST_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: "Access request already reviewed", data: existing },
      { status: 409 }
    );
  }

  if (parsed.data.requestedPlan) {
    const updatedRequest = await updateAccessRequestPlanById({
      requestId,
      requestedPlan: parsed.data.requestedPlan,
      tenantId: undefined
    });
    if (!updatedRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
    if (!parsed.data.status) {
      await createAuditEvent({
        entityType: "access_request",
        entityId: requestId,
        action: "updated_plan",
        actor: {
          userId: session.userId,
          email: session.email,
          username: session.username
        },
        details: {
          requestedPlan: parsed.data.requestedPlan
        }
      });
      return NextResponse.json({ data: serializeAccessRequest(updatedRequest) });
    }
  }

  const effectivePlan = parsed.data.requestedPlan ?? existing.requestedPlan ?? "free";
  let approvedUserObjectId: ObjectId | null = null;

  if (parsed.data.status === "approved") {
    if (!ObjectId.isValid(existing.userId)) {
      return NextResponse.json(
        { error: "Approved request has invalid user id" },
        { status: 400 }
      );
    }
    const userId = new ObjectId(existing.userId);
    approvedUserObjectId = userId;
    await addRoleToCoreUser({
      userId,
      role: existing.requestedRole
    });
    await updateCoreUserSubscriptionPlan({
      userId,
      subscriptionPlan: effectivePlan
    });
    try {
      await provisionDefaultPortfolioForUser({
        userId: existing.userId,
        tenantId: session.tenantId
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to provision default portfolio resources",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }
  }

  if (!parsed.data.status) {
    return NextResponse.json({ error: "Missing review status" }, { status: 400 });
  }

  const reviewed = await reviewAccessRequestById({
    requestId,
    status: parsed.data.status,
    reviewedBy: session.userId,
    tenantId: undefined
  });

  if (!reviewed) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "access_request",
    entityId: requestId,
    action: parsed.data.status === "approved" ? "approved" : "rejected",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      requestedPlan: effectivePlan
    }
  });

  if (parsed.data.status === "approved") {
    const approvedUser = approvedUserObjectId
      ? await getCoreUserById(approvedUserObjectId)
      : null;
    if (!approvedUser?.email) {
      await createAuditEvent({
        entityType: "access_request",
        entityId: requestId,
        action: "alert-user-not-sync-warning",
        actor: {
          userId: session.userId,
          email: session.email,
          username: session.username
        },
        details: {
          reason: "approved user email missing; skipped xchat bootstrap sync",
          userId: existing.userId
        }
      });
    } else {
      await enqueueAccessRequestBootstrap({
        requestId,
        userId: existing.userId,
        userEmail: approvedUser.email,
        tenantId: session.tenantId,
        requestedPlan: effectivePlan,
        actor: {
          userId: session.userId,
          email: session.email,
          username: session.username
        }
      });
    }
  }

  return NextResponse.json({ data: serializeAccessRequest(reviewed) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { requestId } = await context.params;
  if (!ObjectId.isValid(requestId)) {
    return NextResponse.json({ error: "Invalid access request id" }, { status: 400 });
  }

  const deleted = await deleteAccessRequest(requestId, {
    tenantId: undefined
  });
  if (!deleted) {
    return NextResponse.json({ error: "Access request not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "access_request",
    entityId: requestId,
    action: "deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    }
  });

  return NextResponse.json({ data: { deleted: true, requestId } });
}

function serializeAccessRequest(request: AccessRequest) {
  return {
    ...request,
    _id: request._id?.toHexString(),
    tenantId: request.tenantId?.toHexString(),
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString()
  };
}

function serializeAuditEvent(event: {
  action: string;
  createdAt: Date;
  actor: { userId: string; email?: string; username?: string };
  details?: Record<string, unknown>;
}) {
  return {
    action: event.action,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
    details: event.details
  };
}
