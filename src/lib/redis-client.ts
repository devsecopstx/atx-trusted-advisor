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

/** One TCP client per resolved URL per Node process (control + cache planes share when URLs match). */
const clientsByResolvedUrl = new Map<string, AtxRedisClient>();

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

const redisDbCoerceWarnUrls = new Set<string>();

/**
 * Managed Redis (Redis Cloud Essentials, many serverless caps) only expose **logical DB 0**.
 * URLs like `redis://…/1` then fail with `ERR DB index is out of range`. atxFinance isolates
 * control vs cache by **key prefix**, not by Redis DB index — safe to use `/0` for every plane.
 *
 * Set **`REDIS_ALLOW_MULTI_DB=1`** (or `true`/`yes`) to keep a non-zero path segment when your
 * server truly supports `SELECT`.
 */
export function normalizeRedisUrlDatabaseToZero(resolved: string): string {
  const allowMultiDbRaw = process.env.REDIS_ALLOW_MULTI_DB?.trim().toLowerCase();
  const allowMultiDb =
    allowMultiDbRaw === "1" || allowMultiDbRaw === "true" || allowMultiDbRaw === "yes";
  if (allowMultiDb) {
    return resolved;
  }
  try {
    const u = new URL(resolved);
    const m = u.pathname.match(/^\/(\d+)$/);
    if (!m) {
      return resolved;
    }
    const idx = Number.parseInt(m[1], 10);
    if (!Number.isFinite(idx) || idx <= 0) {
      return resolved;
    }
    u.pathname = "/0";
    const next = u.toString();
    if (!redisDbCoerceWarnUrls.has(resolved)) {
      redisDbCoerceWarnUrls.add(resolved);
      console.warn(
        `[redis] URL used logical DB /${String(idx)}; coerced to /0 (many hosts only allow DB 0). ` +
          `Plane isolation uses key prefixes, not DB numbers. Set REDIS_ALLOW_MULTI_DB=1 to keep /${String(idx)}.`
      );
    }
    return next;
  } catch {
    return resolved;
  }
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
  const normalized = normalizeRedisUrlDatabaseToZero(resolved);
  if (URL.canParse(normalized)) {
    return normalized;
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

  const sharedClient = clientsByResolvedUrl.get(url);
  if (sharedClient) {
    state.client = sharedClient;
    state.consecutiveFailures = 0;
    state.nextRetryAtMs = 0;
    return sharedClient;
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
      clientsByResolvedUrl.set(url, c);
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
  const controlUrl = getRedisConnectionUrlForPlane("control");
  const cacheUrl = getRedisConnectionUrlForPlane("cache");
  const startupPlanes: RedisPlane[] =
    controlUrl && cacheUrl && controlUrl === cacheUrl ? ["control"] : ["control", "cache"];

  for (const plane of startupPlanes) {
    const url = getRedisConnectionUrlForPlane(plane);
    if (!url) {
      console.info(`[startup/redis/${plane}] skipped — REDIS_URL unset or invalid`);
      continue;
    }
    const h = await checkRedisHealthForPlane(plane);
    if (h.status === "ok") {
      const shared =
        controlUrl && cacheUrl && controlUrl === cacheUrl ? " shared control+cache" : "";
      console.info(
        `[startup/redis/${plane}] ok ping latencyMs=${String(h.latencyMs)}${shared}`
      );
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
  const closed = new Set<AtxRedisClient>();
  for (const plane of ["control", "cache"] as const) {
    const state = planeState[plane];
    state.consecutiveFailures = 0;
    state.nextRetryAtMs = 0;
    const client = state.client;
    state.client = undefined;
    if (!client || closed.has(client)) {
      continue;
    }
    closed.add(client);
    try {
      await client.quit();
    } catch {
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
  clientsByResolvedUrl.clear();
  redisDbCoerceWarnUrls.clear();
}
