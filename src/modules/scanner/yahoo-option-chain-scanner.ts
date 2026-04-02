import { ObjectId } from "mongodb";

import {
    scannerCircuitAllow,
    scannerCircuitRecordFailure,
    scannerCircuitRecordSuccess
} from "@/modules/scanner/scanner-circuit-breaker";
import {
    getCachedOptionChain,
    setCachedOptionChain,
    type CachedOptionChainPayload
} from "@/modules/scanner/scanner-option-chain-cache";
import { fetchYahooOptionChainForExpiration } from "@/modules/strategy-options/options-chain";

export type YahooOptionChainScannerContext = {
  tenantId?: ObjectId;
};

/**
 * Cached + circuit-guarded Yahoo option chain for scheduled scanners (15m TTL Mongo cache).
 * Falls back to uncached {@link fetchYahooOptionChainForExpiration} when flags disable platform behavior.
 */
export async function fetchYahooOptionChainForScanner(
  ctx: YahooOptionChainScannerContext,
  underlying: string,
  expirationIsoDate: string,
  stockPrice: number,
  daysToExp: number
): Promise<Awaited<ReturnType<typeof fetchYahooOptionChainForExpiration>>> {
  const cached = await getCachedOptionChain(ctx.tenantId, underlying, expirationIsoDate);
  if (cached) {
    return {
      optionChain: cached.optionChain,
      actualExpiration: cached.actualExpiration
    };
  }

  const gate = await scannerCircuitAllow(ctx.tenantId, "yahoo");
  if (!gate.allowed) {
    return null;
  }

  try {
    const result = await fetchYahooOptionChainForExpiration(
      underlying,
      expirationIsoDate,
      stockPrice,
      daysToExp
    );
    await scannerCircuitRecordSuccess(ctx.tenantId, "yahoo");
    if (result && result.optionChain.length > 0) {
      const payload: CachedOptionChainPayload = {
        optionChain: result.optionChain,
        actualExpiration: result.actualExpiration
      };
      await setCachedOptionChain(ctx.tenantId, underlying, expirationIsoDate, payload);
    }
    return result;
  } catch {
    await scannerCircuitRecordFailure(ctx.tenantId, "yahoo");
    return null;
  }
}
