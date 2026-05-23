import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { optionsStrategyEngineConfigPayloadForApi } from "@/modules/strategy-options/tenant-options-strategy-engine-config";

export const dynamic = "force-dynamic";

/** Read-only tenant OptionsStrategyEngine policy for desk / compliance review. */
export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      tenantName: tenant.name,
      slug: tenant.slug,
      readOnly: true,
      ...optionsStrategyEngineConfigPayloadForApi(tenant)
    }
  });
}
