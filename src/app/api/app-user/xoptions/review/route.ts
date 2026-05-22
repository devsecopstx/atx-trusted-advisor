import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { parseYahooOptionContractId, toYahooOptionContractId } from "@/lib/xoptions/xoptions-contract-id";
import type { XoptionsOpeningAction } from "@/lib/xoptions/xoptions-order-preview";
import type { XoptionsPortfolioContext } from "@/lib/xoptions/xoptions-review-types";
import { archiveAdvisorXoptionsAdviceIfRequired } from "@/modules/compliance/advisor-advice-events";
import { getFindOptionsContext, getTopStockHoldingsByValue } from "@/modules/find-options/find-options-service";
import { isAdvisorPlatformRole, isGlobalAdmin } from "@/modules/identity/authorization";
import { getStrategyOptionsChain } from "@/modules/strategy-options/options-chain";
import { assembleXoptionsReviewPayload } from "@/modules/xoptions/xoptions-review-assembler";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  symbol: z.string().min(1),
  contractId: z.string().optional(),
  expiration: z.string().optional(),
  strike: z.coerce.number().positive().optional(),
  side: z.enum(["call", "put"]).optional(),
  limitPrice: z.string().optional(),
  quantity: z.string().optional(),
  openingAction: z.enum(["buy_to_open", "sell_to_open"]).optional(),
  strategyLabel: z.string().optional(),
  outlook: z.string().optional(),
  riskProfile: z.string().optional()
});

function parseEarningsDateIso(quote: Record<string, unknown>): string | null {
  const direct = quote["earningsTimestamp"];
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return new Date(direct * 1000).toISOString();
  }
  const next = quote["earningsTimestampStart"];
  if (typeof next === "number" && Number.isFinite(next) && next > 0) {
    return new Date(next * 1000).toISOString();
  }
  return null;
}

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "invalid_query", details: parsedQuery.error.flatten() }, { status: 400 });
  }

  const q = parsedQuery.data;
  const symbol = q.symbol.trim().toUpperCase();
  const parsedContract = q.contractId ? parseYahooOptionContractId(q.contractId) : null;
  if (q.contractId && !parsedContract) {
    return NextResponse.json({ error: "invalid_contract_id" }, { status: 400 });
  }
  if (parsedContract && parsedContract.underlying !== symbol) {
    return NextResponse.json({ error: "contract_symbol_mismatch" }, { status: 400 });
  }

  const expiration = parsedContract?.expirationYyyyMmDd ?? q.expiration?.trim() ?? "";
  const strike = parsedContract?.strike ?? q.strike;
  const side = parsedContract?.side ?? q.side;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration) || strike == null || !side) {
    return NextResponse.json({ error: "missing_contract_fields" }, { status: 400 });
  }

  const chainResponse = await getStrategyOptionsChain(
    `${new URL(request.url).origin}/api/strategy-options?underlying=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}`
  );
  const chainJson = (await chainResponse.json()) as {
    stockPrice?: number;
    optionChain?: Array<{
      strike: number;
      call: { implied_volatility?: number; greeks?: { delta?: number } } | null;
      put: { implied_volatility?: number; greeks?: { delta?: number } } | null;
    }>;
  };
  const spot = chainJson.stockPrice;
  if (spot == null || !Number.isFinite(spot) || spot <= 0) {
    return NextResponse.json({ error: "spot_unavailable" }, { status: 503 });
  }

  const row = chainJson.optionChain?.find((entry) => entry.strike === strike);
  const leg = row ? (side === "call" ? row.call : row.put) : null;
  const holdings = await getTopStockHoldingsByValue(session, 50);
  const symbolHolding = holdings.holdings.find((h) => h.symbol === symbol);
  const holdingSharesForSymbol = symbolHolding?.shares ?? null;
  const portfolioApproxValueUsd = holdings.holdings.reduce(
    (sum, row) => sum + (Number.isFinite(row.marketValue) ? row.marketValue : 0),
    0
  );

  const openingAction = (q.openingAction ?? "buy_to_open") as XoptionsOpeningAction;

  const findOptionsCtx = await getFindOptionsContext(session);
  const securedNotionalPreview =
    openingAction === "sell_to_open" && strike > 0
      ? strike * Math.max(1, Number.parseInt(q.quantity?.trim() || "1", 10) || 1) * 100
      : null;
  const cashBalanceUsd = findOptionsCtx.account.cashBalance;
  const portfolioContext: XoptionsPortfolioContext = {
    portfolioName: findOptionsCtx.portfolio?.name ?? null,
    cashBalanceUsd,
    cashCollateralPctOfCash:
      securedNotionalPreview != null && cashBalanceUsd != null && cashBalanceUsd > 0
        ? (securedNotionalPreview / cashBalanceUsd) * 100
        : null,
    symbolMarketValueUsd:
      symbolHolding != null && Number.isFinite(symbolHolding.marketValue) ? symbolHolding.marketValue : null,
    symbolPctOfPortfolio:
      symbolHolding != null &&
      portfolioApproxValueUsd > 0 &&
      Number.isFinite(symbolHolding.marketValue)
        ? (symbolHolding.marketValue / portfolioApproxValueUsd) * 100
        : null
  };

  let earningsDateIso: string | null = null;
  try {
    const quote = (await yahooQuoteWithValidationFallback(
      getYahooFinance2(),
      symbol,
      "xoptions review"
    )) as Record<string, unknown>;
    earningsDateIso = parseEarningsDateIso(quote);
  } catch {
    earningsDateIso = null;
  }

  const contractId =
    q.contractId?.trim() ||
    toYahooOptionContractId({
      underlying: symbol,
      expirationYyyyMmDd: expiration,
      side,
      strike
    });

  const isAdvisorSession =
    !isGlobalAdmin(session.roles) && isAdvisorPlatformRole(session.roles);

  const payload = assembleXoptionsReviewPayload({
    symbol,
    contractId,
    expirationYyyyMmDd: expiration,
    side,
    openingAction,
    strike,
    limitPrice: q.limitPrice?.trim() || "0",
    quantity: q.quantity?.trim() || "1",
    spot,
    impliedVolatilityPercent: leg?.implied_volatility ?? null,
    strategyLabel: q.strategyLabel?.trim() || null,
    legDelta: leg?.greeks?.delta ?? null,
    portfolioApproxValueUsd: portfolioApproxValueUsd > 0 ? portfolioApproxValueUsd : null,
    holdingSharesForSymbol,
    earningsDateIso,
    auditTrail: {
      weights: [],
      outlook: q.outlook?.trim() || null,
      riskProfile: q.riskProfile?.trim() || null
    },
    portfolioContext
  });

  if (isAdvisorSession) {
    archiveAdvisorXoptionsAdviceIfRequired({
      roles: session.roles,
      tenantId: session.tenantId,
      userId: session.userId,
      surface: "xoptions_review",
      artifactKind: "order_review",
      prompt: JSON.stringify({
        symbol,
        contractId,
        expiration,
        strike,
        side,
        openingAction,
        strategyLabel: q.strategyLabel?.trim() || null
      }),
      responsePayload: payload as unknown as Record<string, unknown>,
      metadata: {
        outlook: q.outlook?.trim() || null,
        riskProfile: q.riskProfile?.trim() || null
      }
    });
  }

  return NextResponse.json({ data: payload });
}
