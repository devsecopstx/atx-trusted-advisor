import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { updateCoreUserEmail } from "@/modules/identity/repository";

const updateEmailSchema = z.object({
  email: z.string().trim().email()
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const json = await request.json();
  const parsed = updateEmailSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateCoreUserEmail({
    userId: new ObjectId(userId),
    email: parsed.data.email
  });
  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "updated_email",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      email: updated.email
    }
  });
  return NextResponse.json({
    data: {
      userId: updated._id?.toHexString(),
      email: updated.email
    }
  });
}
