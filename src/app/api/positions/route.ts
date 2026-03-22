import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import {
    listPortfolioPositionsByAccount,
    PositionValidationError,
    upsertPositionForAccount
} from "@/modules/core-admin/repository";
import { ObjectId } from "mongodb";

const upsertPositionSchema = z.object({
  portfolioId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  qty: z.number().positive(),
  avgCost: z.number().nonnegative()
});

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const portfolioId = url.searchParams.get("portfolioId")?.trim() ?? "";
  const accountId = url.searchParams.get("accountId")?.trim() ?? "";

  if (!portfolioId || !accountId) {
    return NextResponse.json(
      { error: "Query parameters portfolioId and accountId are required" },
      { status: 400 }
    );
  }

  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  const positions = await listPortfolioPositionsByAccount({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountIds: [new ObjectId(accountId)]
  });

  return NextResponse.json({ data: positions });
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const payload = await request.json();
  const parsed = upsertPositionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const denied = await requireAccountInPortfolio(
    session,
    parsed.data.portfolioId,
    parsed.data.accountId
  );
  if (denied) {
    return denied;
  }

  try {
    const position = await upsertPositionForAccount({
      userId: session.userId,
      tenantId: session.tenantId,
      ...parsed.data
    });
    return NextResponse.json({ data: position }, { status: 201 });
  } catch (error) {
    if (error instanceof PositionValidationError) {
      const status =
        error.code === "ACCOUNT_NOT_FOUND" || error.code === "ACCOUNT_PORTFOLIO_MISMATCH"
          ? 404
          : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
