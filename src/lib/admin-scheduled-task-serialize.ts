import type { ScheduledTask, TaskRun } from "@/modules/core-admin/types";

export type AdminTaskRunExecutorJson = {
  runtime: string;
  environment: string;
  label: string;
  service?: string;
  revision?: string;
  host?: string;
  delegateFrom?: string;
};

export type AdminTaskRunJson = {
  _id?: string;
  tenantId?: string;
  taskId: string;
  taskName: string;
  category: string;
  triggeredBy: string;
  status: TaskRun["status"];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output: string;
  executor?: AdminTaskRunExecutorJson;
};

function serializeExecutor(run: TaskRun): AdminTaskRunExecutorJson | undefined {
  const ex = run.executor;
  if (!ex?.label?.trim()) {
    return undefined;
  }
  return {
    runtime: ex.runtime,
    environment: ex.environment,
    label: ex.label,
    ...(ex.service ? { service: ex.service } : {}),
    ...(ex.revision ? { revision: ex.revision } : {}),
    ...(ex.host ? { host: ex.host } : {}),
    ...(ex.delegateFrom ? { delegateFrom: ex.delegateFrom } : {})
  };
}

export function serializeAdminTaskRunForJson(run: TaskRun): AdminTaskRunJson {
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
    output: run.output ?? "",
    executor: serializeExecutor(run)
  };
}

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
