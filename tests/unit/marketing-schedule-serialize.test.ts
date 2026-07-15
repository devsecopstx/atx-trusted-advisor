import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { serializeMarketingSchedule } from "@/modules/marketing/serialize";
import type { ScheduledTask } from "@/modules/core-admin/types";

describe("serializeMarketingSchedule", () => {
  it("marks system-wide when tenantId is absent", () => {
    const task: ScheduledTask = {
      _id: new ObjectId("507f1f77bcf86cd799439090"),
      name: "Monday Pulse",
      category: "marketing_post",
      enabled: true,
      scheduleCron: "0 13 * * 1",
      config: {
        platforms: ["x"],
        destinationUrl: "https://fintech-advisor.ai",
        utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
      }
    };
    const row = serializeMarketingSchedule(task);
    expect(row.systemWide).toBe(true);
    expect(row.tenantId).toBeNull();
    expect(row.tenantName).toBeNull();
  });

  it("includes tenant label when scoped", () => {
    const tenantId = new ObjectId("507f1f77bcf86cd799439022");
    const task: ScheduledTask = {
      _id: new ObjectId("507f1f77bcf86cd799439091"),
      name: "Tenant Pulse",
      category: "marketing_post",
      enabled: true,
      tenantId,
      scheduleCron: "0 13 * * 5",
      config: {
        platforms: ["x"],
        destinationUrl: "https://fintech-advisor.ai",
        utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
      }
    };
    const row = serializeMarketingSchedule(task, {
      tenantId: tenantId.toHexString(),
      tenantName: "aTx Finance",
      tenantSlug: "atx"
    });
    expect(row.systemWide).toBe(false);
    expect(row.tenantId).toBe(tenantId.toHexString());
    expect(row.tenantName).toBe("aTx Finance");
    expect(row.tenantSlug).toBe("atx");
  });
});
