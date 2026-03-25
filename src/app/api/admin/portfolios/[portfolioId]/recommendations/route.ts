import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    adminCreateRecommendationForPortfolio,
    adminGetPortfolioById,
    adminListRecommendationsForPortfolio
} from "@/modules/core-admin/repository";
import type { Recommendation } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializeRecommendation(r: Recommendation) {
  return {
    _id: r._id!.toHexString(),
    symbol: r.symbol,
    action: r.action,
    note: r.note ?? null,
    quantity: r.quantity ?? null,
    targetPrice: r.targetPrice ?? null,
    status: r.status,
    accountId: r.accountId?.toHexString() ?? null,
    portfolioId: r.portfolioId.toHexString(),
    userId: normalizeMongoUserIdHex(r.userId) ?? r.userId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  };
}

const postSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  action: z.enum(["buy", "sell", "hold", "watch"]),
  note: z.string().trim().max(2000).optional(),
  accountId: z.string().trim().min(1).max(64).optional(),
  quantity: z.number().finite().positive().optional(),
  targetPrice: z.number().finite().positive().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const rows = await adminListRecommendationsForPortfolio(portfolioId);
  return NextResponse.json({ data: rows.map(serializeRecommendation) });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
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

  const created = await adminCreateRecommendationForPortfolio({
    portfolioId,
    symbol: parsed.data.symbol,
    action: parsed.data.action,
    note: parsed.data.note,
    accountId: parsed.data.accountId,
    quantity: parsed.data.quantity,
    targetPrice: parsed.data.targetPrice
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Could not create recommendation" }, { status: 400 });
  }

  return NextResponse.json({ data: serializeRecommendation(created) }, { status: 201 });
}
