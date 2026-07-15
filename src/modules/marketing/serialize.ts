import type { AdminTenantLabel } from "@/lib/admin-scheduled-task-tenant-labels";
import type { ScheduledTask } from "@/modules/core-admin/types";

export function serializeMarketingSchedule(
  task: ScheduledTask,
  label?: AdminTenantLabel | null
) {
  const tenantId = task.tenantId?.toHexString() ?? null;
  return {
    _id: task._id?.toHexString(),
    name: task.name,
    category: task.category,
    enabled: task.enabled,
    systemWide: !tenantId,
    tenantId,
    tenantName: label?.tenantName ?? null,
    tenantSlug: label?.tenantSlug ?? null,
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule,
    scheduleDescription: task.scheduleDescription,
    nextRunAt: task.nextRunAt?.toISOString(),
    lastRunAt: task.lastRunAt?.toISOString(),
    config: task.config ?? null
  };
}
