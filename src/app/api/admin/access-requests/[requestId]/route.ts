import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAccessRequestPlanInput } from "@/lib/access-request-plans";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminAccessRequestsRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan } from "@/lib/subscription-plan";
import { createAuditEvent, listAuditEventsForEntity } from "@/modules/audit/repository";
import { enqueueAccessRequestBootstrap } from "@/modules/core-admin/access-request-bootstrap";
import {
    deleteAccessRequest,
    getAccessRequestById,
    provisionDefaultPortfolioForUser,
    reviewAccessRequestById,
    updateAccessRequestPlanById,
    updateAccessRequestRoleById,
    updateAccessRequestTenantById
} from "@/modules/core-admin/repository";
import {
    ACTIONABLE_ACCESS_REQUEST_STATUSES,
    type AccessRequest
} from "@/modules/core-admin/types";
import {
    addRoleToCoreUser,
    getCoreUserById,
    updateCoreUserSubscriptionPlan,
    upsertTenantMembership
} from "@/modules/identity/repository";

const accessRequestRoleSchema = z.enum(["global_admin", "advisor", "operator", "viewer"]);

const reviewAccessRequestSchema = z
  .object({
    status: z.enum(["approved", "rejected"]).optional(),
    requestedPlan: z.string().trim().optional(),
    requestedRole: accessRequestRoleSchema.optional(),
    /** 24-char tenant id, or empty string to clear (cannot approve without a tenant in the same request). */
    targetTenantId: z.string().optional(),
    /** Optional note stored on the request and audit trail when approving or rejecting. */
    reviewNote: z.string().max(2000).optional()
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.requestedPlan !== undefined ||
      value.requestedRole !== undefined ||
      value.targetTenantId !== undefined,
    { message: "Provide status, requestedPlan, requestedRole, and/or targetTenantId (reviewNote alone is not allowed)." }
  )
  .superRefine((value, ctx) => {
    if (value.status !== "approved") {
      return;
    }
    if (value.requestedRole === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "requestedRole is required when approving.",
        path: ["requestedRole"]
      });
    }
    if (value.requestedPlan === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "requestedPlan is required when approving.",
        path: ["requestedPlan"]
      });
    }
    if (value.targetTenantId === undefined || value.targetTenantId.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetTenantId is required when approving (pick a tenant).",
        path: ["targetTenantId"]
      });
    }
  });

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return handleUpdate(request, context);
}

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
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
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
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
  const requestedPlan =
    parsed.data.requestedPlan !== undefined ? parseAccessRequestPlanInput(parsed.data.requestedPlan) : undefined;
  if (parsed.data.requestedPlan !== undefined && !requestedPlan) {
    return NextResponse.json(
      { error: "Invalid requestedPlan. Expected Basic, Premium, or Premium+." },
      { status: 400 }
    );
  }

  let existing = await getAccessRequestById(requestId, {
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

  if (requestedPlan) {
    const updatedRequest = await updateAccessRequestPlanById({
      requestId,
      requestedPlan,
      tenantId: undefined
    });
    if (!updatedRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
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
        requestedPlan
      }
    });
    const refetched = await getAccessRequestById(requestId, { tenantId: undefined });
    if (refetched) {
      existing = refetched;
    }
  }

  if (parsed.data.targetTenantId !== undefined) {
    const raw = parsed.data.targetTenantId.trim();
    const tenantIdHex = raw === "" ? null : raw;
    if (tenantIdHex !== null && !ObjectId.isValid(tenantIdHex)) {
      return NextResponse.json({ error: "Invalid targetTenantId" }, { status: 400 });
    }
    const updatedTenantRow = await updateAccessRequestTenantById({
      requestId,
      tenantIdHex,
      tenantId: undefined
    });
    if (!updatedTenantRow) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
    await createAuditEvent({
      entityType: "access_request",
      entityId: requestId,
      action: "assigned_tenant",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: { targetTenantId: tenantIdHex }
    });
    const refetchedTenant = await getAccessRequestById(requestId, { tenantId: undefined });
    if (refetchedTenant) {
      existing = refetchedTenant;
    }
  }

  if (parsed.data.requestedRole !== undefined) {
    const updatedRoleRow = await updateAccessRequestRoleById({
      requestId,
      requestedRole: parsed.data.requestedRole,
      tenantId: undefined
    });
    if (!updatedRoleRow) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }
    await createAuditEvent({
      entityType: "access_request",
      entityId: requestId,
      action: "updated_role",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        requestedRole: parsed.data.requestedRole
      }
    });
    const refetchedRole = await getAccessRequestById(requestId, { tenantId: undefined });
    if (refetchedRole) {
      existing = refetchedRole;
    }
  }

  if (!parsed.data.status) {
    return NextResponse.json({ data: serializeAccessRequest(existing) });
  }

  const effectivePlan = normalizeSubscriptionPlan(
    requestedPlan ?? existing.requestedPlan ?? "basic"
  );
  let approvedUserObjectId: ObjectId | null = null;
  /** Applicant's book tenant (not the approving admin's session tenant). */
  let applicantPortfolioTenantId: string | undefined;

  if (parsed.data.status === "approved") {
    if (!existing.tenantId) {
      return NextResponse.json(
        {
          error:
            "Target tenant is required before approval. Select a tenant (or send targetTenantId in this request), then approve.",
          code: "access_request_tenant_required"
        },
        { status: 400 }
      );
    }
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
    applicantPortfolioTenantId = existing.tenantId.toHexString();
    await upsertTenantMembership({
      userId,
      tenantId: existing.tenantId,
      role: "member",
      isDefaultTenant: true
    });
    try {
      /** Default book for new users: one portfolio, default paper account ($25k), watchlist with TSLA (see `provisionDefaultPortfolioForUser`). Runs before review is persisted so approve fails closed if provision errors. */
      await provisionDefaultPortfolioForUser({
        userId: existing.userId,
        tenantId: applicantPortfolioTenantId
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

  const reviewed = await reviewAccessRequestById({
    requestId,
    status: parsed.data.status,
    reviewedBy: session.userId,
    tenantId: undefined,
    reviewNote: parsed.data.reviewNote
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
      requestedPlan: effectivePlan,
      ...(parsed.data.reviewNote !== undefined && parsed.data.reviewNote.trim()
        ? { reviewNote: parsed.data.reviewNote.trim().slice(0, 500) }
        : {})
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
        tenantId: applicantPortfolioTenantId!,
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
  const proxied = await proxyAdminAccessRequestsRequestToBackend(request);
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
    requestedPlan: normalizeSubscriptionPlan(request.requestedPlan),
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
