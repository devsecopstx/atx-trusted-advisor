/**
 * Phase 3 scanner platform — env parsing (single place for tests + runtime).
 */

export function isOptionsChainCacheEnabled(): boolean {
  return process.env.OPTIONS_CHAIN_CACHE_ENABLED !== "false" && process.env.OPTIONS_CHAIN_CACHE_ENABLED !== "0";
}

/** TTL for Mongo `scanner_option_chain_cache`; default 900s (15m). */
export function optionsChainCacheTtlSeconds(): number {
  const n = Number.parseInt(process.env.OPTIONS_CHAIN_CACHE_TTL_SEC ?? "900", 10);
  return Number.isFinite(n) && n >= 60 && n <= 86_400 ? n : 900;
}

export function isScannerCircuitBreakerEnabled(): boolean {
  return process.env.SCANNER_CIRCUIT_BREAKER_ENABLED !== "false" && process.env.SCANNER_CIRCUIT_BREAKER_ENABLED !== "0";
}

/** Cooldown when circuit opens; default 900s. */
export function scannerCircuitCooldownSeconds(): number {
  const sec = Number.parseInt(process.env.SCANNER_CIRCUIT_COOLDOWN_SEC ?? "900", 10);
  return Number.isFinite(sec) && sec >= 60 && sec <= 7200 ? sec : 900;
}

export function scannerCircuitFailureThreshold(): number {
  const n = Number.parseInt(process.env.SCANNER_CIRCUIT_FAILURE_THRESHOLD ?? "3", 10);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? n : 3;
}
