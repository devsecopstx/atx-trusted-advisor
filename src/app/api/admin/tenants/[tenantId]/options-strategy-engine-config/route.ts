import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { createAuditEvent } from "@/modules/audit/repository";
import { updateTenantOptionsStrategyEngineConfig } from "@/modules/identity/repository";
import {
    getTenantOptionsStrategyEngineConfigStored,
    optionsStrategyEngineConfigPayloadForApi,
    parseTenantOptionsStrategyEngineConfigStored
} from "@/modules/strategy-options/tenant-options-strategy-engine-config";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  optionsStrategyEngineConfig: z.unknown()
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await getTenantByHexIdCached(tenantId.trim());
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      slug: tenant.slug,
      ...optionsStrategyEngineConfigPayloadForApi(tenant)
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await getTenantByHexIdCached(tenantId.trim());
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

  const raw = parsed.data.optionsStrategyEngineConfig;
  if (raw === null) {
    const before = getTenantOptionsStrategyEngineConfigStored(tenant);
    const updated = await updateTenantOptionsStrategyEngineConfig(tenantId.trim(), null);
    if (!updated?._id) {
      return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
    }
    void createAuditEvent({
      entityType: "tenant",
      entityId: tenantId.trim(),
      action: "options_strategy_engine_config_clear",
      actor: { userId: session.userId, email: session.email },
      details: { before, after: null }
    }).catch(() => undefined);
    return NextResponse.json({
      data: {
        tenantId: updated._id.toHexString(),
        slug: updated.slug,
        ...optionsStrategyEngineConfigPayloadForApi(updated)
      }
    });
  }

  const configParsed = parseTenantOptionsStrategyEngineConfigStored(raw);
  if (!configParsed.ok) {
    return NextResponse.json({ error: configParsed.error }, { status: 400 });
  }

  const before = getTenantOptionsStrategyEngineConfigStored(tenant);
  const updated = await updateTenantOptionsStrategyEngineConfig(tenantId.trim(), configParsed.value);
  if (!updated?._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }

  void createAuditEvent({
    entityType: "tenant",
    entityId: tenantId.trim(),
    action: "options_strategy_engine_config_update",
    actor: { userId: session.userId, email: session.email },
    details: { before, after: configParsed.value }
  }).catch(() => undefined);

  return NextResponse.json({
    data: {
      tenantId: updated._id.toHexString(),
      slug: updated.slug,
      ...optionsStrategyEngineConfigPayloadForApi(updated)
    }
  });
}
