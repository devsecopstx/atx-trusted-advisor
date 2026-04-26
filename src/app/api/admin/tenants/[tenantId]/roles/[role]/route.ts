import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import { createAuditEvent } from "@/modules/audit/repository";
import type { PlatformRoleForRoutes } from "@/modules/platform/app-user-route-catalog";
import {
    parseTenantRolesByRole,
    validateAllowedRoutesForRole,
    validateDefaultLandingForRole
} from "@/modules/platform/tenant-route-policy";

type RouteContext = {
  params: Promise<{ tenantId: string; role: string }>;
};

const roleSchema = z.enum(["global_admin", "advisor", "operator", "viewer"]);
const patchSchema = z.object({
  allowedRoutes: z.array(z.string().min(1)).optional(),
  defaultLanding: z.string().min(1).optional(),
  flags: z
    .object({
      canMutatePortfolios: z.boolean().optional(),
      canUseXChat: z.boolean().optional(),
      canRunTasks: z.boolean().optional()
    })
    .optional()
});

function defaultPolicyForRole(role: PlatformRoleForRoutes) {
  switch (role) {
    case "global_admin":
      return {
        allowedRoutes: ["/admin", "/xchat", "/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account", "/workspace", "/import-activity"],
        defaultLanding: "/admin",
        flags: { canMutatePortfolios: true, canUseXChat: true, canRunTasks: true }
      };
    case "operator":
      return {
        allowedRoutes: ["/xchat", "/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account", "/workspace", "/import-activity"],
        defaultLanding: "/portfolios",
        flags: { canMutatePortfolios: true, canUseXChat: true, canRunTasks: true }
      };
    case "advisor":
      return {
        allowedRoutes: ["/xchat", "/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account", "/workspace", "/import-activity"],
        defaultLanding: "/xchat",
        flags: { canMutatePortfolios: false, canUseXChat: true, canRunTasks: false }
      };
    case "viewer":
      return {
        allowedRoutes: ["/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account"],
        defaultLanding: "/portfolios",
        flags: { canMutatePortfolios: false, canUseXChat: false, canRunTasks: false }
      };
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { tenantId, role: rawRole } = await context.params;
  const roleParsed = roleSchema.safeParse(rawRole);
  if (!roleParsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const role = roleParsed.data;
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
    { projection: { slug: 1, name: 1, tenantRoles: 1, tenantPreferences: 1 } }
  );
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenantRoles = parseTenantRolesByRole(
    tenant.tenantRoles ??
      (tenant.tenantPreferences as Record<string, unknown> | undefined)?.tenantRoles
  );
  const current = tenantRoles[role] ?? defaultPolicyForRole(role);

  const allowedRoutes = validateAllowedRoutesForRole(parsed.data.allowedRoutes ?? current.allowedRoutes, role);
  if (role === "global_admin" && !allowedRoutes.includes("/admin")) {
    return NextResponse.json({ error: "global_admin must include /admin" }, { status: 400 });
  }
  const defaultLanding = validateDefaultLandingForRole(
    role,
    allowedRoutes,
    parsed.data.defaultLanding ?? current.defaultLanding
  );
  const nextFlags = {
    ...current.flags,
    ...(parsed.data.flags ?? {})
  };
  if (role === "viewer" && nextFlags.canMutatePortfolios) {
    return NextResponse.json({ error: "viewer cannot have mutate privileges" }, { status: 400 });
  }
  const normalizedFlags =
    role === "viewer"
      ? { canMutatePortfolios: false, canUseXChat: false, canRunTasks: false }
      : nextFlags;

  const nextRoles = {
    ...tenantRoles,
    [role]: {
      allowedRoutes,
      defaultLanding,
      flags: normalizedFlags
    }
  };

  const result = await db.collection("core_tenants").findOneAndUpdate(
    { _id: new ObjectId(tenantId) },
    { $set: { tenantRoles: nextRoles, updatedAt: new Date() } },
    { projection: { slug: 1, name: 1 }, returnDocument: "after" }
  );
  if (!result) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  await createAuditEvent({
    entityType: "tenant",
    entityId: tenantId,
    action: "tenant_roles.update",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      mode: "patch_role",
      role,
      policy: nextRoles[role]
    }
  });

  return NextResponse.json({
    data: {
      tenantId,
      slug: result.slug,
      name: result.name,
      role,
      policy: nextRoles[role]
    }
  });
}
