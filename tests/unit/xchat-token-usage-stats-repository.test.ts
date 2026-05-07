import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoistedGetDb = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mongodb", () => ({
  getDb: hoistedGetDb
}));

import { getXchatTokenUsageStatsForUser } from "@/modules/xchat/repository";

type AggRow = { totalTokens: number; turnsWithUsage: number };

describe("getXchatTokenUsageStatsForUser", () => {
  let totalAggResult: AggRow[];
  let windowAggResult: AggRow[];

  beforeEach(() => {
    totalAggResult = [];
    windowAggResult = [];
    let aggInvocation = 0;
    hoistedGetDb.mockImplementation(async () => ({
      collection: (name: string) => {
        if (name === "xchat_logs") {
          return {
            createIndex: vi.fn().mockResolvedValue("idx"),
            aggregate: vi.fn(() => ({
              toArray: async () => {
                aggInvocation += 1;
                return aggInvocation % 2 === 1 ? totalAggResult : windowAggResult;
              }
            }))
          };
        }
        return { createIndex: vi.fn().mockResolvedValue("idx") };
      }
    }));
  });

  it("sums lifetime and window aggregates and rounds tokens/minute", async () => {
    totalAggResult = [{ totalTokens: 1400, turnsWithUsage: 10 }];
    windowAggResult = [{ totalTokens: 600, turnsWithUsage: 3 }];
    const stats = await getXchatTokenUsageStatsForUser({
      userId: new ObjectId(),
      tenantId: new ObjectId()
    });
    expect(stats.totalTokens).toBe(1400);
    expect(stats.turnsWithUsage).toBe(10);
    expect(stats.tokensLast60Minutes).toBe(600);
    expect(stats.turnsWithUsageLast60Minutes).toBe(3);
    expect(stats.tokensPerMinuteAvg60m).toBe(10);
    expect(stats.windowMinutes).toBe(60);
    expect(typeof stats.computedAt).toBe("string");
  });

  it("returns zeros when aggregates are empty", async () => {
    const stats = await getXchatTokenUsageStatsForUser({
      userId: new ObjectId(),
      tenantId: new ObjectId()
    });
    expect(stats.totalTokens).toBe(0);
    expect(stats.turnsWithUsage).toBe(0);
    expect(stats.tokensLast60Minutes).toBe(0);
    expect(stats.turnsWithUsageLast60Minutes).toBe(0);
    expect(stats.tokensPerMinuteAvg60m).toBe(0);
  });

  it("returns zeros when tenantId is missing (Mongo scope matches nothing)", async () => {
    const stats = await getXchatTokenUsageStatsForUser({
      userId: new ObjectId(),
      tenantId: null
    });
    expect(stats.totalTokens).toBe(0);
    expect(stats.tokensLast60Minutes).toBe(0);
    expect(stats.tokensPerMinuteAvg60m).toBe(0);
  });

  it("rounds tokensPerMinuteAvg60m to one decimal", async () => {
    totalAggResult = [{ totalTokens: 0, turnsWithUsage: 0 }];
    windowAggResult = [{ totalTokens: 333, turnsWithUsage: 5 }];
    const stats = await getXchatTokenUsageStatsForUser({
      userId: new ObjectId(),
      tenantId: new ObjectId()
    });
    expect(stats.tokensPerMinuteAvg60m).toBe(5.6);
  });
});
