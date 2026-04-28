import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan, zSubscriptionPlan } from "@/lib/subscription-plan";
import { createAuditEvent, listAuditEventsForEntity } from "@/modules/audit/repository";
import { purgeAllDataAssociatedWithCoreUser } from "@/modules/core-admin/repository";
import {
    deleteCoreUserById,
    getCoreUserById,
    listAdminTenantMembershipsByUserIds,
    listCoreUsersByEmail,
    revokeCredentialLinksForUsers,
    updateCoreUserBillingOverride,
    updateCoreUserById
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";
import { clearMeteredUsageForUser } from "@/modules/xchat/clear-metered-usage-for-user";

const updateUserSchema = z.object({
  email: z.string().trim().email().optional(),
  role: z.enum(["global_admin", "advisor", "operator", "viewer"]).optional(),
  subscriptionPlan: zSubscriptionPlan.optional(),
  status: z.enum(["active", "suspended"]).optional(),
  billingOverride: z
    .object({
      enabled: z.boolean(),
      reason: z.string().trim().min(3).max(280).optional(),
      expiresAt: z.string().datetime({ offset: true }).optional()
    })
    .optional()
}).refine(
  (value) =>
    value.email !== undefined ||
    value.role !== undefined ||
    value.subscriptionPlan !== undefined ||
    value.status !== undefined ||
    value.billingOverride !== undefined,
  { message: "Provide at least one field to update." }
);

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const user = await getCoreUserById(new ObjectId(userId));
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const auditTrail = await listAuditEventsForEntity({
    entityType: "core_user",
    entityId: userId
  });
  const tenantMap =
    (await listAdminTenantMembershipsByUserIds([new ObjectId(userId)])) ?? new Map();
  return NextResponse.json({
    data: {
      ...serializeUser(user),
      tenantMemberships: tenantMap.get(userId) ?? [],
      auditTrail: auditTrail.map(serializeAuditEvent)
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const json = await request.json();
  const parsed = updateUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await getCoreUserById(new ObjectId(userId));
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const basePatch = {
    email: parsed.data.email,
    role: parsed.data.role,
    subscriptionPlan: parsed.data.subscriptionPlan,
    status: parsed.data.status
  };
  let updated: CoreUser | null;
  try {
    updated = await updateCoreUserById(new ObjectId(userId), basePatch);
  } catch (error) {
    const isDuplicate = error instanceof Error && /E11000/.test(error.message);
    if (isDuplicate) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    throw error;
  }

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (parsed.data.billingOverride) {
    const expiresAt = parsed.data.billingOverride.expiresAt
      ? new Date(parsed.data.billingOverride.expiresAt)
      : undefined;
    updated = await updateCoreUserBillingOverride({
      userId: new ObjectId(userId),
      override: {
        enabled: parsed.data.billingOverride.enabled,
        reason: parsed.data.billingOverride.reason,
        expiresAt
      },
      actorUserId: session.userId
    });
  }

  if (parsed.data.subscriptionPlan !== undefined) {
    const prev = normalizeSubscriptionPlan(existing.subscriptionPlan);
    const next = normalizeSubscriptionPlan(updated.subscriptionPlan);
    if (prev !== next) {
      try {
        await clearMeteredUsageForUser(userId);
      } catch (error) {
        console.warn("[admin/users] metered usage clear after plan change failed (non-fatal)", {
          userId,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "updated",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      changedFields: Object.keys(parsed.data)
    }
  });

  const tenantMap =
    (await listAdminTenantMembershipsByUserIds([new ObjectId(userId)])) ?? new Map();
  return NextResponse.json({
    data: {
      ...serializeUser(updated),
      tenantMemberships: tenantMap.get(userId) ?? []
    }
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (session.userId === userId) {
    return NextResponse.json({ error: "Cannot delete your own account from this console" }, { status: 400 });
  }

  const user = await getCoreUserById(new ObjectId(userId));
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const emailNormalized = user.email.trim().toLowerCase();
  const candidateUsers = await listCoreUsersByEmail(emailNormalized);
  const candidateUserIds = Array.from(
    new Set(
      candidateUsers
        .map((row) => row._id?.toHexString())
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .concat(userId)
    )
  );
  const candidateUserObjectIds = candidateUserIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  await revokeCredentialLinksForUsers(candidateUserObjectIds);

  let deletedTarget = false;
  let deletedUsersCount = 0;
  for (const candidateUserId of candidateUserIds) {
    await purgeAllDataAssociatedWithCoreUser({
      userIdHex: candidateUserId,
      emailNormalized
    });
    const deleted = await deleteCoreUserById(new ObjectId(candidateUserId));
    if (deleted) {
      deletedUsersCount += 1;
      if (candidateUserId === userId) {
        deletedTarget = true;
      }
    }
  }

  if (!deletedTarget) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      purgeAssociatedData: true,
      emailNormalized,
      deletedUsersCount
    }
  });

  return NextResponse.json({ data: { deleted: true, userId } });
}

function serializeUser(user: CoreUser) {
  const billingOverride = user.billing?.override;
  return {
    _id: user._id?.toHexString(),
    email: user.email,
    roles: user.roles,
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
