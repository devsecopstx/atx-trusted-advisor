import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { parseXfUiThemePreferenceFromUnknown } from "@/lib/xf-ui-theme";
import {
    applyTenantShellPreferencesPatch,
    resolvedWorkspaceLimitsForTenant,
    resolveTenantIdHexForGlobalAdminConsole,
    updateTenantBrandingPreferencesOneTime,
    updateTenantWorkspaceLimits,
    updateTenantXchatDebugEnabled,
    updateTenantXfUiThemePreference
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
  const tenant = await loadTenantForWorkspaceLimitsRoute(tenantId, session.tenantId);
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
