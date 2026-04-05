import { createClient } from "redis";
import { describe, expect, it } from "vitest";

const runLive = process.env.RUN_INTEGRATION_LIVE === "true";
const backendOrigin = process.env.LIVE_BACKEND_ORIGIN?.trim() || "http://127.0.0.1:18080";
const redisUrl = process.env.LIVE_REDIS_URL?.trim() || "redis://127.0.0.1:6380";

describe.skipIf(!runLive)("live integration contracts (backend + redis)", () => {
  it("backend /api/health is reachable", async () => {
    const response = await fetch(`${backendOrigin}/api/health`, {
      signal: AbortSignal.timeout(8_000)
    });
    expect(response.ok).toBe(true);
    const body = (await response.json()) as { status?: string };
    expect(typeof body.status).toBe("string");
  });

  it("redis responds to ping", async () => {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 3_000
      }
    });
    try {
      await client.connect();
      const pong = await client.ping();
      expect(pong).toBe("PONG");
    } finally {
      try {
        await client.quit();
      } catch {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
      }
    }
  });
});
