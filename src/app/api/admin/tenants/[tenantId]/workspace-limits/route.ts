import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { resolveEffectivePlanOverridesForTenant } from "@/lib/tenant-workspace-limits";
import { parseXfUiThemePreferenceFromUnknown } from "@/lib/xf-ui-theme";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    applyTenantShellPreferencesPatch,
    getTenantByHexId,
    listTenantMembershipsForAdmin,
    resolvedWorkspaceLimitsForTenant,
    resolveTenantIdHexForGlobalAdminConsole,
    tenantHasAdminMembership,
    updateTenantAmbientMarketVeil,
    updateTenantBrandingPreferencesOneTime,
    updateTenantFeatureFlags,
    updateTenantWorkspaceLimits,
    updateTenantXchatDebugEnabled,
    updateTenantXfUiThemePreference
} from "@/modules/identity/repository";
import {
    parseFeatureFlagsPayload,
    parseTenantAmbientMarketVeil,
    parseTenantBrandingPreferencesPayload,
    parseTenantXchatDebugEnabled
} from "@/modules/identity/tenant-branding-preferences";
import {
    coalesceTenantWorkspaceLimitsForPersistence,
    parsePlanOverridesPayload,
    parseWorkspaceLimitsPayload,
    tenantWorkspaceLimitsScalarsMissing,
    type TenantPlanWorkspaceOverrides
} from "@/modules/identity/tenant-workspace-limits";
import type { Tenant } from "@/modules/identity/types";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  workspaceLimits: z.record(z.string(), z.unknown()).optional(),
  planOverrides: z.record(z.string(), z.unknown()).optional(),
  tenantPreferences: z.record(z.string(), z.unknown()).optional(),
  featureFlags: z.record(z.string(), z.unknown()).optional()
});

