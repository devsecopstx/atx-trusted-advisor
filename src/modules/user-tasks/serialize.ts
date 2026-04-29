import type { UserTask, UserTaskRun } from "@/modules/user-tasks/types";

export type UserTaskJson = {
  id: string;
  tenantId: string;
  userId: string;
  portfolioId?: string | null;
  name: string;
  description?: string;
  type: UserTask["type"];
  prompt: string;
  personaId?: string | null;
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
  schedulePreset?: UserTask["schedulePreset"];
  timeZone?: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  enabled: boolean;
  lastResultSnippet?: string | null;
  lastRunId?: string | null;
  delivery: UserTask["delivery"];
  params?: UserTask["params"];
  createdAt: string;
  updatedAt: string;
};

export function serializeUserTask(task: UserTask): UserTaskJson {
  const id = task._id?.toHexString() ?? "";
  return {
    id,
    tenantId: task.tenantId.toHexString(),
    userId: task.userId.toHexString(),
    portfolioId: task.portfolioId ? task.portfolioId.toHexString() : null,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    type: task.type,
    prompt: task.prompt,
    personaId: task.personaId ?? null,
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule,
    scheduleDescription: task.scheduleDescription,
    schedulePreset: task.schedulePreset ?? null,
    timeZone: task.timeZone,
    nextRunAt: task.nextRunAt ? task.nextRunAt.toISOString() : null,
    lastRunAt: task.lastRunAt ? task.lastRunAt.toISOString() : null,
    enabled: task.enabled,
    lastResultSnippet: task.lastResultSnippet ?? null,
    lastRunId: task.lastRunId ? task.lastRunId.toHexString() : null,
    delivery: task.delivery,
    params: task.params,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export type UserTaskRunJson = {
  id: string;
  taskId: string;
  status: UserTaskRun["status"];
  triggeredBy: string;
  outputSnippet?: string;
  errorCode?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  linkHint?: string;
};

export function serializeUserTaskRun(run: UserTaskRun): UserTaskRunJson {
  return {
    id: run._id!.toHexString(),
    taskId: run.taskId.toHexString(),
    status: run.status,
    triggeredBy: run.triggeredBy,
    outputSnippet: run.outputSnippet,
    errorCode: run.errorCode,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs,
    linkHint: run.linkHint
  };
}
