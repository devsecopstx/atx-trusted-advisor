import { ObjectId } from "mongodb";

import {
    scannerCircuitAllow,
    scannerCircuitRecordFailure,
    scannerCircuitRecordSuccess
} from "@/modules/scanner/scanner-circuit-breaker";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

/**
 * Single-symbol Yahoo quote for scanner loops — shares circuit breaker with option-chain fetches.
 */
export async function quoteUnderlyingForScanner(
  tenantId: ObjectId | undefined,
  symbol: string
): Promise<{ regularMarketPrice?: number; postMarketPrice?: number } | null> {
  const gate = await scannerCircuitAllow(tenantId, "yahoo");
  if (!gate.allowed) {
    return null;
  }
  const yahoo = getYahooFinance2();
  try {
    const q = (await yahoo.quote(symbol)) as {
      regularMarketPrice?: number;
      postMarketPrice?: number;
    };
    await scannerCircuitRecordSuccess(tenantId, "yahoo");
    return q;
  } catch {
    await scannerCircuitRecordFailure(tenantId, "yahoo");
    return null;
  }
}
