import type { ScheduledTask, TaskRun } from "@/modules/core-admin/types";

export type TenantUserScheduledTaskJson = {
  _id: string;
  tenantId?: string;
  ownerUserId?: string;
  name: string;
  category: ScheduledTask["category"];
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
};

export function serializeTenantUserScheduledTaskForJson(task: ScheduledTask): TenantUserScheduledTaskJson {
  return {
    _id: task._id!.toHexString(),
    tenantId: task.tenantId?.toHexString(),
    ownerUserId: task.ownerUserId?.toHexString(),
    name: task.name,
    category: task.category,
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule,
    scheduleDescription: task.scheduleDescription,
    enabled: task.enabled,
    nextRunAt: task.nextRunAt?.toISOString(),
    lastRunAt: task.lastRunAt?.toISOString()
  };
}

export function serializeTenantUserTaskRunForJson(run: TaskRun): Record<string, unknown> {
  return {
    _id: run._id?.toHexString(),
    tenantId: run.tenantId?.toHexString(),
    taskId: run.taskId.toHexString(),
    taskName: run.taskName,
    category: run.category,
    triggeredBy: run.triggeredBy,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs,
    output: run.output
  };
}
