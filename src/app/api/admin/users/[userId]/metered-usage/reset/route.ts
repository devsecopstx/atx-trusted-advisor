import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { createAuditEvent } from "@/modules/audit/repository";
import { getCoreUserById } from "@/modules/identity/repository";
import { clearMeteredUsageForUser } from "@/modules/xchat/clear-metered-usage-for-user";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  let cleared;
  try {
    cleared = await clearMeteredUsageForUser(userId);
  } catch (error) {
    console.error("[admin/users] metered usage reset failed", {
      userId,
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "Failed to clear usage data" }, { status: 503 });
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "metered_usage_reset",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      xchatUsageDeleted: cleared.xchatUsageDeleted,
      featureDailyDeleted: cleared.featureDailyDeleted
    }
  });

  return NextResponse.json({
    data: {
      userId,
      ...cleared
    }
  });
}
