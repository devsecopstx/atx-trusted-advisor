import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminUserCredentialInviteFields } from "@/lib/admin-user-credential-invite";
import { getAdminUserEmailVerificationResendFields } from "@/lib/admin-user-email-verification";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan, zSubscriptionPlan } from "@/lib/subscription-plan";
import {
    createAuditEvent,
    listLatestAuditEventsForEntities
} from "@/modules/audit/repository";
import {
    AccessRequestDuplicatePendingError,
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";
import {
    ensureCoreUserByEmail,
    listAdminTenantMembershipsByUserIds,
    listCoreUsers,
    updateCoreUserAccountStatus
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

const createUserSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["global_admin", "advisor", "operator", "viewer"]).default("operator"),
  subscriptionPlan: zSubscriptionPlan.default("basic"),
  reason: z.string().trim().min(5).max(512).optional()
});

export async function GET(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const parsed = listUsersQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const users = await listCoreUsers(parsed.data.limit);
  const userIds = users.map((u) => u._id).filter((id): id is NonNullable<typeof id> => Boolean(id));
  const tenantMembershipsByUserId =
    (await listAdminTenantMembershipsByUserIds(userIds)) ?? new Map();
  const serialized = users.map(serializeUser);
  const latestAuditByUserId = await listLatestAuditEventsForEntities({
    entityType: "core_user",
    entityIds: serialized.flatMap((user) => (user._id ? [user._id] : []))
  });
  return NextResponse.json({
    data: serialized.map((user) => {
      const uid = user._id;
      return {
        ...user,
        tenantMemberships: uid ? tenantMembershipsByUserId.get(uid) ?? [] : [],
        latestAuditEvent: uid ? serializeAuditEvent(latestAuditByUserId[uid]) : null
      };
    })
  });
}

export async function POST(request: Request) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json();
  const parsed = createUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  let user: CoreUser;
  try {
    user = await ensureCoreUserByEmail({ email, defaultRoles: [] });
  } catch (error) {
    const isDuplicate = error instanceof Error && /E11000/.test(error.message);
    if (isDuplicate) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    throw error;
  }
  if (!user._id) {
    return NextResponse.json({ error: "Unable to resolve user" }, { status: 500 });
  }

  await updateCoreUserAccountStatus({
    userId: user._id,
    accountStatus: "pending_approval"
  });

  const userId = user._id.toHexString();
  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId,
    requestedRole: parsed.data.role,
    tenantId: session.tenantId
  });
  if (existingPending) {
    return NextResponse.json(
      {
        error: "An open access request already exists for this user and role.",
        data: { userId, email, accessRequestId: existingPending._id?.toHexString() }
      },
      { status: 409 }
    );
  }

  let accessRequest;
  try {
    accessRequest = await createAccessRequest({
      tenantId: session.tenantId,
      userId,
      contactEmail: email,
      requestedRole: parsed.data.role,
      requestedPlan: parsed.data.subscriptionPlan,
      reason:
        parsed.data.reason?.trim() ||
        "Admin created user — pending approval before sign-in (Manage Users)",
      status: "pending"
    });
  } catch (error) {
    if (error instanceof AccessRequestDuplicatePendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (accessRequest._id) {
    await createAuditEvent({
      entityType: "access_request",
      entityId: accessRequest._id.toHexString(),
      action: "created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        requestedRole: accessRequest.requestedRole,
        requestedPlan: accessRequest.requestedPlan,
        source: "admin_users_post"
      }
    });
  }

  return NextResponse.json(
    {
      data: {
        user: serializeUser({ ...user, accountStatus: "pending_approval", roles: [] }),
        accessRequest: {
          _id: accessRequest._id?.toHexString(),
          status: accessRequest.status,
          requestedRole: accessRequest.requestedRole,
          requestedPlan: normalizeSubscriptionPlan(accessRequest.requestedPlan)
        },
        message:
          "Pending access request created. Approve from Access requests or Manage Users before the user can sign in."
      }
    },
    { status: 201 }
  );
}

function serializeUser(user: CoreUser) {
  const billingOverride = user.billing?.override;
  return {
    ...getAdminUserCredentialInviteFields(user),
    ...getAdminUserEmailVerificationResendFields(user),
    _id: user._id?.toHexString(),
    email: user.email,
    roles: user.roles,
    accountStatus: user.accountStatus,
    subscriptionPlan: normalizeSubscriptionPlan(user.subscriptionPlan),
    status: user.status,
    billing: user.billing
      ? {
          stripeSubscriptionId: user.billing.stripeSubscriptionId,
          stripeSubscriptionStatus: user.billing.stripeSubscriptionStatus,
          stripeCurrentPeriodEnd: user.billing.stripeCurrentPeriodEnd?.toISOString(),
          cancelAtPeriodEnd: user.billing.cancelAtPeriodEnd,
          canceledAt: user.billing.canceledAt?.toISOString(),
          override: billingOverride
            ? {
                enabled: billingOverride.enabled,
                reason: billingOverride.reason,
                grantedByUserId: billingOverride.grantedByUserId,
                grantedAt: billingOverride.grantedAt?.toISOString(),
                expiresAt: billingOverride.expiresAt?.toISOString()
              }
            : undefined
        }
      : undefined,
    xAccount: user.xAccount
      ? {
          ...user.xAccount,
          linkedAt: user.xAccount.linkedAt.toISOString()
        }
      : undefined,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString()
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
