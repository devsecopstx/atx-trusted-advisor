import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { getDb } from "@/lib/mongodb";
import { listCoreTenantObjectIds } from "@/modules/core-admin/repository";

describe("listCoreTenantObjectIds", () => {
  const toArray = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({
      collection: () => ({
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({ toArray })
          })
        })
      })
    } as never);
  });

  it("returns sorted tenant ids from core_tenants", async () => {
    const a = new ObjectId("507f1f77bcf86cd799439011");
    const b = new ObjectId("507f1f77bcf86cd799439022");
    toArray.mockResolvedValueOnce([{ _id: b }, { _id: a }]);
    const out = await listCoreTenantObjectIds();
    expect(out).toEqual([b, a]);
    expect(getDb).toHaveBeenCalled();
  });

  it("returns empty when no tenants", async () => {
    toArray.mockResolvedValueOnce([]);
    await expect(listCoreTenantObjectIds()).resolves.toEqual([]);
  });
});
