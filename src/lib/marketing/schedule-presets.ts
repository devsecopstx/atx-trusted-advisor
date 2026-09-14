/**
 * Marketing Scheduler frequency presets (UTC cron, 5-field).
 * Default for X posting is weekdays Mon–Fri — not every calendar day.
 */

export type MarketingSchedulePreset = "weekdays" | "daily" | "monday" | "friday" | "custom";

export const MARKETING_SCHEDULE_PRESET_OPTIONS: Record<
  Exclude<MarketingSchedulePreset, "custom">,
  { cron: string; scheduleDescription: string; label: string }
> = {
  weekdays: {
    cron: "0 13 * * 1-5",
    scheduleDescription: "Weekdays Mon–Fri at 13:00 UTC (≈8:00 AM CT)",
    label: "Weekdays M–F (13:00 UTC / ~8 AM CT)"
  },
  daily: {
    cron: "0 13 * * *",
    scheduleDescription: "Every day at 13:00 UTC (incl. weekends)",
    label: "Every day (13:00 UTC)"
  },
  monday: {
    cron: "0 13 * * 1",
    scheduleDescription: "Every Monday at 13:00 UTC",
    label: "Mondays only (13:00 UTC)"
  },
  friday: {
    cron: "0 13 * * 5",
    scheduleDescription: "Every Friday at 13:00 UTC",
    label: "Fridays only (13:00 UTC)"
  }
};

export function detectMarketingSchedulePreset(cron: string): MarketingSchedulePreset {
  const c = cron.trim();
  for (const key of ["weekdays", "daily", "monday", "friday"] as const) {
    if (c === MARKETING_SCHEDULE_PRESET_OPTIONS[key].cron) {
      return key;
    }
  }
  return "custom";
}
