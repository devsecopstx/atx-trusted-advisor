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
      findOneAndUpdate: findOneAndUpdate.mockImplementation(async () => ({
        bucketStart: new Date("2026-01-15T12:00:00.000Z"),
        count: 1
      }))
    })
  }))
}));

import { enforceDistributedAskUsageLimit, peekXchatAskUsageCounts } from "@/modules/xchat/ask-usage-limits";

describe("enforceDistributedAskUsageLimit — metering when daily caps not enforced", () => {
  beforeEach(() => {
    findOneAndUpdate.mockClear();
    createIndex.mockClear();
  });

  it("increments minute, hour, and day buckets so prompt-usage meter reflects admin sends", async () => {
    await enforceDistributedAskUsageLimit({
      userId: "u_admin",
      tenantId: "t1",
      plan: "basic",
      perMinuteLimit: 30,
      enforceDailyLimit: false
    });

    expect(findOneAndUpdate).toHaveBeenCalledTimes(3);
    const kindsFromKeys = findOneAndUpdate.mock.calls.map((call) => {
      const key = (call[0] as { key: string }).key as string;
      return key.split(":")[0];
    });
    expect(kindsFromKeys.sort()).toEqual(["day", "hour", "minute"]);
  });
});

describe("peekXchatAskUsageCounts", () => {
  beforeEach(() => {
    findOneAndUpdate.mockClear();
    createIndex.mockClear();
  });

  it("reads day bucket count from Mongo (key matches buildUsageKey tenant segment)", async () => {
    const { getDb } = await import("@/lib/mongodb");
    const now = new Date(Date.UTC(2026, 0, 15, 14, 30, 0));
    const dayStart = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
    const dayKey = `day:u1:t1:${dayStart.toISOString()}`;
    vi.mocked(getDb).mockResolvedValueOnce({
      collection: () => ({
        createIndex: createIndex.mockResolvedValue(undefined),
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([{ key: dayKey, count: 7 }])
          })
        }),
        findOneAndUpdate
      })
    } as never);

    const counts = await peekXchatAskUsageCounts({
      userId: "u1",
      tenantId: "t1",
      now
    });
    expect(counts.dayCount).toBe(7);
  });
});
