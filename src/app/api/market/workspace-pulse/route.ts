import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import {
  getWorkspacePulseMacroSnapshotCached,
  resolveWorkspacePulseOptionsGlance
} from "@/modules/market/workspace-pulse-macro-cache";

const MAX_HOLDINGS_GLANCE = 2;

function parseHoldings(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{1,5}$/.test(s));
  return [...new Set(parts)].slice(0, MAX_HOLDINGS_GLANCE);
}

/**
 * GET /api/market/workspace-pulse?holdings=TSLA,AAPL
 * Macro indices (VIX, SPY, QQQ, IWM, DIA, TLT) via `system_index_cache` + Yahoo; not sourced from user watchlists.
 * Yahoo search headlines; optional per-holding options IV/OI glance.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const holdings = parseHoldings(searchParams.get("holdings"));

  const [macroSnapshot, optionsGlance] = await Promise.all([
    getWorkspacePulseMacroSnapshotCached(),
    resolveWorkspacePulseOptionsGlance(holdings)
  ]);

  return NextResponse.json({
    data: {
      market: macroSnapshot.market,
      indices: macroSnapshot.indices,
      news: macroSnapshot.news,
      optionsGlance
    }
  });
}
