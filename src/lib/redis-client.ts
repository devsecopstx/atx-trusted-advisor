import { createClient } from "redis";

export type RedisHealth =
  | { status: "skipped"; reason: "REDIS_URL unset or invalid" }
  | { status: "ok"; latencyMs: number }
  | { status: "error"; message: string };

type AtxRedisClient = ReturnType<typeof createClient>;

type RedisPlane = "control" | "cache";
type RedisPlaneState = {
  client: AtxRedisClient | undefined;
  consecutiveFailures: number;
  nextRetryAtMs: number;
};

const planeState: Record<RedisPlane, RedisPlaneState> = {
  control: {
    client: undefined,
    consecutiveFailures: 0,
    nextRetryAtMs: 0
  },
  cache: {
    client: undefined,
    consecutiveFailures: 0,
    nextRetryAtMs: 0
  }
};

/** OpenSSL / Node TLS when the server speaks plain Redis on the same port (wrong scheme). */
export function isLikelyRedisTlsPlainMismatch(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("packet length too long") ||
    m.includes("tls_get_more_records") ||
    m.includes("wrong version number") ||
    m.includes("0a0000c6")
  );
}

function redissToPlainRedisUrl(redissUrl: string): string {
  return redissUrl.startsWith("rediss://") ? `redis://${redissUrl.slice("rediss://".length)}` : redissUrl;
}

async function destroyRedisAttempt(c: AtxRedisClient): Promise<void> {
  try {
    await c.disconnect();
  } catch {
    /* ignore */
  }
}

/**
 * Optional Redis URL (`redis://` or `rediss://`). Read from `process.env` only so `next build`
 * and CI do not require Redis (same pattern as `getAtxfinanceBackendOrigin`).
 * Use the **same scheme as `redis-cli -u`**: if plain `redis://` works there, use `redis://` in
 * `REDIS_URL` — `rediss://` against a plain endpoint causes TLS parse errors and reconnect spam.
 */
export function getRedisConnectionUrl(): string | undefined {
  return getRedisConnectionUrlForPlane("control");
}

function getRawRedisUrlForPlane(plane: RedisPlane): string | undefined {
  const candidates =
    plane === "control"
      ? [process.env.REDIS_URL_CONTROL, process.env.REDIS_CONTROL_URL, process.env.REDIS_URL]
      : [process.env.REDIS_URL_CACHE, process.env.REDIS_CACHE_URL, process.env.REDIS_URL];
  return candidates.map((v) => v?.trim()).find((v) => Boolean(v));
}

export function getRedisConnectionUrlForPlane(plane: RedisPlane): string | undefined {
  const raw = getRawRedisUrlForPlane(plane);
  if (!raw) {
    return undefined;
  }
  if (!raw.startsWith("redis://") && !raw.startsWith("rediss://")) {
    return undefined;
  }
  const tlsOff = process.env.REDIS_TLS?.trim().toLowerCase();
  const preferPlain =
    tlsOff === "false" || tlsOff === "0" || tlsOff === "off" || tlsOff === "no";
  const resolved = preferPlain && raw.startsWith("rediss://") ? redissToPlainRedisUrl(raw) : raw;
  if (URL.canParse(resolved)) {
    return resolved;
  }
  return undefined;
}

/** TTL for Yahoo batch quote cache keys (seconds). Clamped 5–3600; default 30. */
export function getRedisQuoteCacheTtlSeconds(): number {
  const raw = process.env.REDIS_QUOTE_CACHE_TTL_SECONDS?.trim();
  if (!raw) {
    return 30;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 30;
  }
  return Math.min(3600, Math.max(5, Math.floor(n)));
}

/** TTL for Yahoo quote cache when US regular session is likely closed (seconds). Clamped 60–86400; default 300. */
export function getRedisQuoteCacheTtlClosedSeconds(): number {
  const raw = process.env.REDIS_QUOTE_CACHE_TTL_CLOSED_SECONDS?.trim();
  if (!raw) {
    return 300;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 300;
  }
  return Math.min(86_400, Math.max(60, Math.floor(n)));
}

/**
 * Redis connect timeout (ms). Keeps route-level rate-limit calls from stalling request handlers
 * when Redis is saturated/unreachable. Clamped 100–10000; default 750.
 */
export function getRedisConnectTimeoutMs(): number {
  const raw = process.env.REDIS_CONNECT_TIMEOUT_MS?.trim();
  if (!raw) {
    return 750;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 750;
  }
  return Math.min(10_000, Math.max(100, Math.floor(n)));
}

export async function getRedisClient(): Promise<AtxRedisClient | null> {
  return getRedisClientForPlane("control");
}

