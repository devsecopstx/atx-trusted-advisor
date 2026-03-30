import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { normalizeSubscriptionPlan, zSubscriptionPlan } from "@/lib/subscription-plan";
import { createAuditEvent } from "@/modules/audit/repository";
import { updateCoreUserSubscriptionPlan } from "@/modules/identity/repository";

const updatePlanSchema = z.object({
  subscriptionPlan: zSubscriptionPlan
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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
  const parsed = updatePlanSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateCoreUserSubscriptionPlan({
    userId: new ObjectId(userId),
    subscriptionPlan: parsed.data.subscriptionPlan
  });
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
