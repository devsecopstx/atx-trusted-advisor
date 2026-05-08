import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoistedGetDb = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mongodb", () => ({
  getDb: hoistedGetDb
}));

vi.mock("@/modules/xchat/repository", () => ({
  ensureXchatLogIndexes: vi.fn().mockResolvedValue(undefined)
}));

import {
    getAdminXchatVendorSpendByTenantPersona,
    getAdminXchatVendorSpendDaily
} from "@/modules/xchat/tool-usage-repository";

describe("getAdminXchatVendorSpendByTenantPersona", () => {
  let aggRows: unknown[];

  beforeEach(() => {
    aggRows = [];
    hoistedGetDb.mockImplementation(async () => ({
      collection: (name: string) => {
        if (name === "xchat_logs") {
          return {
            aggregate: vi.fn(() => ({
              toArray: async () => aggRows
            }))
          };
        }
        return {};
      }
    }));
  });

  it("maps aggregate rows to tenant/persona hex and sorts by vendor ticks", async () => {
    const tenantId = new ObjectId("507f1f77bcf86cd799439011");
    const personaId = new ObjectId("507f1f77bcf86cd799439022");
    aggRows = [
      {
        _id: { tenantKey: tenantId, personaKey: personaId, personaName: "Advisor" },
        turns: 2,
        vendorUsdTicks: 150
      }
    ];

    const rows = await getAdminXchatVendorSpendByTenantPersona({
      sinceIso: "2026-05-01T00:00:00.000Z"
    });

    expect(rows).toEqual([
      {
        tenantIdHex: tenantId.toHexString(),
        personaIdHex: personaId.toHexString(),
        personaName: "Advisor",
        turns: 2,
        vendorUsdTicks: 150
      }
    ]);
  });

  it("returns unknown tenant when tenant key is missing", async () => {
    aggRows = [
      {
        _id: { tenantKey: null, personaKey: null, personaName: null },
        turns: 1,
        vendorUsdTicks: 10
      }
    ];

    const rows = await getAdminXchatVendorSpendByTenantPersona({
      sinceIso: "2026-05-01T00:00:00.000Z"
    });

    expect(rows[0]?.tenantIdHex).toBe("unknown");
    expect(rows[0]?.personaIdHex).toBeNull();
  });
});

describe("getAdminXchatVendorSpendDaily", () => {
  let aggRows: unknown[];

  beforeEach(() => {
    aggRows = [];
    hoistedGetDb.mockImplementation(async () => ({
      collection: (name: string) => {
        if (name === "xchat_logs") {
          return {
            aggregate: vi.fn(() => ({
              toArray: async () => aggRows
            }))
          };
        }
        return {};
      }
    }));
  });

  it("maps UTC day buckets from aggregate _id", async () => {
    aggRows = [{ _id: "2026-05-07", turns: 3, vendorUsdTicks: 900 }];

    const rows = await getAdminXchatVendorSpendDaily({
      sinceIso: "2026-05-01T00:00:00.000Z"
    });

    expect(rows).toEqual([{ dayUtc: "2026-05-07", turns: 3, vendorUsdTicks: 900 }]);
  });
});
