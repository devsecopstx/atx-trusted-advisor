import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

/** Yahoo may return IV as decimal (0.35) or percent-like (35). */
export function impliedVolatilityPercent(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  const dec = raw <= 2 ? raw : raw / 100;
  return dec * 100;
}

export type HotOptionContractSnapshot = {
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

export type SymbolHotScanResult = {
  symbol: string;
  /** Best contract matching IV&gt;threshold and OI&gt;minOI (nearest expiration group). */
  best: HotOptionContractSnapshot | null;
  /** True if any contract in the scanned group meets IV &gt; ivMinPct and OI &gt; minOi. */
  meetsHotCriteria: boolean;
};

type YahooCallOrPut = {
  strike?: number;
  impliedVolatility?: number;
  openInterest?: number;
};

type YahooOptionGroup = {
  calls?: YahooCallOrPut[];
  puts?: YahooCallOrPut[];
};

/**
 * Scans the nearest Yahoo options expiration for contracts with IV &gt; ivMinPct and OI &gt; minOi.
 * Picks the highest IV among qualifying contracts.
 */
export async function scanUnderlyingForHotOptions(input: {
  symbol: string;
  ivMinPct: number;
  minOi: number;
}): Promise<SymbolHotScanResult> {
  const sym = input.symbol.trim().toUpperCase();
  const yf = getYahooFinance2();
  let best: HotOptionContractSnapshot | null = null;
  let meetsHotCriteria = false;

  try {
    const result = (await yf.options(sym)) as {
      options?: YahooOptionGroup[];
    };
    const group = result.options?.[0];
    if (!group) {
      return { symbol: sym, best: null, meetsHotCriteria: false };
    }

    const consider = (c: YahooCallOrPut, contractType: "call" | "put") => {
      const strike = typeof c.strike === "number" && Number.isFinite(c.strike) ? c.strike : 0;
      const ivPct = impliedVolatilityPercent(c.impliedVolatility);
      const oi = typeof c.openInterest === "number" && Number.isFinite(c.openInterest) ? c.openInterest : 0;
      if (ivPct > input.ivMinPct && oi > input.minOi) {
        meetsHotCriteria = true;
        const cand: HotOptionContractSnapshot = {
          impliedVolatilityPercent: Math.round(ivPct * 10) / 10,
          openInterest: oi,
          strike,
          contractType
        };
        if (!best || cand.impliedVolatilityPercent > best.impliedVolatilityPercent) {
          best = cand;
        }
      }
    };

    for (const c of group.calls ?? []) {
      consider(c, "call");
    }
    for (const p of group.puts ?? []) {
      consider(p, "put");
    }
  } catch {
    return { symbol: sym, best: null, meetsHotCriteria: false };
  }

  return { symbol: sym, best, meetsHotCriteria };
}

export type NearestExpiryOptionsGlance = {
  symbol: string;
  contractType: "call" | "put";
  strike: number;
  impliedVolatilityPercent: number;
  openInterest: number;
};

/**
 * Single “at-a-glance” line for dashboards: highest IV×liquidity (log1p OI)) contract on the nearest expiration.
 */
export async function summarizeNearestExpiryOptionsHighlight(
  symbol: string
): Promise<NearestExpiryOptionsGlance | null> {
  const sym = symbol.trim().toUpperCase();
  const yf = getYahooFinance2();
  try {
    const result = (await yf.options(sym)) as {
      options?: YahooOptionGroup[];
    };
    const group = result.options?.[0];
    if (!group) {
      return null;
    }
    let best: NearestExpiryOptionsGlance | null = null;
    let bestScore = -1;
    const scoreIvOi = (ivPct: number, oi: number) => ivPct * Math.log1p(Math.max(0, oi));

    const consider = (c: YahooCallOrPut, contractType: "call" | "put") => {
      const strike = typeof c.strike === "number" && Number.isFinite(c.strike) ? c.strike : 0;
      if (strike <= 0) {
        return;
      }
      const ivPct = impliedVolatilityPercent(c.impliedVolatility);
      if (ivPct <= 0) {
        return;
      }
      const oi = typeof c.openInterest === "number" && Number.isFinite(c.openInterest) ? c.openInterest : 0;
      const s = scoreIvOi(ivPct, oi);
      if (s > bestScore) {
        bestScore = s;
        best = {
          symbol: sym,
          contractType,
          strike,
          impliedVolatilityPercent: Math.round(ivPct * 10) / 10,
          openInterest: oi
        };
      }
    };

    for (const c of group.calls ?? []) {
      consider(c, "call");
    }
    for (const p of group.puts ?? []) {
      consider(p, "put");
    }
    return best;
  } catch {
    return null;
  }
}
