import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { adminCreatePortfolioAlert, adminListPortfolioAlerts } from "@/modules/core-admin/repository";
import type { PortfolioAlert } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializeAlert(a: PortfolioAlert) {
  return {
    _id: a._id!.toHexString(),
    title: a.title,
    body: a.body ?? null,
    severity: a.severity,
    status: a.status,
    symbol: a.symbol ?? null,
    portfolioId: a.portfolioId.toHexString(),
    portfolioName: a.portfolioName ?? null,
    accountId: a.accountId?.toHexString() ?? null,
    accountName: a.accountName ?? null,
    metadata: a.metadata ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(4000).optional(),
  severity: z.enum(["info", "warning", "critical"]),
  status: z.enum(["active", "acknowledged", "dismissed"]).optional(),
  symbol: z.string().trim().max(32).optional(),
  metadata: z.unknown().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
  }

  const rows = await adminListPortfolioAlerts(portfolioId);
  return NextResponse.json({ data: rows.map(serializeAlert) });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const access = await requireAdminPortfolioForApi(portfolioId, session);
  if (access instanceof NextResponse) {
    return access;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await adminCreatePortfolioAlert({
    portfolioId,
    title: parsed.data.title,
    body: parsed.data.body,
    severity: parsed.data.severity,
    status: parsed.data.status,
    symbol: parsed.data.symbol,
    metadata: parsed.data.metadata as PortfolioAlert["metadata"] | undefined
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Could not create alert" }, { status: 400 });
  }

  return NextResponse.json({ data: serializeAlert(created) }, { status: 201 });
}
