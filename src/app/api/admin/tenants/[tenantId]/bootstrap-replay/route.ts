import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const postBodySchema = z.object({
  userId: z.string().regex(/^[a-f0-9]{24}$/i)
});

async function loadTenantForRoute(urlTenantId: string, sessionTenantId: string) {
  const url = urlTenantId.trim();
  let tenant = await getTenantByHexIdCached(url);
  if (tenant?._id) {
    return tenant;
  }
  if (url === sessionTenantId.trim()) {
    const resolved = await resolveTenantIdHexForGlobalAdminConsole(sessionTenantId);
    if (resolved) {
      tenant = await getTenantByHexIdCached(resolved);
    }
  }
  return tenant?._id ? tenant : null;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "userId must be a 24-char hex Mongo id" }, { status: 400 });
  }

  const uid = parsed.data.userId.trim().toLowerCase();
  const db = await getDb();
  const membership = await db.collection("core_tenant_memberships").findOne({
    userId: new ObjectId(uid),
    tenantId: tenant._id
  });
  if (!membership) {
    return NextResponse.json(
      { error: "User is not a member of this tenant", code: "membership_missing" },
      { status: 400 }
    );
  }

  const tenantHex = tenant._id.toHexString();
  const result = await ensureTenantBootstrapForUser({
    userId: uid,
    tenantId: tenantHex,
    trigger: "admin_replay"
  });

  if (result.didProvision) {
    return NextResponse.json({
      data: {
        didProvision: true,
        portfolioId: result.result.portfolio._id?.toHexString() ?? "",
        platformRole: result.platformRole
      }
    });
  }

  return NextResponse.json({
    data: {
      didProvision: false,
      skippedReason: result.skippedReason
    }
  });
}
