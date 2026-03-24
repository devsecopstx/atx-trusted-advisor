import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import {
  adminDeleteRecommendationForPortfolio,
  adminGetPortfolioById,
  adminUpdateRecommendationForPortfolio
} from "@/modules/core-admin/repository";
import type { Recommendation } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string; recommendationId: string }>;
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

const patchSchema = z
  .object({
    symbol: z.string().trim().min(1).max(32).optional(),
    action: z.enum(["buy", "sell", "hold", "watch"]).optional(),
    note: z.union([z.string().trim().max(2000), z.null()]).optional(),
    quantity: z.union([z.number().finite().positive(), z.null()]).optional(),
    targetPrice: z.union([z.number().finite().positive(), z.null()]).optional(),
    status: z.enum(["new", "accepted", "executed", "dismissed"]).optional()
  })
  .refine(
    (d) =>
      d.symbol !== undefined ||
      d.action !== undefined ||
      d.note !== undefined ||
      d.quantity !== undefined ||
      d.targetPrice !== undefined ||
      d.status !== undefined,
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, recommendationId } = await context.params;
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch: Parameters<typeof adminUpdateRecommendationForPortfolio>[0]["patch"] = {};
  if (parsed.data.symbol !== undefined) patch.symbol = parsed.data.symbol;
  if (parsed.data.action !== undefined) patch.action = parsed.data.action;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note ?? undefined;
  if (parsed.data.quantity !== undefined) {
    patch.quantity = parsed.data.quantity === null ? undefined : parsed.data.quantity;
  }
  if (parsed.data.targetPrice !== undefined) {
    patch.targetPrice = parsed.data.targetPrice === null ? undefined : parsed.data.targetPrice;
  }
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  const updated = await adminUpdateRecommendationForPortfolio({
    portfolioId,
    id: recommendationId,
    patch
  });
  if (!updated?._id) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeRecommendation(updated) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, recommendationId } = await context.params;
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const ok = await adminDeleteRecommendationForPortfolio(portfolioId, recommendationId);
  if (!ok) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
