import { z } from "zod";

export const scheduledTaskScheduleObjectSchema = z
  .object({
    rrule: z.string().trim().min(1).max(1024).optional(),
    cron: z.string().trim().min(5).max(128).optional(),
    description: z.string().trim().min(1).max(280).optional()
  })
  .optional();

export type NormalizedScheduledTaskSchedule = {
  scheduleRRule?: string;
  scheduleCron?: string;
  scheduleDescription?: string;
};

export function normalizeScheduledTaskSchedule(input: {
  schedule?: { rrule?: string; cron?: string; description?: string };
  scheduleRRule?: string | null;
  scheduleCron?: string;
  scheduleDescription?: string;
}): NormalizedScheduledTaskSchedule {
  const normalizedRRule =
    input.scheduleRRule !== undefined
      ? input.scheduleRRule ?? undefined
      : input.schedule?.rrule;
  const normalizedCron =
    input.scheduleCron !== undefined
      ? input.scheduleCron
      : input.schedule?.cron;
  const normalizedDescription =
    input.scheduleDescription !== undefined
      ? input.scheduleDescription
      : input.schedule?.description;

  return {
    scheduleRRule: normalizedRRule,
    scheduleCron: normalizedCron,
    scheduleDescription: normalizedDescription
  };
}
