const MINUTES_PER_DAY = 24 * 60;
const MAX_SEARCH_MINUTES = 366 * MINUTES_PER_DAY;

type CronParts = {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
};

function parseSegment(segment: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();
  const tokens = segment.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  for (const token of tokens) {
    const stepParts = token.split("/");
    const base = stepParts[0] ?? "";
    const step = stepParts[1] ? Number.parseInt(stepParts[1], 10) : 1;
    if (!Number.isFinite(step) || step <= 0) {
      return null;
    }

    let start = min;
    let end = max;

    if (base !== "*") {
      const rangeParts = base.split("-");
      if (rangeParts.length === 1) {
        const value = Number.parseInt(rangeParts[0] ?? "", 10);
        if (!Number.isFinite(value) || value < min || value > max) {
          return null;
        }
        start = value;
        end = value;
      } else if (rangeParts.length === 2) {
        const rangeStart = Number.parseInt(rangeParts[0] ?? "", 10);
        const rangeEnd = Number.parseInt(rangeParts[1] ?? "", 10);
        if (
          !Number.isFinite(rangeStart) ||
          !Number.isFinite(rangeEnd) ||
          rangeStart < min ||
          rangeEnd > max ||
          rangeStart > rangeEnd
        ) {
          return null;
        }
        start = rangeStart;
        end = rangeEnd;
      } else {
        return null;
      }
    }

    for (let i = start; i <= end; i += step) {
      out.add(i);
    }
  }

  return out;
}

function parseCronExpression(expr: string): CronParts | null {
  const parts = expr
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length !== 5) {
    return null;
  }

  const minute = parseSegment(parts[0] ?? "", 0, 59);
  const hour = parseSegment(parts[1] ?? "", 0, 23);
  const dayOfMonth = parseSegment(parts[2] ?? "", 1, 31);
  const month = parseSegment(parts[3] ?? "", 1, 12);
  const dayOfWeek = parseSegment(parts[4] ?? "", 0, 7);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return null;
  }

  // Normalize Sunday alias 7 -> 0
  if (dayOfWeek.has(7)) {
    dayOfWeek.add(0);
    dayOfWeek.delete(7);
  }

  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

function matchesCron(parts: CronParts, dateUtc: Date): boolean {
  const minute = dateUtc.getUTCMinutes();
  const hour = dateUtc.getUTCHours();
  const dayOfMonth = dateUtc.getUTCDate();
  const month = dateUtc.getUTCMonth() + 1;
  const dayOfWeek = dateUtc.getUTCDay();
  return (
    parts.minute.has(minute) &&
    parts.hour.has(hour) &&
    parts.dayOfMonth.has(dayOfMonth) &&
    parts.month.has(month) &&
    parts.dayOfWeek.has(dayOfWeek)
  );
}

/**
 * Computes the next UTC run time for a standard 5-field cron expression.
 * Returns null when expression is invalid or no match found in one year.
 */
export function computeNextRunAtFromCron(scheduleCron: string, from: Date): Date | null {
  const parsed = parseCronExpression(scheduleCron);
  if (!parsed) {
    return null;
  }

  const probe = new Date(from.getTime());
  probe.setUTCSeconds(0, 0);
  probe.setUTCMinutes(probe.getUTCMinutes() + 1);

  for (let i = 0; i < MAX_SEARCH_MINUTES; i += 1) {
    if (matchesCron(parsed, probe)) {
      return new Date(probe.getTime());
    }
    probe.setUTCMinutes(probe.getUTCMinutes() + 1);
  }

  return null;
}
