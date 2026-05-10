import { NextResponse } from "next/server";
import { z } from "zod";

import { loadTenantForAdminTenantRoute } from "@/app/api/admin/tenants/[tenantId]/admin-tenant-route-load";
import { requireGlobalAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    listTenantRentalApiKeysForAdmin,
    mintTenantRentalApiKey
} from "@/modules/platform/tenant-rental-api-keys";
import type { TenantRentalApiKeyScope } from "@/modules/platform/tenant-rental-types";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const DEFAULT_SCOPES: TenantRentalApiKeyScope[] = ["chat", "strategy", "analyze"];

const mintBodySchema = z.object({
  scopes: z.array(z.enum(["chat", "strategy", "analyze"])).optional(),
  label: z.string().max(128).optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForAdminTenantRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const keys = await listTenantRentalApiKeysForAdmin(tenant._id);
  return NextResponse.json({
    tenantId: tenant._id.toHexString(),
    keys
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForAdminTenantRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = mintBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const scopes = parsed.data.scopes?.length ? parsed.data.scopes : DEFAULT_SCOPES;
  const minted = await mintTenantRentalApiKey({
    tenantId: tenant._id,
    scopes,
    label: parsed.data.label
  });

  if (!minted.ok) {
    const status =
      minted.code === "tenant_not_found"
        ? 404
        : minted.code === "rental_profile_missing" ||
            minted.code === "api_keys_disabled" ||
            minted.code === "rental_expired"
          ? 409
          : 400;
    return NextResponse.json({ error: minted.message, code: minted.code }, { status });
  }

  await createAuditEvent({
    entityType: "tenant",
    entityId: tenant._id.toHexString(),
    action: "rental_ai.api_key.mint",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      keyId: minted.listed.id,
      scopes: minted.listed.scopes,
      label: minted.listed.label ?? null
    }
  }).catch(() => {});

  return NextResponse.json(
    {
      tenantId: tenant._id.toHexString(),
      plaintextKey: minted.plaintextKey,
      key: minted.listed,
      warning: "Store plaintextKey now; it cannot be retrieved later."
    },
    { status: 201 }
  );
}
