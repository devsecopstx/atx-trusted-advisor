import { createClient } from "redis";

export type RedisHealth =
  | { status: "skipped"; reason: "REDIS_URL unset or invalid" }
  | { status: "ok"; latencyMs: number }
  | { status: "error"; message: string };

type AtxRedisClient = ReturnType<typeof createClient>;

let client: AtxRedisClient | undefined;
let connectFailed = false;

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
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) {
    return undefined;
  }
  if (!raw.startsWith("redis://") && !raw.startsWith("rediss://")) {
    return undefined;
  }
  if (URL.canParse(raw)) {
    return raw;
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

export async function getRedisClient(): Promise<AtxRedisClient | null> {
  const url = getRedisConnectionUrl();
  if (!url) {
    return null;
  }
  if (connectFailed) {
    return null;
  }
  if (client) {
    return client;
  }

  const attempts: string[] =
    url.startsWith("rediss://") ? [url, redissToPlainRedisUrl(url)] : [url];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attemptUrl = attempts[i]!;
    const c = createClient({ url: attemptUrl });
    c.on("error", (err) => {
      console.warn("[redis] client error", err instanceof Error ? err.message : String(err));
    });
    try {
      await c.connect();
      client = c;
      if (i > 0) {
        console.info(
          "[redis] connected with redis:// — endpoint uses plain TCP; set REDIS_URL to redis://… to match redis-cli and skip TLS retry"
        );
      }
      return c;
    } catch (error) {
      lastError = error;
      await destroyRedisAttempt(c);
      const msg = error instanceof Error ? error.message : String(error);
      const tryPlain =
        attemptUrl.startsWith("rediss://") &&
        i === 0 &&
        attempts.length > 1 &&
        isLikelyRedisTlsPlainMismatch(msg);
      if (tryPlain) {
        console.warn(
          "[redis] TLS handshake failed on rediss:// (server likely speaks plain Redis). Retrying with redis:// …"
        );
        continue;
      }
      break;
    }
  }

  connectFailed = true;
  console.warn(
    "[redis] connect failed",
    lastError instanceof Error ? lastError.message : String(lastError)
  );
  return null;
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  const url = getRedisConnectionUrl();
  if (!url) {
    return { status: "skipped", reason: "REDIS_URL unset or invalid" };
  }
  const started = Date.now();
  try {
    const c = await getRedisClient();
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
  const url = getRedisConnectionUrl();
  if (!url) {
    console.info("[startup/redis] skipped — REDIS_URL unset or invalid");
    return;
  }
  const h = await checkRedisHealth();
  if (h.status === "ok") {
    console.info(`[startup/redis] ok ping latencyMs=${String(h.latencyMs)}`);
    return;
  }
  if (h.status === "skipped") {
    console.info(`[startup/redis] skipped — ${h.reason}`);
    return;
  }
  console.warn(`[startup/redis] unhealthy — ${h.message}`);
}

/** Vitest-only: reset process-local singleton + failure flag. */
export async function resetRedisClientForTests(): Promise<void> {
  connectFailed = false;
  if (client) {
    try {
      await client.quit();
    } catch {
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
    }
    client = undefined;
  }
}
