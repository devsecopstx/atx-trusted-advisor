import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    getTenantByHexId,
    resolvedWorkspaceLimitsForTenant,
    updateTenantBrandingPreferencesOneTime,
    updateTenantWorkspaceLimits,
    updateTenantXchatDebugEnabled
} from "@/modules/identity/repository";
import {
    parseTenantBrandingPreferencesPayload,
    parseTenantXchatDebugEnabled
} from "@/modules/identity/tenant-branding-preferences";
import {
    normalizePlanOverridesFromUnknown,
    parsePlanOverridesPayload,
    parseWorkspaceLimitsPayload,
    type TenantPlanWorkspaceOverrides
} from "@/modules/identity/tenant-workspace-limits";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  workspaceLimits: z.record(z.string(), z.unknown()).optional(),
  planOverrides: z.record(z.string(), z.unknown()).optional(),
  tenantPreferences: z.record(z.string(), z.unknown()).optional()
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
  const planOverrides = normalizePlanOverridesFromUnknown(tenant.workspaceLimits?.planOverrides);
  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      slug: tenant.slug,
      name: tenant.name,
      workspaceLimits: effective,
      planOverrides,
      workspaceLimitsRaw: tenant.workspaceLimits ?? null,
      tenantPreferences: tenant.tenantPreferences ?? {},
      tenantPreferencesRaw: tenant.tenantPreferences ?? {}
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
  let planOverridesPatch: TenantPlanWorkspaceOverrides | undefined;
  if (parsed.data.planOverrides !== undefined) {
    const po = parsePlanOverridesPayload(parsed.data.planOverrides);
    if (!po.ok) {
      return NextResponse.json({ error: po.error }, { status: 400 });
    }
    planOverridesPatch = po.value;
  }
  const tpParsed = parseTenantBrandingPreferencesPayload(parsed.data.tenantPreferences ?? {});
  if (!tpParsed.ok) {
    return NextResponse.json({ error: tpParsed.error }, { status: 400 });
  }

  const tpBody = parsed.data.tenantPreferences;
  const xchatDebugToggle =
    tpBody &&
    typeof tpBody === "object" &&
    !Array.isArray(tpBody)
      ? parseTenantXchatDebugEnabled(
          (tpBody as Record<string, unknown>).xchat_debug_enabled
        )
      : undefined;

  const limitsUpdated = await updateTenantWorkspaceLimits(
    tenantId.trim(),
    wlParsed.value,
    planOverridesPatch
  );
  if (!limitsUpdated?._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }
  const brandingUpdate = await updateTenantBrandingPreferencesOneTime(tenantId.trim(), tpParsed.value);
  if (brandingUpdate.conflictKeys.length > 0) {
    return NextResponse.json(
      {
        error: `Tenant preference locked: ${brandingUpdate.conflictKeys.join(", ")} can only be set once`
      },
      { status: 409 }
    );
  }
  let updated = brandingUpdate.tenant ?? limitsUpdated;
  if (!updated?._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }

  if (xchatDebugToggle !== undefined) {
    const afterDebug = await updateTenantXchatDebugEnabled(tenantId.trim(), xchatDebugToggle);
    if (afterDebug?._id) {
      updated = afterDebug;
    }
  }

  const effective = resolvedWorkspaceLimitsForTenant(updated);
  const planOverridesOut = normalizePlanOverridesFromUnknown(updated.workspaceLimits?.planOverrides);
  if (!updated._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }
  return NextResponse.json({
    data: {
      tenantId: updated._id.toHexString(),
      workspaceLimits: effective,
      planOverrides: planOverridesOut,
      workspaceLimitsRaw: updated.workspaceLimits ?? null,
      tenantPreferences: updated.tenantPreferences ?? {},
      tenantPreferencesRaw: updated.tenantPreferences ?? {}
    }
  });
}
