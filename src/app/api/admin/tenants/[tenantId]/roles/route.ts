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
    validateDefaultLandingForRole,
    type TenantRoleFlags,
    type TenantRolesByRole
} from "@/modules/platform/tenant-route-policy";
import { bustTenantUxPolicyCacheForTenant } from "@/modules/platform/tenant-ux-policy-cache";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const flagsSchema = z
  .object({
    canMutatePortfolios: z.boolean().optional(),
    canUseXChat: z.boolean().optional(),
    canRunTasks: z.boolean().optional()
  })
  .optional();

const rolePolicySchema = z.object({
  allowedRoutes: z.array(z.string().min(1)).min(1),
  defaultLanding: z.string().min(1),
  flags: flagsSchema
});

const putSchema = z.object({
  roles: z.object({
    global_admin: rolePolicySchema,
    advisor: rolePolicySchema,
    operator: rolePolicySchema,
    viewer: rolePolicySchema
  })
});

const ROLE_ORDER: PlatformRoleForRoutes[] = ["global_admin", "advisor", "operator", "viewer"];

function defaultPolicyForRole(role: PlatformRoleForRoutes): {
  allowedRoutes: string[];
  defaultLanding: string;
  flags: TenantRoleFlags;
} {
  switch (role) {
    case "global_admin":
      return {
        allowedRoutes: [
          "/admin",
          "/xchat",
          "/xcoach",
          "/portfolio",
          "/portfolios",
          "/watchlist",
          "/xoptions",
          "/account",
          "/workspace",
          "/import-activity",
          "/resources"
        ],
        defaultLanding: "/xchat",
        flags: { canMutatePortfolios: true, canUseXChat: true, canRunTasks: true }
      };
    case "operator":
      return {
        allowedRoutes: [
          "/xchat",
          "/xcoach",
          "/portfolio",
          "/portfolios",
          "/watchlist",
          "/xoptions",
          "/account",
          "/workspace",
          "/import-activity",
          "/resources"
        ],
        defaultLanding: "/xchat",
        flags: { canMutatePortfolios: true, canUseXChat: true, canRunTasks: true }
      };
    case "advisor":
      return {
        allowedRoutes: [
          "/xchat",
          "/xcoach",
          "/portfolio",
          "/portfolios",
          "/watchlist",
          "/xoptions",
          "/account",
          "/workspace",
          "/import-activity",
          "/resources"
        ],
        defaultLanding: "/xchat",
        flags: { canMutatePortfolios: false, canUseXChat: true, canRunTasks: false }
      };
    case "viewer":
      return {
        allowedRoutes: ["/xchat", "/xcoach", "/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account", "/resources"],
        defaultLanding: "/xchat",
        flags: { canMutatePortfolios: false, canUseXChat: false, canRunTasks: false }
      };
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

function resolveMergedTenantRoles(stored: TenantRolesByRole): TenantRolesByRole {
  const out: TenantRolesByRole = {};
  for (const role of ROLE_ORDER) {
    const fallback = defaultPolicyForRole(role);
    const policy = stored[role];
    const allowedRoutes = validateAllowedRoutesForRole(policy?.allowedRoutes ?? fallback.allowedRoutes, role);
    out[role] = {
      allowedRoutes,
      defaultLanding: validateDefaultLandingForRole(role, allowedRoutes, policy?.defaultLanding ?? fallback.defaultLanding),
      flags: mergeFlags(role, fallback.flags, policy?.flags)
    };
  }
  return out;
}

function mergeFlags(
  role: PlatformRoleForRoutes,
  defaults: TenantRoleFlags,
  raw: z.infer<typeof flagsSchema>
): TenantRoleFlags {
  const merged: TenantRoleFlags = {
    canMutatePortfolios: raw?.canMutatePortfolios ?? defaults.canMutatePortfolios,
    canUseXChat: raw?.canUseXChat ?? defaults.canUseXChat,
    canRunTasks: raw?.canRunTasks ?? defaults.canRunTasks
  };
  if (role === "viewer") {
    return {
      canMutatePortfolios: false,
      canUseXChat: false,
      canRunTasks: false
    };
  }
  return merged;
}

function normalizeTenantRoles(raw: z.infer<typeof putSchema>["roles"]): TenantRolesByRole {
  const out: TenantRolesByRole = {};
  for (const role of ROLE_ORDER) {
    const input = raw[role];
    const fallback = defaultPolicyForRole(role);
    const allowedRoutes = validateAllowedRoutesForRole(input.allowedRoutes, role);
    if (role === "global_admin" && !allowedRoutes.includes("/admin")) {
      throw new Error("global_admin must include /admin");
    }
    const defaultLanding = validateDefaultLandingForRole(role, allowedRoutes, input.defaultLanding);
    const flags = mergeFlags(role, fallback.flags, input.flags);
    out[role] = { allowedRoutes, defaultLanding, flags };
  }
  return out;
}

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
  const tenantRoles = parseTenantRolesByRole(
    tenant.tenantRoles ??
      (tenant.tenantPreferences as Record<string, unknown> | undefined)?.tenantRoles
  );
  const mergedRoles = resolveMergedTenantRoles(tenantRoles);
  return NextResponse.json({
    data: {
      tenantId,
      slug: tenant.slug,
      name: tenant.name,
      roles: mergedRoles
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
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
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let normalized: TenantRolesByRole;
  try {
    normalized = normalizeTenantRoles(parsed.data.roles);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid role policy" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection("core_tenants").findOneAndUpdate(
    { _id: new ObjectId(tenantId) },
    { $set: { tenantRoles: normalized, updatedAt: new Date() } },
    { projection: { _id: 1, slug: 1, name: 1 }, returnDocument: "after" }
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
      mode: "replace_all",
      roles: normalized
    }
  });
  const bust = await bustTenantUxPolicyCacheForTenant(tenantId, "roles_update");
  await createAuditEvent({
    entityType: "tenant",
    entityId: tenantId,
    action: "tenant_ux.policy_cache_bust",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      trigger: "roles_update",
      ...bust
    }
  });

  return NextResponse.json({
    data: {
      tenantId,
      slug: result.slug,
      name: result.name,
      roles: normalized
    }
  });
}
