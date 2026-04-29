import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import {
    ensurePortfolioWatchlistForUser,
    getDefaultPortfolio,
    mutatePortfolioWatchlistSymbols,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { parseAccountOutlook } from "@/modules/core-admin/types";
import { MAX_WATCHLIST_SYMBOLS_PER_PATCH } from "@/modules/watchlist/constants";
import {
    WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
    WATCHLIST_ENTRY_DEFAULT_STRATEGY,
    WATCHLIST_UPSERT_DEFAULT_OUTLOOK,
    WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE
} from "@/modules/watchlist/default-upsert-fields";

const tickerRegex = /^[A-Z0-9.\-]{1,32}$/;

const bodySchema = z.object({
  rootTicker: z.string().trim().min(1).max(16),
  symbols: z
    .array(z.string().trim().min(1).max(32))
    .min(1)
    .max(MAX_WATCHLIST_SYMBOLS_PER_PATCH),
  generatedAtIso: z.string().datetime().optional()
});

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

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const root = normalizeTicker(parsed.data.rootTicker);
  if (!root) {
    return NextResponse.json({ error: "Invalid rootTicker" }, { status: 400 });
  }

  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const raw of parsed.data.symbols) {
    const sym = normalizeTicker(raw);
    if (!sym || sym === root || seen.has(sym)) {
      continue;
    }
    seen.add(sym);
    symbols.push(sym);
  }

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols to add" }, { status: 400 });
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

  const genIso = parsed.data.generatedAtIso;
  const stamp = genIso ? ` Report ${genIso.slice(0, 19)}.` : "";
  const existing = new Set((watchlist.symbols ?? []).map((entry) => entry.symbol));

  const addEntries = symbols.map((symbol) => {
    const hasExisting = existing.has(symbol);
    const rationale =
      `[wheel_report_related:${root}] ${symbol} — Related supplier wheel candidate.${stamp}`.slice(0, 4000);
    return {
      symbol,
      rationale,
      rowStatus: "review" as const,
      ...(hasExisting
        ? {}
        : {
            lineType: WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
            strategy: WATCHLIST_ENTRY_DEFAULT_STRATEGY
          })
    };
  });

  const updated = await mutatePortfolioWatchlistSymbols({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    addEntries,
    ...(watchlist.riskProfile == null ? { riskProfile: WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE } : {}),
    ...(parseAccountOutlook(watchlist.outlook) == null ? { outlook: WATCHLIST_UPSERT_DEFAULT_OUTLOOK } : {})
  });

  if (!updated) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  let mergedExisting = 0;
  let addedNew = 0;
  for (const sym of symbols) {
    if (existing.has(sym)) {
      mergedExisting += 1;
    } else {
      addedNew += 1;
    }
  }

  return NextResponse.json({
    data: {
      portfolioId,
      requestedSymbols: symbols.length,
      addedNew,
      mergedExisting,
      watchlistSymbolCount: updated.symbols?.length ?? 0
    }
  });
}
