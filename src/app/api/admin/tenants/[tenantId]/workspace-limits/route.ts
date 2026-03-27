import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { parseWorkspaceLimitsPayload } from "@/modules/identity/tenant-workspace-limits";
import {
  getTenantByHexId,
  resolvedWorkspaceLimitsForTenant,
  updateTenantWorkspaceLimits
} from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  workspaceLimits: z.record(z.string(), z.unknown()).optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(_request);
  if (proxied) {
    return proxied;
  }

  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await getTenantByHexId(tenantId.trim());
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const effective = resolvedWorkspaceLimitsForTenant(tenant);
  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      slug: tenant.slug,
      name: tenant.name,
      workspaceLimits: effective,
      workspaceLimitsRaw: tenant.workspaceLimits ?? null
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await getTenantByHexId(tenantId.trim());
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const wlParsed = parseWorkspaceLimitsPayload(parsed.data.workspaceLimits ?? {});
  if (!wlParsed.ok) {
    return NextResponse.json({ error: wlParsed.error }, { status: 400 });
  }

  const updated = await updateTenantWorkspaceLimits(tenantId.trim(), wlParsed.value);
  if (!updated?._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }

  const effective = resolvedWorkspaceLimitsForTenant(updated);
  return NextResponse.json({
    data: {
      tenantId: updated._id.toHexString(),
      workspaceLimits: effective,
      workspaceLimitsRaw: updated.workspaceLimits ?? null
    }
  });
}
