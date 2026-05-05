import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { createAuditEvent } from "@/modules/audit/repository";
import type { PlatformRoleForRoutes } from "@/modules/platform/app-user-route-catalog";
import { getAppUserRouteCatalog } from "@/modules/platform/app-user-route-catalog";
import {
    isPathVisibleForRole,
    parseDefaultLandingPathByRole,
    parseRouteVisibilityOverrides
} from "@/modules/platform/tenant-route-policy";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  overrides: z.record(z.string().min(1), z.boolean().nullable()).optional(),
  defaultLandingPathByRole: z
    .object({
      global_admin: z.string().min(1).nullable().optional(),
      advisor: z.string().min(1).nullable().optional(),
      operator: z.string().min(1).nullable().optional(),
      viewer: z.string().min(1).nullable().optional()
    })
    .optional()
}).refine((v) => v.overrides !== undefined || v.defaultLandingPathByRole !== undefined, {
  message: "Provide overrides or defaultLandingPathByRole"
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { tenantId } = await context.params;
  if (!ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant id" }, { status: 400 });
  }
  const db = await getDb();
  const tenant = await db.collection("core_tenants").findOne(
    { _id: new ObjectId(tenantId) },
    { projection: { slug: 1, name: 1, tenantPreferences: 1 } }
  );
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const rawOverrides =
    tenant &&
    typeof tenant === "object" &&
    tenant.tenantPreferences &&
    typeof tenant.tenantPreferences === "object"
      ? (tenant.tenantPreferences as Record<string, unknown>).app_user_route_visibility_overrides
      : undefined;
  const overrides: Record<string, boolean> = {};
  if (rawOverrides && typeof rawOverrides === "object" && !Array.isArray(rawOverrides)) {
    for (const [routeId, value] of Object.entries(rawOverrides)) {
      if (typeof value === "boolean") {
        overrides[routeId] = value;
      }
    }
  }
  const defaultLandingPathByRole = parseDefaultLandingPathByRole(
    (tenant.tenantPreferences as Record<string, unknown> | undefined)?.app_user_default_landing_path_by_role
  );
  return NextResponse.json({
    data: {
      tenantId,
      slug: tenant.slug,
      name: tenant.name,
      overrides,
      defaultLandingPathByRole,
      catalog: getAppUserRouteCatalog()
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const db = await getDb();
  const tenant = await db.collection("core_tenants").findOne(
    { _id: new ObjectId(tenantId) },
    { projection: { slug: 1, name: 1, tenantPreferences: 1 } }
  );
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const catalog = getAppUserRouteCatalog();
  const validIds = new Set(catalog.entries.map((entry) => entry.id));
  const existingOverrides = parseRouteVisibilityOverrides(
    (tenant.tenantPreferences as Record<string, unknown> | undefined)?.app_user_route_visibility_overrides
  );
  const existingLanding = parseDefaultLandingPathByRole(
    (tenant.tenantPreferences as Record<string, unknown> | undefined)?.app_user_default_landing_path_by_role
  );
  const setOverrides: Record<string, boolean> = {};
  const unsetOverrides: Record<string, ""> = {};
  const effectiveOverrides: Record<string, boolean> = {};
  for (const [routeId, visible] of Object.entries(existingOverrides)) {
    if (typeof visible === "boolean") {
      effectiveOverrides[routeId] = visible;
    }
  }
  if (parsed.data.overrides) {
    for (const [routeId, value] of Object.entries(parsed.data.overrides)) {
      if (!validIds.has(routeId)) {
        return NextResponse.json({ error: `Unknown route id: ${routeId}` }, { status: 400 });
      }
      if (value === null) {
        unsetOverrides[`tenantPreferences.app_user_route_visibility_overrides.${routeId}`] = "";
        delete effectiveOverrides[routeId];
        continue;
      }
      setOverrides[`tenantPreferences.app_user_route_visibility_overrides.${routeId}`] = value;
      effectiveOverrides[routeId] = value;
    }
  }

  const setDefaultLanding: Record<string, string> = {};
  const unsetDefaultLanding: Record<string, ""> = {};
  const effectiveLanding: Record<string, string> = { ...existingLanding };
  if (parsed.data.defaultLandingPathByRole) {
    for (const [role, path] of Object.entries(parsed.data.defaultLandingPathByRole)) {
      const typedRole = role as PlatformRoleForRoutes;
      if (path === null) {
        unsetDefaultLanding[`tenantPreferences.app_user_default_landing_path_by_role.${typedRole}`] = "";
        delete effectiveLanding[typedRole];
        continue;
      }
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      if (!isPathVisibleForRole(normalizedPath, typedRole, effectiveOverrides)) {
        return NextResponse.json(
          {
            error: `Default landing path ${normalizedPath} is not visible for role ${typedRole} with current policy`
          },
          { status: 400 }
        );
      }
      setDefaultLanding[`tenantPreferences.app_user_default_landing_path_by_role.${typedRole}`] = normalizedPath;
      effectiveLanding[typedRole] = normalizedPath;
    }
  }

  const update: {
    $set: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = {
    $set: {
      ...setOverrides,
      ...setDefaultLanding,
      updatedAt: new Date()
    }
  };
  const mergedUnset = { ...unsetOverrides, ...unsetDefaultLanding };
  if (Object.keys(mergedUnset).length > 0) {
    update.$unset = mergedUnset;
  }
  const result = await db.collection("core_tenants").findOneAndUpdate(
    { _id: new ObjectId(tenantId) },
    update,
    {
      projection: { slug: 1, name: 1, tenantPreferences: 1 },
      returnDocument: "after"
    }
  );
  if (!result) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  await createAuditEvent({
    entityType: "tenant",
    entityId: tenantId,
    action: "tenant_ux.route_catalog.patch",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      overrides: parsed.data.overrides ?? null,
      defaultLandingPathByRole: parsed.data.defaultLandingPathByRole ?? null
    }
  });
  const raw = (result.tenantPreferences as Record<string, unknown> | undefined)
    ?.app_user_route_visibility_overrides;
  const overrides: Record<string, boolean> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [routeId, value] of Object.entries(raw)) {
      if (typeof value === "boolean") {
        overrides[routeId] = value;
      }
    }
  }
  return NextResponse.json({
    data: {
      tenantId,
      slug: result.slug,
      name: result.name,
      overrides,
      defaultLandingPathByRole: effectiveLanding
    }
  });
}
