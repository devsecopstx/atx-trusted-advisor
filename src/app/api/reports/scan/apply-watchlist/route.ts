import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import {
    adminCreatePortfolioAlert,
    ensurePortfolioWatchlistForUser,
    getDefaultPortfolio,
    mutatePortfolioWatchlistSymbols,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { parseAccountOutlook } from "@/modules/core-admin/types";
import {
    WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
    WATCHLIST_ENTRY_DEFAULT_STRATEGY,
    WATCHLIST_UPSERT_DEFAULT_OUTLOOK,
    WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE
} from "@/modules/watchlist/default-upsert-fields";

const tickerRegex = /^[A-Z0-9.\-]{1,32}$/;

const optionsReportRowSchema = z.object({
  rowId: z.string().trim().min(1).max(160),
  source: z.enum(["holding", "watchlist"]),
  portfolioAccountId: z.string().trim().regex(/^[a-f0-9]{24}$/i).optional(),
  portfolioAccountName: z.string().trim().min(1).max(120).optional(),
  symbol: z.string().trim().min(1).max(32),
  strike: z.number().positive().optional(),
  exp: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["call", "put"]).optional(),
  qty: z.number().finite().optional(),
  recommendedAction: z.enum(["ROLL", "BTC", "HOLD", "LET_EXPIRE", "STC", "OPEN", "MONITOR", "WAIT"]),
  why: z.string().trim().min(1).max(500),
  urgency: z.enum(["high", "med", "low"]),
  targetWindow: z.string().trim().min(1).max(80),
  confidence: z.enum(["high", "medium", "low"]),
  applyToWatchlist: z.object({
    type: z.literal("apply_to_watchlist"),
    symbol: z.string().trim().min(1).max(32),
    allowPriceAlert: z.boolean(),
    defaultPriceAlertSeverity: z.literal("info")
  })
});

const applyWatchlistRowSchema = z.object({
  row: optionsReportRowSchema,
  createPriceAlert: z.boolean().optional(),
  priceAlertMinAbsMovePercent: z.number().min(0.1).max(100).optional(),
  priceAlert: z
    .object({
      severity: z.enum(["info", "warning", "critical"]).optional(),
      title: z.string().trim().min(1).max(200).optional(),
      body: z.string().trim().max(4000).optional()
    })
    .optional()
});

type PortfolioAlertPayload = {
  _id: string;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  symbol: string | null;
  createdAt: string;
};

async function getDefaultPortfolioId(input: {
  userId: string;
  tenantId?: string;
}): Promise<string | null> {
  const existing = await getDefaultPortfolio(input.userId, { tenantId: input.tenantId });
  if (existing?._id) {
    return existing._id.toHexString();
  }
  try {
    const created = await provisionDefaultPortfolioForUser({
      userId: input.userId,
      tenantId: input.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    return created.portfolio._id?.toHexString() ?? null;
  } catch {
    return null;
  }
}

function normalizeTicker(raw: string): string | null {
  const normalized = raw.trim().toUpperCase();
  if (!tickerRegex.test(normalized)) {
    return null;
  }
  return normalized;
}

function defaultAlertBody(input: {
  symbol: string;
  action: string;
  why: string;
  rowId: string;
}): string {
  return `${input.symbol} scan signal: ${input.action}. ${input.why} (row: ${input.rowId})`;
}

function serializeAlert(alert: {
  _id?: { toHexString(): string };
  title: string;
  body?: string;
  severity: "info" | "warning" | "critical";
  symbol?: string;
  createdAt: Date;
}): PortfolioAlertPayload | null {
  if (!alert._id) {
    return null;
  }
  return {
    _id: alert._id.toHexString(),
    title: alert.title,
    body: alert.body ?? null,
    severity: alert.severity,
    symbol: alert.symbol ?? null,
    createdAt: alert.createdAt.toISOString()
  };
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = applyWatchlistRowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const portfolioId = await getDefaultPortfolioId({
    userId: session.userId,
    tenantId: session.tenantId
  });
  if (!portfolioId) {
    return NextResponse.json({ error: "Default portfolio not found" }, { status: 404 });
  }

  const watchlist = await ensurePortfolioWatchlistForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const symbol = normalizeTicker(parsed.data.row.applyToWatchlist.symbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid applyToWatchlist symbol" }, { status: 400 });
  }

  const hasExisting = (watchlist.symbols ?? []).some((entry) => entry.symbol === symbol);
  const watchlistRationale = `[options_scan_report:${parsed.data.row.rowId}] ${parsed.data.row.recommendedAction} - ${parsed.data.row.why}`.slice(
    0,
    4000
  );
  const updated = await mutatePortfolioWatchlistSymbols({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    addEntries: [
      {
        symbol,
        rationale: watchlistRationale,
        rowStatus: "review",
        ...(hasExisting
          ? {}
          : {
              lineType: WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
              strategy: WATCHLIST_ENTRY_DEFAULT_STRATEGY
            }),
        ...(parsed.data.priceAlertMinAbsMovePercent !== undefined
          ? { priceAlertMinAbsMovePercent: parsed.data.priceAlertMinAbsMovePercent }
          : {})
      }
    ],
    ...(watchlist.riskProfile == null
      ? { riskProfile: WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE }
      : {}),
    ...(parseAccountOutlook(watchlist.outlook) == null
      ? { outlook: WATCHLIST_UPSERT_DEFAULT_OUTLOOK }
      : {})
  });
  if (!updated) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  let createdAlert: PortfolioAlertPayload | null = null;
  if (parsed.data.createPriceAlert === true && parsed.data.row.applyToWatchlist.allowPriceAlert) {
    const title =
      parsed.data.priceAlert?.title?.trim() ||
      `${symbol} watchlist alert from options scan`;
    const bodyText = parsed.data.priceAlert?.body?.trim();
    const bodyForAlert =
      bodyText && bodyText.length > 0
        ? bodyText
        : defaultAlertBody({
            symbol,
            action: parsed.data.row.recommendedAction,
            why: parsed.data.row.why,
            rowId: parsed.data.row.rowId
          });
    const created = await adminCreatePortfolioAlert({
      portfolioId,
      title,
      body: bodyForAlert,
      severity:
        parsed.data.priceAlert?.severity ??
        parsed.data.row.applyToWatchlist.defaultPriceAlertSeverity,
      status: "active",
      symbol
    });
    createdAlert = created ? serializeAlert(created) : null;
  }

  return NextResponse.json({
    data: {
      rowId: parsed.data.row.rowId,
      symbol,
      portfolioId,
      watchlist: {
        symbolCount: updated.symbols?.length ?? 0,
        applied: true,
        alreadyPresent: hasExisting
      },
      priceAlert: createdAlert
    }
  });
}
