import cronstrue from "cronstrue";
import rruleModule from "rrule";

import { computeNextRunAtFromCron } from "@/lib/scheduled-task-cron";

const { RRule, rrulestr } = rruleModule;

export type ScheduledTaskScheduleInput = {
  scheduleCron?: string | null;
  scheduleRRule?: string | null;
  scheduleDescription?: string | null;
};

export function normalizeScheduleCron(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeScheduleRRule(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseRRuleOrNull(value?: string | null): InstanceType<typeof RRule> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = rrulestr(value, { forceset: false });
    if (parsed instanceof RRule) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function validateScheduleInput(input: ScheduledTaskScheduleInput): {
  ok: boolean;
  message?: string;
} {
  const scheduleRRule = normalizeScheduleRRule(input.scheduleRRule);
  const scheduleCron = normalizeScheduleCron(input.scheduleCron);
  if (!scheduleRRule && !scheduleCron) {
    return { ok: false, message: "Provide either scheduleRRule or scheduleCron." };
  }
  if (scheduleRRule && !parseRRuleOrNull(scheduleRRule)) {
    return { ok: false, message: "Invalid RRULE format." };
  }
  if (scheduleCron) {
    const probe = computeNextRunAtFromCron(scheduleCron, new Date());
    if (!probe) {
      return { ok: false, message: "Invalid cron expression." };
    }
  }
  return { ok: true };
}

export function resolveScheduleDescription(input: ScheduledTaskScheduleInput): string {
  const existing = typeof input.scheduleDescription === "string" ? input.scheduleDescription.trim() : "";
  if (existing) {
    return existing.slice(0, 280);
  }

  const scheduleRRule = normalizeScheduleRRule(input.scheduleRRule);
  const parsedRRule = parseRRuleOrNull(scheduleRRule);
  if (parsedRRule) {
    const text = parsedRRule.toText();
    return text.length > 0 ? text.slice(0, 280) : "Custom RRULE schedule";
  }

  const scheduleCron = normalizeScheduleCron(input.scheduleCron);
  if (scheduleCron) {
    try {
      return cronstrue.toString(scheduleCron).slice(0, 280);
    } catch {
      return "Custom cron schedule";
    }
  }

  return "Unscheduled";
}

export function computeNextRunAtFromSchedule(
  schedule: ScheduledTaskScheduleInput,
  from: Date
): Date | null {
  const scheduleRRule = normalizeScheduleRRule(schedule.scheduleRRule);
  const parsedRRule = parseRRuleOrNull(scheduleRRule);
  if (parsedRRule) {
    return parsedRRule.after(from, false);
  }

  const scheduleCron = normalizeScheduleCron(schedule.scheduleCron);
  if (!scheduleCron) {
    return null;
  }
  return computeNextRunAtFromCron(scheduleCron, from);
}
