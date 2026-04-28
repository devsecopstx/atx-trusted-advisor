import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan, zSubscriptionPlan } from "@/lib/subscription-plan";
import {
    createAuditEvent,
    listLatestAuditEventsForEntities
} from "@/modules/audit/repository";
import {
    assertTenantHasRoomForAnotherUser,
    createCoreUser,
    deleteCoreUserById,
    listAdminTenantMembershipsByUserIds,
    listCoreUsers,
    upsertTenantMembership
} from "@/modules/identity/repository";
import { isTenantMembershipCapExceededError } from "@/modules/identity/tenant-membership-cap";
import type { CoreUser } from "@/modules/identity/types";

const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

const createUserSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["global_admin", "advisor", "operator", "viewer"]).default("operator"),
  subscriptionPlan: zSubscriptionPlan.default("basic"),
  status: z.enum(["active", "suspended"]).default("active")
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

  let created: CoreUser;
  try {
    created = await createCoreUser(parsed.data);
  } catch (error) {
    const isDuplicate = error instanceof Error && /E11000/.test(error.message);
    if (isDuplicate) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    throw error;
  }

  if (created._id && ObjectId.isValid(session.tenantId) && parsed.data.role !== "global_admin") {
    const tenantOid = new ObjectId(session.tenantId);
    try {
      await assertTenantHasRoomForAnotherUser(tenantOid);
      await upsertTenantMembership({
        userId: created._id,
        tenantId: tenantOid,
        role: "member",
        isDefaultTenant: true
      });
    } catch (error) {
      if (isTenantMembershipCapExceededError(error)) {
        await deleteCoreUserById(created._id);
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 409 }
        );
      }
      throw error;
    }
  }

  if (created._id) {
    await createAuditEvent({
      entityType: "core_user",
      entityId: created._id.toHexString(),
      action: "created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        role: parsed.data.role,
        subscriptionPlan: parsed.data.subscriptionPlan,
        status: parsed.data.status
      }
    });
  }

  return NextResponse.json(
    { data: { ...serializeUser(created), tenantMemberships: [] as const } },
    { status: 201 }
  );
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