async function loadTenantForWorkspaceLimitsRoute(urlTenantId: string, sessionTenantId: string) {
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

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  let tenant = await loadTenantForWorkspaceLimitsRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenantObjectId = tenant._id;

  if (tenantWorkspaceLimitsScalarsMissing(tenant.workspaceLimits)) {
    const now = new Date();
    const db = await getDb();
    await db.collection("core_tenants").updateOne(
      { _id: tenantObjectId },
      {
        $set: {
          workspaceLimits: coalesceTenantWorkspaceLimitsForPersistence(tenant.workspaceLimits),
          updatedAt: now
        }
      }
    );
    const fresh = await getTenantByHexId(tenantObjectId.toHexString());
    if (fresh?._id) {
      tenant = fresh;
    }
  }

  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const effective = await resolvedWorkspaceLimitsForTenant(tenant);
  const planOverrides = await resolveEffectivePlanOverridesForTenant(tenant);
  const hasTenantAdmin = await tenantHasAdminMembership(tenantObjectId);
  const tenantAdmins = (await listTenantMembershipsForAdmin(tenantObjectId)).filter(
    (m) => m.tenantRole === "tenant_admin"
  );
  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      slug: tenant.slug,
      name: tenant.name,
      hasTenantAdmin,
      tenantAdmins,
      workspaceLimits: effective,
      planOverrides,
      workspaceLimitsRaw: tenant.workspaceLimits ?? null,
      tenantPreferences: tenant.tenantPreferences ?? {},
      tenantPreferencesRaw: tenant.tenantPreferences ?? {}
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForWorkspaceLimitsRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const effectiveTenantHex = tenant._id.toHexString();

  const hasTenantAdmin = await tenantHasAdminMembership(tenant._id);
  if (!hasTenantAdmin) {
    return NextResponse.json(
      {
        error: "tenant_admin_required",
        message: "Assign at least one tenant admin before saving tenant settings."
      },
      { status: 400 }
    );
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
    effectiveTenantHex,
    wlParsed.value,
    planOverridesPatch
  );
  if (!limitsUpdated?._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }
  const brandingUpdate = await updateTenantBrandingPreferencesOneTime(effectiveTenantHex, tpParsed.value);
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

  if (tpBody && typeof tpBody === "object" && !Array.isArray(tpBody)) {
    const shell = await applyTenantShellPreferencesPatch(effectiveTenantHex, tpBody as Record<string, unknown>);
    if (shell.error) {
      return NextResponse.json({ error: shell.error }, { status: 400 });
    }
    if (shell.tenant?._id) {
      updated = shell.tenant;
    }
  }

  if (xchatDebugToggle !== undefined) {
    const afterDebug = await updateTenantXchatDebugEnabled(effectiveTenantHex, xchatDebugToggle);
    if (afterDebug?._id) {
      updated = afterDebug;
    }
  }

  if (
    tpBody &&
    typeof tpBody === "object" &&
    !Array.isArray(tpBody) &&
    "ambient_market_veil" in (tpBody as Record<string, unknown>)
  ) {
    const veilToggle = parseTenantAmbientMarketVeil((tpBody as Record<string, unknown>).ambient_market_veil);
    if (veilToggle === undefined) {
      return NextResponse.json(
        { error: "Invalid ambient_market_veil — use boolean or null" },
        { status: 400 }
      );
    }
    const afterVeil = await updateTenantAmbientMarketVeil(effectiveTenantHex, veilToggle);
    if (afterVeil?._id) {
      updated = afterVeil;
    }
  }

  if (
    tpBody &&
    typeof tpBody === "object" &&
    !Array.isArray(tpBody) &&
    "xf_ui_theme" in (tpBody as Record<string, unknown>)
  ) {
    const rec = tpBody as Record<string, unknown>;
    const rawTheme = rec.xf_ui_theme;
    if (rawTheme === null) {
      const afterTheme = await updateTenantXfUiThemePreference(effectiveTenantHex, null);
      if (afterTheme?._id) {
        updated = afterTheme;
      }
    } else {
      const parsedTheme = parseXfUiThemePreferenceFromUnknown(rawTheme);
      if (parsedTheme === undefined) {
        return NextResponse.json(
          { error: "Invalid xf_ui_theme — use light, dark, or system" },
          { status: 400 }
        );
      }
      const afterTheme = await updateTenantXfUiThemePreference(effectiveTenantHex, parsedTheme);
      if (afterTheme?._id) {
        updated = afterTheme;
      }
    }
  }

  if (
    tpBody &&
    typeof tpBody === "object" &&
    !Array.isArray(tpBody) &&
    "workspace_limits_override_enabled" in (tpBody as Record<string, unknown>)
  ) {
    const raw = (tpBody as Record<string, unknown>).workspace_limits_override_enabled;
    if (raw !== null && typeof raw !== "boolean") {
      return NextResponse.json(
        { error: "Invalid workspace_limits_override_enabled — use boolean or null" },
        { status: 400 }
      );
    }
    const db = await getDb();
    const updateResult = await db.collection<Tenant>("core_tenants").findOneAndUpdate(
      { _id: updated._id },
      raw === null
        ? {
            $unset: { "tenantPreferences.workspace_limits_override_enabled": "" },
            $set: { updatedAt: new Date() }
          }
        : {
            $set: {
              "tenantPreferences.workspace_limits_override_enabled": raw,
              updatedAt: new Date()
            }
          },
      { returnDocument: "after" }
    );
    if (updateResult?._id) {
      updated = updateResult;
    }
  }

  if (
    tpBody &&
    typeof tpBody === "object" &&
    !Array.isArray(tpBody) &&
    "bootstrap_default_portfolio_watchlist" in (tpBody as Record<string, unknown>)
  ) {
    const raw = (tpBody as Record<string, unknown>).bootstrap_default_portfolio_watchlist;
    if (raw !== null && typeof raw !== "boolean") {
      return NextResponse.json(
        { error: "Invalid bootstrap_default_portfolio_watchlist — use boolean or null" },
        { status: 400 }
      );
    }
    const db = await getDb();
    const updateResult = await db.collection<Tenant>("core_tenants").findOneAndUpdate(
      { _id: updated._id },
      raw === null
        ? {
            $unset: { "tenantPreferences.bootstrap_default_portfolio_watchlist": "" },
            $set: { updatedAt: new Date() }
          }
        : {
            $set: {
              "tenantPreferences.bootstrap_default_portfolio_watchlist": raw,
              updatedAt: new Date()
            }
          },
      { returnDocument: "after" }
    );
    if (updateResult?._id) {
      updated = updateResult;
    }
  }

  if (parsed.data.featureFlags !== undefined) {
    const ffParsed = parseFeatureFlagsPayload(parsed.data.featureFlags);
    if (!ffParsed.ok) {
      return NextResponse.json({ error: ffParsed.error }, { status: 400 });
    }
    const before = updated.tenantPreferences?.featureFlags ?? {};
    const afterFlags = await updateTenantFeatureFlags(effectiveTenantHex, ffParsed.value);
    if (afterFlags?._id) {
      updated = afterFlags;
    }
    void createAuditEvent({
      entityType: "tenant",
      entityId: effectiveTenantHex,
      action: "feature_flags_update",
      actor: { userId: session.userId, email: session.email },
      details: { before, after: ffParsed.value }
    }).catch((err: unknown) => {
      console.error("[admin/tenant-preferences] audit write failed", {
        action: "feature_flags_update",
        error: err instanceof Error ? err.message : "Unknown audit error"
      });
    });
  }

  const effective = await resolvedWorkspaceLimitsForTenant(updated);
  const planOverridesOut = await resolveEffectivePlanOverridesForTenant(updated);
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
