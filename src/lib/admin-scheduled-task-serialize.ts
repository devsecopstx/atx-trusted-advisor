import type { ScheduledTask } from "@/modules/core-admin/types";

export function serializeScheduledTaskForJson(t: ScheduledTask) {
  return {
    _id: t._id?.toHexString(),
    /** When absent, the task runs once per `core_tenants` row on each tick / manual Run. */
    systemWide: !t.tenantId,
    tenantId: t.tenantId?.toHexString(),
    portfolioId: t.portfolioId?.toHexString(),
    appBrokerImportJobId: t.appBrokerImportJobId?.toHexString(),
    name: t.name,
    category: t.category,
    schedule: {
      rrule: t.scheduleRRule,
      cron: t.scheduleCron,
      description: t.scheduleDescription
    },
    scheduleCron: t.scheduleCron,
    scheduleRRule: t.scheduleRRule,
    scheduleDescription: t.scheduleDescription,
    enabled: t.enabled,
    deliveryChannelTarget: t.deliveryChannelTarget?.toHexString() ?? null,
    runTimeoutSeconds: t.runTimeoutSeconds,
    maxRetries: t.maxRetries,
    config: t.config ?? null,
    lastRunAt: t.lastRunAt?.toISOString(),
    nextRunAt: t.nextRunAt?.toISOString()
  };
}
