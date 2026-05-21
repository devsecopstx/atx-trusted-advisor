import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    isValidXoptionsUnderlyingSymbol,
    normalizeXoptionsUnderlyingSymbol
} from "@/lib/xoptions/xoptions-desk-deep-link";
import { underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";

function pushUniqueSymbol(out: string[], seen: Set<string>, raw: string): void {
  const symbol = normalizeXoptionsUnderlyingSymbol(raw);
  if (!isValidXoptionsUnderlyingSymbol(symbol) || seen.has(symbol)) {
    return;
  }
  seen.add(symbol);
  out.push(symbol);
}

/** Underlying tickers from account holdings (stocks + option underlyings), stable order. */
export function collectOptionsChainSymbolsFromPositions(positions: SerializablePosition[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of positions) {
    if (p.type === "stock") {
      pushUniqueSymbol(out, seen, p.symbol);
      continue;
    }
    if (p.type === "option") {
      pushUniqueSymbol(out, seen, underlyingForYahooOptionsChain(p.symbol));
    }
  }
  return out;
}

export function mergeOptionsChainSymbolList(holdingsSymbols: readonly string[], manualSymbols: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...holdingsSymbols, ...manualSymbols]) {
    pushUniqueSymbol(out, seen, raw);
  }
  return out;
}

export function resolveDefaultOptionsChainSymbol(
  holdingsSymbols: readonly string[],
  querySymbol?: string | null
): string | null {
  const explicit = normalizeXoptionsUnderlyingSymbol(querySymbol ?? "");
  if (explicit && isValidXoptionsUnderlyingSymbol(explicit)) {
    return explicit;
  }
  return holdingsSymbols[0] ?? null;
}
