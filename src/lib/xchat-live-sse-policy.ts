import { shouldProxyPortfolioRequestsToBackend } from "@/lib/backend-bff";
import { shouldRunDirectOptionsScan } from "@/modules/xchat/options-scan-ask-routing";
import {
    isDirectTickerQuoteIntent,
    isShowWatchlistIntent
} from "@/modules/xchat/xchat-ask-routing";

/**
 * Live token SSE for `POST /api/xchat/ask` when `Accept` includes `text/event-stream`.
 *
 * When `XCHAT_STREAM_INTERNAL_SECRET` is set, callers must send matching header
 * `x-xchat-stream-internal` (server-side delegates only — e.g. `/api/xchat/ask/stream`).
 */

/**
 * Client + shell bootstrap: live `/api/xchat/ask/stream` unless `NEXT_PUBLIC_XCHAT_LIVE_SSE` is off.
 */
export function resolveXchatClientLiveSseEnabled(): boolean {
  const envRaw = process.env.NEXT_PUBLIC_XCHAT_LIVE_SSE?.trim().toLowerCase();
  if (envRaw === undefined || envRaw === "") {
    return true;
  }
  return !["0", "false", "no", "off"].includes(envRaw);
}

export function wantsXchatLiveToolLoopSse(request: Request): boolean {
  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  if (!accept.includes("text/event-stream")) {
    return false;
  }
  const disabled = process.env.XCHAT_LIVE_SSE_ENABLED?.trim().toLowerCase();
  if (disabled === "0" || disabled === "false" || disabled === "no") {
    return false;
  }
  const secret = process.env.XCHAT_STREAM_INTERNAL_SECRET?.trim();
  if (secret) {
    return request.headers.get("x-xchat-stream-internal") === secret;
  }
  return true;
}

export function resolveXchatSseHeartbeatMs(): number {
  const raw = Number(process.env.XCHAT_SSE_HEARTBEAT_MS);
  if (Number.isFinite(raw)) {
    return Math.max(5000, Math.min(120_000, Math.floor(raw)));
  }
  return 20_000;
}

export function resolveXchatStreamInternalSecretHeader(): Record<string, string> {
  const secret = process.env.XCHAT_STREAM_INTERNAL_SECRET?.trim();
  return secret ? { "x-xchat-stream-internal": secret } : {};
}

/**
 * When true, `POST /api/xchat/ask/stream` BFF-forwards to Spring (same gate as
 * {@link shouldProxyPortfolioRequestsToBackend} / `ATXFINANCE_BACKEND_ORIGIN` + dev/loopback rules).
 *
 * Set **`XCHAT_SSE_PROXY_BACKEND`** to **`0` / `false` / `no` / `off`** to keep in-process Next streaming even if the
 * product BFF gate is on (explicit opt-out).
 */
/**
 * `POST /api/xchat/ask/stream` stays on Next for deterministic watchlist table + Yahoo batch quotes.
 * Spring SSE returns the table shape but often misses Spot when options-chain Yahoo calls fail.
 */
export function shouldSkipXchatStreamBffForWatchlistShowMessage(message: string): boolean {
  return isShowWatchlistIntent(message);
}

/** Keep deterministic desk paths on Next (`options_scan`, watchlist, ticker quotes via yahoo-finance2). */
export function shouldSkipXchatStreamBffForDeterministicDeskMessage(message: string): boolean {
  return (
    isShowWatchlistIntent(message) ||
    shouldRunDirectOptionsScan(message) ||
    isDirectTickerQuoteIntent(message)
  );
}

export function parseXchatStreamRequestMessage(bodyText: string): string {
  try {
    const json = JSON.parse(bodyText) as { message?: unknown };
    return typeof json.message === "string" ? json.message.trim() : "";
  } catch {
    return "";
  }
}

export function isXchatSseProxyBackendEnabled(): boolean {
  const raw = process.env.XCHAT_SSE_PROXY_BACKEND?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return shouldProxyPortfolioRequestsToBackend();
}
