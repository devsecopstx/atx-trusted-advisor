import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  getRedisClientForPlane: vi.fn(async () => null as null | { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> })
}));

vi.mock("@/lib/redis-client", () => redisMocks);

import {
  readSessionGroundingOkCached,
  resetSessionGroundingDecisionCacheForTests,
  writeSessionGroundingOkCached
} from "@/modules/identity/session-grounding-decision-cache";

describe("session-grounding-decision-cache", () => {
  beforeEach(() => {
    resetSessionGroundingDecisionCacheForTests();
    redisMocks.getRedisClientForPlane.mockReset();
    redisMocks.getRedisClientForPlane.mockResolvedValue(null);
  });

  it("round-trips ok via memory when redis is unavailable", async () => {
    await writeSessionGroundingOkCached("507f1f77bcf86cd799439011", "507f191e810c19729de860ea");
    expect(
      await readSessionGroundingOkCached("507f1f77bcf86cd799439011", "507f191e810c19729de860ea")
    ).toBe(true);
  });

  it("reads ok from redis when memory is cold", async () => {
    const get = vi.fn().mockResolvedValue("1");
    const set = vi.fn().mockResolvedValue("OK");
    redisMocks.getRedisClientForPlane.mockResolvedValue({ get, set });
    expect(
      await readSessionGroundingOkCached("507f1f77bcf86cd799439011", "507f191e810c19729de860ea")
    ).toBe(true);
    expect(get).toHaveBeenCalled();
  });

  it("writes ok to redis when client is present", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    redisMocks.getRedisClientForPlane.mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set
    });
    await writeSessionGroundingOkCached("507f1f77bcf86cd799439011", "507f191e810c19729de860ea");
    expect(set).toHaveBeenCalled();
  });
});
