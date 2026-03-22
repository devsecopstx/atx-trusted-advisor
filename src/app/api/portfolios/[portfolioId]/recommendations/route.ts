import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import {
  createRecommendation,
  listRecommendations
} from "@/modules/core-admin/repository";

 type RouteContext = {
  params: Promise<{
    portfolioId: string;
  }>;
};

const postSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  action: z.enum(["buy", "sell", "hold", "watch"]),
  note: z.string().trim().max(2000).optional(),
  accountId: z.string().trim().min(1).max(64).optional(),
  quantity: z.number().finite().positive().optional(),
  targetPrice: z.number().finite().positive().optional()
});

export async function GET(_: Request, context: RouteContext) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) return session;

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) return denied;

  const rows = await listRecommendations({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });

  const shaped = rows.map((r) => ({
    _id: r._id?.toHexString(),
    symbol: r.symbol,
    action: r.action,
    note: r.note,
    quantity: r.quantity,
    targetPrice: r.targetPrice,
    status: r.status,
    accountId: r.accountId?.toHexString(),
    portfolioId: r.portfolioId.toHexString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  }));

  return NextResponse.json({ data: shaped });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) return session;

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createRecommendation({
    userId: session.userId,
    tenantId: session.tenantId,
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

  const row = {
    _id: created._id.toHexString(),
    symbol: created.symbol,
    action: created.action,
    note: created.note,
    quantity: created.quantity,
    targetPrice: created.targetPrice,
    status: created.status,
    accountId: created.accountId?.toHexString(),
    portfolioId: created.portfolioId.toHexString(),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString()
  };

  return NextResponse.json({ data: row }, { status: 201 });
}