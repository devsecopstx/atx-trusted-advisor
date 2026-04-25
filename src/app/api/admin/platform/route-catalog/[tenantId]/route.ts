import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { getAppUserRouteCatalog } from "@/modules/platform/app-user-route-catalog";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  overrides: z.record(z.string().min(1), z.boolean().nullable())
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
  return NextResponse.json({
    data: {
      tenantId,
      slug: tenant.slug,
      name: tenant.name,
      overrides,
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
  const catalog = getAppUserRouteCatalog();
  const validIds = new Set(catalog.entries.map((entry) => entry.id));
  const setOverrides: Record<string, boolean> = {};
  const unsetOverrides: Record<string, ""> = {};
  for (const [routeId, value] of Object.entries(parsed.data.overrides)) {
    if (!validIds.has(routeId)) {
      return NextResponse.json({ error: `Unknown route id: ${routeId}` }, { status: 400 });
    }
    if (value === null) {
      unsetOverrides[`tenantPreferences.app_user_route_visibility_overrides.${routeId}`] = "";
      continue;
    }
    setOverrides[`tenantPreferences.app_user_route_visibility_overrides.${routeId}`] = value;
  }
  const update: {
    $set: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = {
    $set: {
      ...setOverrides,
      updatedAt: new Date()
    }
  };
  if (Object.keys(unsetOverrides).length > 0) {
    update.$unset = unsetOverrides;
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
      overrides
    }
  });
}
