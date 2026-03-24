import type { ScheduledTask } from "@/modules/core-admin/types";

export function serializeScheduledTaskForJson(t: ScheduledTask) {
  return {
    _id: t._id?.toHexString(),
    tenantId: t.tenantId?.toHexString(),
    portfolioId: t.portfolioId?.toHexString(),
    name: t.name,
    category: t.category,
    scheduleCron: t.scheduleCron,
    enabled: t.enabled,
    runTimeoutSeconds: t.runTimeoutSeconds,
    maxRetries: t.maxRetries,
    lastRunAt: t.lastRunAt?.toISOString(),
    nextRunAt: t.nextRunAt?.toISOString()
  };
}
