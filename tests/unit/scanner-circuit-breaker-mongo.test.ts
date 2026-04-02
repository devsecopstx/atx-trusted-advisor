import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const updateOne = vi.fn();

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(async () => ({
    collection: () => ({
      findOne,
      updateOne
    })
  }))
}));

import {
    scannerCircuitAllow,
    scannerCircuitRecordFailure,
    scannerCircuitRecordSuccess,
    scannerCircuitTenantKey
} from "@/modules/scanner/scanner-circuit-breaker";

describe("scannerCircuitTenantKey", () => {
  it("uses global when tenant absent", () => {
    expect(scannerCircuitTenantKey(undefined)).toBe("global");
  });

  it("uses hex when tenant present", () => {
    const id = new ObjectId("507f1f77bcf86cd799439011");
    expect(scannerCircuitTenantKey(id)).toBe("507f1f77bcf86cd799439011");
  });
});

describe("scannerCircuitRecordFailure (mock mongo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCANNER_CIRCUIT_FAILURE_THRESHOLD;
    delete process.env.SCANNER_CIRCUIT_COOLDOWN_SEC;
    delete process.env.SCANNER_CIRCUIT_BREAKER_ENABLED;
  });

  it("opens circuit after threshold consecutive failures", async () => {
    findOne
      .mockResolvedValueOnce({ failureStreak: 0 })
      .mockResolvedValueOnce({ failureStreak: 1 })
      .mockResolvedValueOnce({ failureStreak: 2 });

    const tenant = new ObjectId();
    await scannerCircuitRecordFailure(tenant, "yahoo");
    await scannerCircuitRecordFailure(tenant, "yahoo");
    await scannerCircuitRecordFailure(tenant, "yahoo");

    expect(updateOne).toHaveBeenCalledTimes(3);
    const lastSet = updateOne.mock.calls[2]?.[1]?.$set as Record<string, unknown> | undefined;
    expect(lastSet?.failureStreak).toBe(0);
    expect(lastSet?.circuitOpenUntil).toBeInstanceOf(Date);
  });
});

describe("scannerCircuitAllow when breaker disabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCANNER_CIRCUIT_BREAKER_ENABLED = "false";
  });

  it("always allows", async () => {
    const r = await scannerCircuitAllow(undefined, "yahoo");
    expect(r).toEqual({ allowed: true });
    expect(findOne).not.toHaveBeenCalled();
  });
});

describe("scannerCircuitRecordSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCANNER_CIRCUIT_BREAKER_ENABLED;
  });

  it("upserts cleared streak", async () => {
    await scannerCircuitRecordSuccess(undefined, "yahoo");
    expect(updateOne).toHaveBeenCalledWith(
      { tenantKey: "global", provider: "yahoo" },
      expect.objectContaining({
        $set: expect.objectContaining({
          failureStreak: 0,
          circuitOpenUntil: null
        })
      }),
      { upsert: true }
    );
  });
});
