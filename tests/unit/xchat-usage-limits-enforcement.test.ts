import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneAndUpdate = vi.fn();
const createIndex = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(async () => ({
    collection: () => ({
      createIndex: createIndex.mockResolvedValue(undefined),
      find: vi.fn().mockReturnValue({
        project: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      }),
      findOneAndUpdate
    })
  }))
}));

import { enforceDistributedAskUsageLimit } from "@/modules/xchat/ask-usage-limits";

describe("enforceDistributedAskUsageLimit — tenant caps & metering", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    createIndex.mockClear();
    const counts = new Map<string, number>();
    findOneAndUpdate.mockImplementation(async (filter: { key: string }) => {
      const key = filter.key;
      const prev = counts.get(key) ?? 0;
      const next = prev + 1;
      counts.set(key, next);
      const iso = key.split(":").pop()!;
      return { bucketStart: new Date(iso), count: next };
    });
  });

  it("skips per-minute enforcement when perMinuteLimit is 0", async () => {
    for (let i = 0; i < 25; i += 1) {
      const res = await enforceDistributedAskUsageLimit({
        userId: "u_min0",
        tenantId: "t1",
        plan: "basic",
        perMinuteLimit: 0,
        enforceDailyLimit: true,
        dailyPromptLimit: 500,
        hourlyPromptLimit: undefined
      });
      expect(res.allowed).toBe(true);
    }
  });

  it("always increments hour bucket when daily caps apply (meter parity with peek)", async () => {
    await enforceDistributedAskUsageLimit({
      userId: "u_hour_meter",
      tenantId: "t1",
      plan: "basic",
      perMinuteLimit: 100,
      enforceDailyLimit: true,
      dailyPromptLimit: 50,
      hourlyPromptLimit: undefined
    });
    const kinds = findOneAndUpdate.mock.calls.map((c) => {
      const key = (c[0] as { key: string }).key as string;
      return key.split(":")[0];
    });
    expect(kinds.sort()).toEqual(["day", "hour", "minute"]);
  });

  it("allows first prompt when hourly cap is 1 and blocks the second in the same UTC hour window", async () => {
    const base = {
      userId: "u_h1",
      tenantId: "t1",
      plan: "basic" as const,
      perMinuteLimit: 50,
      enforceDailyLimit: true,
      dailyPromptLimit: 100,
      hourlyPromptLimit: 1
    };
    const first = await enforceDistributedAskUsageLimit(base);
    expect(first.allowed).toBe(true);
    const second = await enforceDistributedAskUsageLimit(base);
    expect(second.allowed).toBe(false);
    expect(second.code).toBe("xchat_hourly_limit_exceeded");
  });

  it("uses subscription tier daily cap when dailyPromptLimit is omitted or non-positive", async () => {
    const base = {
      userId: "u_daily_fallback",
      tenantId: "t1",
      plan: "basic" as const,
      perMinuteLimit: 50,
      enforceDailyLimit: true,
      hourlyPromptLimit: undefined
    };
    for (let i = 0; i < 5; i += 1) {
      const res = await enforceDistributedAskUsageLimit({
        ...base,
        dailyPromptLimit: 0
      });
      expect(res.allowed).toBe(true);
    }
    const blocked = await enforceDistributedAskUsageLimit({
      ...base,
      dailyPromptLimit: 0
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("xchat_daily_limit_exceeded");
    expect(blocked.dailyLimit).toBe(5);
  });
});
