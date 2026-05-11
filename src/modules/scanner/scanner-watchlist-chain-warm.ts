import { ObjectId } from "mongodb";

import { normalizeScannerSymbol } from "@/modules/scanner/phase3-scanner-shared";
import { fetchYahooOptionChainForScanner } from "@/modules/scanner/yahoo-option-chain-scanner";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";

function chainWarmEnabled(): boolean {
  const v = String(process.env.PHASE3_WATCHLIST_CHAIN_WARM ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function parseWarmMaxSymbols(): number {
  const raw = process.env.PHASE3_CHAIN_WARM_MAX_SYMBOLS;
  const n = raw ? Number.parseInt(raw.trim(), 10) : 40;
  if (!Number.isFinite(n) || n <= 0) {
    return 40;
  }
  return Math.min(n, 120);
}

function parseWarmTargetDte(): number {
  const raw = process.env.PHASE3_CHAIN_WARM_TARGET_DTE;
  const n = raw ? Number.parseInt(raw.trim(), 10) : 21;
  if (!Number.isFinite(n) || n < 1 || n > 180) {
    return 21;
  }
  return n;
}

/**
 * Background-style chain prefetch for equity symbols (watchlist + holdings paths).
 * Uses Mongo `scanner_option_chain_cache` via {@link fetchYahooOptionChainForScanner} (TTL per env).
 * Opt-in: `PHASE3_WATCHLIST_CHAIN_WARM=true`.
 */
export async function warmOptionChainsForEquitySymbols(input: {
  tenantId?: ObjectId;
  symbols: string[];
}): Promise<{ warmed: number; attempted: number }> {
  if (!chainWarmEnabled()) {
    return { warmed: 0, attempted: 0 };
  }
  const maxSyms = parseWarmMaxSymbols();
  const dte = parseWarmTargetDte();
  const slice = [...new Set(input.symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    maxSyms
  );
  if (slice.length === 0) {
    return { warmed: 0, attempted: 0 };
  }
  const quotes = await getYahooBatchQuotes(slice);
  let warmed = 0;
  for (const q of quotes) {
    const sym = normalizeScannerSymbol(q.symbol);
    const px = q.price;
    if (!sym || typeof px !== "number" || !Number.isFinite(px) || px <= 0) {
      continue;
    }
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + dte);
    const expIso = target.toISOString().slice(0, 10);
    const daysToExp = Math.max(1, dte);
    const result = await fetchYahooOptionChainForScanner(
      { tenantId: input.tenantId },
      sym,
      expIso,
      px,
      daysToExp
    );
    if (result && Array.isArray(result.optionChain) && result.optionChain.length > 0) {
      warmed += 1;
    }
  }
  return { warmed, attempted: slice.length };
}
