import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { createAuditEvent, listAuditEventsForEntity } from "@/modules/audit/repository";
import {
    deleteCoreUserById,
    getCoreUserById,
    updateCoreUserById
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

const updateUserSchema = z.object({
  email: z.string().trim().email().optional(),
  role: z.enum(["global_admin", "advisor", "operator", "viewer"]).optional(),
  subscriptionPlan: z.enum(["free", "pro", "enterprise"]).optional(),
  status: z.enum(["active", "suspended"]).optional()
}).refine(
  (value) =>
    value.email !== undefined ||
    value.role !== undefined ||
    value.subscriptionPlan !== undefined ||
    value.status !== undefined,
  { message: "Provide at least one field to update." }
);

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
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
  return NextResponse.json({
    data: {
      ...serializeUser(user),
      auditTrail: auditTrail.map(serializeAuditEvent)
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
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

  let updated: CoreUser | null;
  try {
    updated = await updateCoreUserById(new ObjectId(userId), parsed.data);
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

  return NextResponse.json({ data: serializeUser(updated) });
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

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const deleted = await deleteCoreUserById(new ObjectId(userId));
  if (!deleted) {
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
    }
  });

  return NextResponse.json({ data: { deleted: true, userId } });
}

function serializeUser(user: CoreUser) {
  return {
    _id: user._id?.toHexString(),
    email: user.email,
    roles: user.roles,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    status: user.status,
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
