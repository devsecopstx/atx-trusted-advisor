import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { createIbkrRateLimiterFromConfig } from "@/modules/ibkr-integration/rate-limit";

let limiter: ReturnType<typeof createIbkrRateLimiterFromConfig> | null = null;
let lastMaxRpm = -1;

/** In-process sliding window; best-effort on warm Cloud Run instances. */
export function tryConsumeIbkrRateSlot(): boolean {
  const cfg = parseIbkrIntegrationConfig();
  if (cfg.maxRequestsPerMinute !== lastMaxRpm) {
    limiter = createIbkrRateLimiterFromConfig(cfg);
    lastMaxRpm = cfg.maxRequestsPerMinute;
  }
  return limiter!.tryConsume();
}
