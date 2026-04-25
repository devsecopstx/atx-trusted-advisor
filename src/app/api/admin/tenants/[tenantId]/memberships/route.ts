import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getCoreUserById, getTenantByHexId, upsertTenantMembership } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const assignSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i),
  tenantRole: z.enum(["tenant_admin", "member"]).default("member")
});

export async function POST(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { tenantId } = await context.params;
  if (!ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant id" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const tenant = await getTenantByHexId(tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const user = await getCoreUserById(new ObjectId(parsed.data.userId));
  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const membership = await upsertTenantMembership({
    userId: user._id,
    tenantId: tenant._id,
    role: parsed.data.tenantRole,
    isDefaultTenant: true
  });
  return NextResponse.json({
    data: {
      userId: user._id.toHexString(),
      tenantId: tenant._id.toHexString(),
      role: membership.role,
      isDefaultTenant: membership.isDefaultTenant
    }
  });
}
