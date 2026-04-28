import type { ScheduledTask } from "@/modules/core-admin/types";

export function serializeMarketingSchedule(task: ScheduledTask) {
  return {
    _id: task._id?.toHexString(),
    name: task.name,
    category: task.category,
    enabled: task.enabled,
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule,
    scheduleDescription: task.scheduleDescription,
    nextRunAt: task.nextRunAt?.toISOString(),
    lastRunAt: task.lastRunAt?.toISOString(),
    config: task.config ?? null
  };
}
