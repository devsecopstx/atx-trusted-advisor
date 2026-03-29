import { describe, expect, it, vi } from "vitest";

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

const redisMocks = vi.hoisted(() => ({
  checkRedisHealth: vi.fn()
}));

vi.mock("@/lib/mongodb", () => mongoMocks);
vi.mock("@/lib/redis-client", () => redisMocks);

import { GET as getHealth } from "@/app/api/health/route";
import { APP_VERSION } from "@/lib/app-version";

describe("GET /api/health", () => {
  it("returns ok with mongo db name and redis payload", async () => {
    mongoMocks.getDb.mockResolvedValue({
      command: vi.fn().mockResolvedValue({ ok: 1 }),
      databaseName: "atxfinance-test"
    });
    redisMocks.checkRedisHealth.mockResolvedValue({
      status: "skipped",
      reason: "REDIS_URL unset or invalid"
    });

    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      db: string;
      redis: { status: string };
    };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(APP_VERSION);
    expect(body.db).toBe("atxfinance-test");
    expect(body.redis.status).toBe("skipped");
  });
});
