import { beforeEach, describe, expect, it, vi } from "vitest";

const getTenantByHexIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/identity/repository", () => ({
  getTenantByHexId: getTenantByHexIdMock
}));

import {
    pickAdminTenantLabel,
    resolveAdminTenantLabelsByHex
} from "@/lib/admin-scheduled-task-tenant-labels";

describe("admin-scheduled-task-tenant-labels", () => {
  beforeEach(() => {
    getTenantByHexIdMock.mockReset();
  });

  it("resolves name and slug by tenant hex id", async () => {
    getTenantByHexIdMock.mockImplementation(async (hex: string) => {
      if (hex === "507f1f77bcf86cd799439011") {
        return { name: "The Fund VC", slug: "thefundvc" };
      }
      return null;
    });

    const map = await resolveAdminTenantLabelsByHex([
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439011",
      null
    ]);
    expect(map.size).toBe(1);
    expect(pickAdminTenantLabel(map, "507f1f77bcf86cd799439011")).toEqual({
      tenantId: "507f1f77bcf86cd799439011",
      tenantName: "The Fund VC",
      tenantSlug: "thefundvc"
    });
  });
});
