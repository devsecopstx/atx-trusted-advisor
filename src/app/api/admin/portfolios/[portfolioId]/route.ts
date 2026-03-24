import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    adminDeletePortfolio,
    adminGetPortfolioById,
    adminListAccountsForPortfolio,
    adminUpdatePortfolio,
    DEFAULT_ACCOUNT_CASH_BALANCE
} from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializePortfolio(p: Portfolio) {
  return {
    _id: p._id!.toHexString(),
    tenantId: p.tenantId?.toHexString(),
    userId: p.userId,
    name: p.name,
    isDefault: p.isDefault,
    tenantPortfolioOrgKey: p.tenantPortfolioOrgKey,
    ext_broker_ref: p.ext_broker_ref,
    broker_type: p.broker_type ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString()
  };
}

const patchPortfolioSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ext_broker_ref: z.union([z.string(), z.null()]).optional(),
  broker_type: z.union([z.enum(["merrill", "fidelity", "etrade"]), z.null()]).optional(),
  isDefault: z.literal(true).optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const { portfolioId } = await context.params;
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const accounts = await adminListAccountsForPortfolio(portfolioId);
  const accountCount = accounts.length;
  const totalCashBalance = accounts.reduce((sum, a) => {
    const b =
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance)
        ? a.cashBalance
        : DEFAULT_ACCOUNT_CASH_BALANCE;
    return sum + b;
  }, 0);

  return NextResponse.json({
    data: {
      ...serializePortfolio(portfolio),
      accountCount,
      totalCashBalance
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchPortfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;
  const hasPayload =
    p.name !== undefined ||
    p.ext_broker_ref !== undefined ||
    p.broker_type !== undefined ||
    p.isDefault === true;
  if (!hasPayload) {
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
  }

  const updated = await adminUpdatePortfolio({
    portfolioId,
    name: p.name,
    ext_broker_ref: p.ext_broker_ref,
    broker_type: p.broker_type,
    isDefault: p.isDefault
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializePortfolio(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const ok = await adminDeletePortfolio(portfolioId);
  if (!ok) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
