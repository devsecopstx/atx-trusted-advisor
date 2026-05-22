import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    portfolioScoringFactorsBodySchema,
    scoringFactorsPayloadForAdminApi
} from "@/modules/core-admin/scoring-factors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const stored = tenant.defaultPortfolioScoringFactors ?? null;
  const parsed = stored ? portfolioScoringFactorsBodySchema.safeParse(stored) : null;
  const hasTenantOverride = Boolean(parsed?.success);

  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      tenantName: tenant.name,
      slug: tenant.slug,
      hasTenantOverride,
      ...scoringFactorsPayloadForAdminApi(stored)
    }
  });
}
