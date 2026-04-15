import { timingSafeEqual } from "node:crypto";

/** Minimum length for `ATX_SCHEDULER_INTERNAL_SECRET` (must match JVM `ATX_SCHEDULER_INTERNAL_SECRET`). */
export const SCHEDULER_INTERNAL_SECRET_MIN_LEN = 24;

export function readSchedulerInternalSecretFromEnv(): string | null {
  const s = process.env.ATX_SCHEDULER_INTERNAL_SECRET?.trim();
  if (!s || s.length < SCHEDULER_INTERNAL_SECRET_MIN_LEN) {
    return null;
  }
  return s;
}

export function isSchedulerInternalSecretValid(headerValue: string | null, expected: string): boolean {
  if (headerValue == null) {
    return false;
  }
  const a = Buffer.from(headerValue.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
