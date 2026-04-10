import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan, zSubscriptionPlan } from "@/lib/subscription-plan";
import { createAuditEvent } from "@/modules/audit/repository";
import { getCoreUserById, updateCoreUserSubscriptionPlan } from "@/modules/identity/repository";
import { clearMeteredUsageForUser } from "@/modules/xchat/clear-metered-usage-for-user";

const updatePlanSchema = z.object({
  subscriptionPlan: zSubscriptionPlan
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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
  const parsed = updatePlanSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await getCoreUserById(new ObjectId(userId));
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const prevPlan = normalizeSubscriptionPlan(existing.subscriptionPlan);

  const updated = await updateCoreUserSubscriptionPlan({
    userId: new ObjectId(userId),
    subscriptionPlan: parsed.data.subscriptionPlan
  });
  const nextPlan = normalizeSubscriptionPlan(updated.subscriptionPlan);
  if (prevPlan !== nextPlan) {
    try {
      await clearMeteredUsageForUser(userId);
    } catch (error) {
      console.warn("[admin/users/plan] metered usage clear after plan change failed (non-fatal)", {
        userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "updated_plan",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      subscriptionPlan: normalizeSubscriptionPlan(updated.subscriptionPlan)
    }
  });

  return NextResponse.json({
    data: {
      userId: updated._id?.toHexString(),
      subscriptionPlan: normalizeSubscriptionPlan(updated.subscriptionPlan)
    }
  });
}
