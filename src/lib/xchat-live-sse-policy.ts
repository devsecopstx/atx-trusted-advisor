/**
 * Live token SSE for `POST /api/xchat/ask` when `Accept` includes `text/event-stream`.
 *
 * When `XCHAT_STREAM_INTERNAL_SECRET` is set, callers must send matching header
 * `x-xchat-stream-internal` (server-side delegates only — e.g. `/api/xchat/ask/stream`).
 */

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

export function isXchatSseProxyBackendEnabled(): boolean {
  const raw = process.env.XCHAT_SSE_PROXY_BACKEND?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
