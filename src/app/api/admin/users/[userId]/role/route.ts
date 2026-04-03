import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { createAuditEvent } from "@/modules/audit/repository";
import { updateCoreUserRole } from "@/modules/identity/repository";

const updateRoleSchema = z.object({
  role: z.enum(["global_admin", "advisor", "operator", "viewer"])
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
  const parsed = updateRoleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateCoreUserRole({
    userId: new ObjectId(userId),
    role: parsed.data.role
  });
  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "updated_role",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      role: updated.roles[0] ?? "viewer"
    }
  });

  return NextResponse.json({
    data: {
      userId: updated._id?.toHexString(),
      role: updated.roles[0] ?? "viewer"
    }
  });
}

