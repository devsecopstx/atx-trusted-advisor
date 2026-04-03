import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminPortfoliosListAllEnabled, resolveAdminPortfolioListScope } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import {
    adminCreatePortfolio,
    adminListPortfoliosWithStats,
    countPortfoliosForUserInTenant
} from "@/modules/core-admin/repository";
import {
  parsePortfolioScoringFactorsInput,
  scoringFactorsPayloadForAdminApi
} from "@/modules/core-admin/scoring-factors";
import type { Portfolio } from "@/modules/core-admin/types";
import {
    formatCoreUserDisplayName,
    getCoreUsersByIds,
    normalizeMongoUserIdHex
} from "@/modules/identity/repository";

function serializePortfolio(p: Portfolio, tenantDefault?: unknown) {
  const userId = normalizeMongoUserIdHex(p.userId) ?? "";
  return {
    _id: p._id!.toHexString(),
    tenantId: p.tenantId?.toHexString(),
    userId,
    name: p.name,
    isDefault: p.isDefault,
    tenantPortfolioOrgKey: p.tenantPortfolioOrgKey,
    ...scoringFactorsPayloadForAdminApi(p.scoringFactors, tenantDefault),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString()
  };
}

const postPortfolioSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
  tenantId: z.string().trim().optional()
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

  const listScope = resolveAdminPortfolioListScope(session);
  const rows = await adminListPortfoliosWithStats({ limit: 200, listScope });
  const userIds = [...new Set(rows.map((r) => normalizeMongoUserIdHex(r.userId)).filter((x): x is string => Boolean(x)))];
  const userMap = await getCoreUsersByIds(userIds);
  const tenantHexIds = [
    ...new Set(
      rows
        .map((r) => r.tenantId?.toHexString() ?? session.tenantId)
        .filter((id): id is string => Boolean(id && id.length > 0))
    )
  ];
  const tenantByHex = new Map<string, Awaited<ReturnType<typeof getTenantByHexIdCached>>>();
  await Promise.all(
    tenantHexIds.map(async (id) => {
      tenantByHex.set(id, await getTenantByHexIdCached(id));
    })
  );
  const data = rows.map((r) => {
    const uidHex = normalizeMongoUserIdHex(r.userId);
    const u = uidHex ? userMap.get(uidHex) : undefined;
    const tid = r.tenantId?.toHexString() ?? session.tenantId;
    const tenantRow = tid ? tenantByHex.get(tid) : undefined;
    return {
      ...serializePortfolio(r, tenantRow?.defaultPortfolioScoringFactors),
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

  const tenantId = parsed.data.tenantId?.trim() || session.tenantId;
  if (!isAdminPortfoliosListAllEnabled()) {
    if (parsed.data.userId.trim() !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const tenantRow = await getTenantByHexIdCached(tenantId);
  const tenantSf = tenantRow?.defaultPortfolioScoringFactors
    ? parsePortfolioScoringFactorsInput(tenantRow.defaultPortfolioScoringFactors)
    : null;

  const created = await adminCreatePortfolio({
    userId: parsed.data.userId,
    tenantId,
    name: parsed.data.name,
    isDefault: parsed.data.isDefault,
    initialScoringFactors: tenantSf ?? undefined
  });
  if (!created?._id) {
    const limits = await getEffectiveWorkspaceLimitsForUser({
      tenantId,
      userId: parsed.data.userId
    });
    const n = await countPortfoliosForUserInTenant({
      userId: parsed.data.userId,
      tenantId
    });
    if (n >= limits.tenantPortfolioLimit) {
      return NextResponse.json(
        {
          error: `Tenant portfolio limit reached (max ${limits.tenantPortfolioLimit} per user). Raise workspace limits under Admin → Tenant workspace.`,
          code: "workspace_tenant_portfolio_limit_exceeded"
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Could not create portfolio (duplicate name or invalid user?)" }, { status: 400 });
  }

  return NextResponse.json(
    { data: serializePortfolio(created, tenantRow?.defaultPortfolioScoringFactors) },
    { status: 201 }
  );
}
