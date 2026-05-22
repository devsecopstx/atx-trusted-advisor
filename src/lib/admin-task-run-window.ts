export type TaskRunHistoryWindow = "today" | "24h" | "30d";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TaskRunWindowQuery = {
  startedAtMin: Date;
  /** When set, matches `startedAt < startedAtMaxExclusive` (exclusive end). */
  startedAtMaxExclusive?: Date;
  defaultLimit: number;
};

/**
 * Maps UI window to Mongo `startedAt` bounds. **Today** is the current **UTC** calendar day (aligned with cron copy on `/admin/tasks`).
 */
export function resolveTaskRunListWindowQuery(
  window: TaskRunHistoryWindow,
  now: Date = new Date()
): TaskRunWindowQuery {
  if (window === "24h") {
    return {
      startedAtMin: new Date(now.getTime() - MS_PER_DAY),
      defaultLimit: 500
    };
  }
  if (window === "today") {
    const min = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const startedAtMaxExclusive = new Date(min.getTime() + 24 * 60 * 60 * 1000);
    return { startedAtMin: min, startedAtMaxExclusive, defaultLimit: 150 };
  }
  const startedAtMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { startedAtMin, defaultLimit: 500 };
}