function resolveBackoffMs(consecutiveFailures: number): number {
  // 250ms, 500ms, 1s, 2s, 4s ... up to 60s
  const exp = Math.max(0, Math.min(8, consecutiveFailures));
  return Math.min(60_000, 250 * 2 ** exp);
}

export async function getRedisClientForPlane(plane: RedisPlane): Promise<AtxRedisClient | null> {
  const url = getRedisConnectionUrlForPlane(plane);
  if (!url) {
    return null;
  }
  const state = planeState[plane];
  const now = Date.now();
  if (state.nextRetryAtMs > now) {
    return null;
  }
  if (state.client) {
    return state.client;
  }

  const attempts: string[] =
    url.startsWith("rediss://") ? [url, redissToPlainRedisUrl(url)] : [url];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attemptUrl = attempts[i]!;
    const c = createClient({
      url: attemptUrl,
      socket: {
        connectTimeout: getRedisConnectTimeoutMs()
      }
    });
    try {
      await c.connect();
      // Attach only after connect — a failed rediss:// attempt can emit async TLS errors on the
      // socket; logging those from a discarded client caused terminal spam.
      c.on("error", (err) => {
        console.warn(`[redis/${plane}] client error`, err instanceof Error ? err.message : String(err));
      });
      state.client = c;
      state.consecutiveFailures = 0;
      state.nextRetryAtMs = 0;
      if (i > 0) {
        console.info(
          `[redis/${plane}] connected with redis:// — endpoint uses plain TCP; set Redis URL to redis://… to match redis-cli and skip TLS retry`
        );
      }
      return c;
    } catch (error) {
      lastError = error;
      if (typeof c.removeAllListeners === "function") {
        c.removeAllListeners();
      }
      await destroyRedisAttempt(c);
      const msg = error instanceof Error ? error.message : String(error);
      const tryPlain =
        attemptUrl.startsWith("rediss://") &&
        i === 0 &&
        attempts.length > 1 &&
        isLikelyRedisTlsPlainMismatch(msg);
      if (tryPlain) {
        console.warn(
          `[redis/${plane}] TLS handshake failed on rediss:// (server likely speaks plain Redis). Retrying with redis:// …`
        );
        continue;
      }
      break;
    }
  }

  state.consecutiveFailures += 1;
  const backoffMs = resolveBackoffMs(state.consecutiveFailures);
  state.nextRetryAtMs = Date.now() + backoffMs;
  console.warn(
    `[redis/${plane}] connect failed; next retry in ${String(backoffMs)}ms`,
    lastError instanceof Error ? lastError.message : String(lastError)
  );
  return null;
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  return checkRedisHealthForPlane("control");
}

export async function checkRedisHealthForPlane(plane: RedisPlane): Promise<RedisHealth> {
  const url = getRedisConnectionUrlForPlane(plane);
  if (!url) {
    return { status: "skipped", reason: "REDIS_URL unset or invalid" };
  }
  const started = Date.now();
  try {
    const c = await getRedisClientForPlane(plane);
    if (!c) {
      return { status: "error", message: "connect_failed" };
    }
    await c.ping();
    return { status: "ok", latencyMs: Math.max(0, Date.now() - started) };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * One-shot log after Next.js server process starts (see `src/instrumentation.ts`).
 * Does not throw; Redis remains optional when `REDIS_URL` is unset.
 */
export async function logRedisStartupHealthCheck(): Promise<void> {
  for (const plane of ["control", "cache"] as const) {
    const url = getRedisConnectionUrlForPlane(plane);
    if (!url) {
      console.info(`[startup/redis/${plane}] skipped — REDIS_URL unset or invalid`);
      continue;
    }
    const h = await checkRedisHealthForPlane(plane);
    if (h.status === "ok") {
      console.info(`[startup/redis/${plane}] ok ping latencyMs=${String(h.latencyMs)}`);
      continue;
    }
    if (h.status === "skipped") {
      console.info(`[startup/redis/${plane}] skipped — ${h.reason}`);
      continue;
    }
    console.warn(`[startup/redis/${plane}] unhealthy — ${h.message}`);
  }
}

/** Vitest-only: reset process-local singleton + failure flag. */
export async function resetRedisClientForTests(): Promise<void> {
  for (const plane of ["control", "cache"] as const) {
    const state = planeState[plane];
    state.consecutiveFailures = 0;
    state.nextRetryAtMs = 0;
    if (state.client) {
      try {
        await state.client.quit();
      } catch {
        try {
          await state.client.disconnect();
        } catch {
          /* ignore */
        }
      }
      state.client = undefined;
    }
  }
}
