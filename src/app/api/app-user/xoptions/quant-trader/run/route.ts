import { NextResponse } from "next/server";
import { z } from "zod";

import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { requireSessionUser } from "@/lib/auth";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey
} from "@/lib/distributed-rate-limit";
import { runMonteCarloTailRiskTool } from "@/modules/xchat/monte-carlo-tail-risk-tool";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  horizonDays: z.number().int().min(1).max(365).optional(),
  minIvRankPct: z.number().int().min(1).max(99).optional(),
  maxDrawdownPct: z.number().int().min(1).max(99).optional(),
  pathCount: z.number().int().min(5000).max(50_000).optional(),
  risk: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  perPortfolioRisk: z.boolean().optional(),
  portfolioScope: z.enum(["all", "workspace"]).optional()
});

const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 8;

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const limit = await checkDistributedRateLimit({
    key: `xoptions:quant-trader:run:${session.tenantId}:${session.userId}:${extractClientRateLimitKey(request)}`,
    windowMs: WINDOW_MS,
    max: MAX_PER_MINUTE
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Quant Trader simulation rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Invalid quant-trader simulation payload." },
      { status: 400 }
    );
  }

  const book = await loadAppUserDefaultBook(session);
  const scopeAll = parsed.data.portfolioScope !== "workspace";
  const perPortfolioRisk = parsed.data.perPortfolioRisk ?? scopeAll;

  const toolArgs: Record<string, unknown> = {
    ...(scopeAll ? { portfolioScope: "all" } : {}),
    horizonDays: parsed.data.horizonDays ?? 45,
    minIvRankPct: parsed.data.minIvRankPct ?? 60,
    maxDrawdownPct: parsed.data.maxDrawdownPct ?? 15,
    pathCount: parsed.data.pathCount ?? 12_000,
    risk: parsed.data.risk ?? "aggressive",
    perPortfolioRisk
  };

  const result = await runMonteCarloTailRiskTool(toolArgs, {
    userId: session.userId,
    tenantId: session.tenantId,
    workspacePortfolioId: book?.portfolioId ?? null
  });

  if (!result.ok) {
    const status =
      result.error === "portfolio_not_found"
        ? 404
        : result.error === "no_equity_book"
          ? 422
          : 400;
    return NextResponse.json(
      { error: result.error, message: result.message, details: result.details ?? null },
      { status }
    );
  }

  return NextResponse.json({ data: result });
}
