import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
  patchPortfolioScoringFactorsSchema,
  portfolioScoringFactorsBodySchema,
  scoringFactorsPayloadForAdminApi
} from "@/modules/core-admin/scoring-factors";
import { updateTenantDefaultPortfolioScoringFactors } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

const patchSchema = z.object({
  defaultPortfolioScoringFactors: patchPortfolioScoringFactorsSchema
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

  const stored = tenant.defaultPortfolioScoringFactors ?? null;
  const parsed = stored ? portfolioScoringFactorsBodySchema.safeParse(stored) : null;
  const hasTenantOverride = Boolean(parsed?.success);

  return NextResponse.json({
    data: {
      tenantId: tenant._id.toHexString(),
      slug: tenant.slug,
      hasTenantOverride,
      ...scoringFactorsPayloadForAdminApi(stored)
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

  const raw = parsed.data.defaultPortfolioScoringFactors;
  if (raw === null) {
    const updated = await updateTenantDefaultPortfolioScoringFactors(tenantId.trim(), null);
    if (!updated?._id) {
      return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
    }
    return NextResponse.json({
      data: {
        tenantId: updated._id.toHexString(),
        slug: updated.slug,
        hasTenantOverride: false,
        ...scoringFactorsPayloadForAdminApi(null)
      }
    });
  }

  const factorsParsed = portfolioScoringFactorsBodySchema.safeParse(raw);
  if (!factorsParsed.success) {
    return NextResponse.json(
      { error: "Invalid scoring factors", details: factorsParsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateTenantDefaultPortfolioScoringFactors(tenantId.trim(), factorsParsed.data);
  if (!updated?._id) {
    return NextResponse.json({ error: "Could not update tenant" }, { status: 500 });
  }

  const stored = updated.defaultPortfolioScoringFactors ?? null;
  return NextResponse.json({
    data: {
      tenantId: updated._id.toHexString(),
      slug: updated.slug,
      hasTenantOverride: true,
      ...scoringFactorsPayloadForAdminApi(stored)
    }
  });
}
