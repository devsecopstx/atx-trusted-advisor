import { NextResponse } from "next/server";
import { z } from "zod";

import { adminBrokerSlugSchema, requireKnownBrokerCatalogSlug } from "@/lib/admin/broker-catalog-guard";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    adminCreatePortfolio,
    adminListPortfoliosWithStats
} from "@/modules/core-admin/repository";
import { scoringFactorsPayloadForAdminApi } from "@/modules/core-admin/scoring-factors";
import type { Portfolio } from "@/modules/core-admin/types";
import {
    formatCoreUserDisplayName,
    getCoreUsersByIds,
    normalizeMongoUserIdHex
} from "@/modules/identity/repository";

function serializePortfolio(p: Portfolio) {
  const userId = normalizeMongoUserIdHex(p.userId) ?? "";
  return {
    _id: p._id!.toHexString(),
    tenantId: p.tenantId?.toHexString(),
    userId,
    name: p.name,
    isDefault: p.isDefault,
    tenantPortfolioOrgKey: p.tenantPortfolioOrgKey,
    ext_broker_ref: p.ext_broker_ref,
    broker_type: p.broker_type ?? null,
    riskProfile: p.riskProfile ?? null,
    outlook: p.outlook ?? null,
    ...scoringFactorsPayloadForAdminApi(p.scoringFactors),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString()
  };
}

const postPortfolioSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
  tenantId: z.string().trim().optional(),
  broker_type: adminBrokerSlugSchema.optional()
});

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const rows = await adminListPortfoliosWithStats({ limit: 200 });
  const userIds = [...new Set(rows.map((r) => normalizeMongoUserIdHex(r.userId)).filter((x): x is string => Boolean(x)))];
  const userMap = await getCoreUsersByIds(userIds);
  const data = rows.map((r) => {
    const uidHex = normalizeMongoUserIdHex(r.userId);
    const u = uidHex ? userMap.get(uidHex) : undefined;
    return {
      ...serializePortfolio(r),
      accountCount: r.accountCount,
      totalCashBalance: r.totalCashBalance,
      userDisplayName: formatCoreUserDisplayName(u),
      userEmail: u?.email ?? null
    };
  });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postPortfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.broker_type) {
    const denied = await requireKnownBrokerCatalogSlug(parsed.data.broker_type);
    if (denied) {
      return denied;
    }
  }

  const tenantId = parsed.data.tenantId?.trim() || session.tenantId;
  const created = await adminCreatePortfolio({
    userId: parsed.data.userId,
    tenantId,
    name: parsed.data.name,
    isDefault: parsed.data.isDefault,
    broker_type: parsed.data.broker_type
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Could not create portfolio (duplicate name or invalid user?)" }, { status: 400 });
  }

  return NextResponse.json({ data: serializePortfolio(created) }, { status: 201 });
}
