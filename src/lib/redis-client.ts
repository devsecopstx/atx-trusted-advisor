import { createClient } from "redis";

export type RedisHealth =
  | { status: "skipped"; reason: "REDIS_URL unset or invalid" }
  | { status: "ok"; latencyMs: number }
  | { status: "error"; message: string };

type AtxRedisClient = ReturnType<typeof createClient>;

let client: AtxRedisClient | undefined;
let connectFailed = false;

/**
 * Optional Redis URL (`redis://` or `rediss://`). Read from `process.env` only so `next build`
 * and CI do not require Redis (same pattern as `getAtxfinanceBackendOrigin`).
 * Redis Cloud / TLS: prefer `rediss://default:PASSWORD@host:port`.
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
  try {
    const c = createClient({ url });
    c.on("error", (err) => {
      console.warn("[redis] client error", err instanceof Error ? err.message : String(err));
    });
    await c.connect();
    client = c;
    return c;
  } catch (error) {
    connectFailed = true;
    console.warn("[redis] connect failed", error instanceof Error ? error.message : String(error));
    return null;
  }
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
