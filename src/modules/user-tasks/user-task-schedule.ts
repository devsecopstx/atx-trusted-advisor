import {
    computeNextRunAtFromSchedule,
    resolveScheduleDescription
} from "@/lib/scheduled-task-schedule";
import type { UserTask } from "@/modules/user-tasks/types";

/** Default desk-time presets (UTC cron — conservative MVP; UI shows preset label). */
export function cronFromPreset(preset: "daily" | "weekly" | "monthly"): string {
  switch (preset) {
    case "daily":
      return "0 14 * * *";
    case "weekly":
      return "0 14 * * 1";
    case "monthly":
      return "0 14 1 * *";
    default:
      return "0 14 * * *";
  }
}

export function resolveInitialNextRunAt(task: Pick<UserTask, "scheduleCron" | "scheduleRRule">): Date | null {
  const from = new Date();
  return (
    computeNextRunAtFromSchedule(
      { scheduleCron: task.scheduleCron, scheduleRRule: task.scheduleRRule },
      from
    ) ?? new Date(from.getTime() + 60 * 60 * 1000)
  );
}

export function describeUserTaskSchedule(task: Pick<UserTask, "scheduleCron" | "scheduleRRule" | "scheduleDescription">): string {
  return resolveScheduleDescription({
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule,
    scheduleDescription: task.scheduleDescription
  });
}
