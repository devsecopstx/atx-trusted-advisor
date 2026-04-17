/** IANA zones for `/admin/tasks` display (cron engine remains UTC). */

export const DEFAULT_ADMIN_TASKS_DISPLAY_TIME_ZONE = "America/Chicago";

export const ADMIN_TASKS_DISPLAY_TIME_ZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "America/Chicago", label: "America/Chicago (Central — CST/CDT)" },
  { value: "America/New_York", label: "America/New_York (Eastern)" },
  { value: "America/Denver", label: "America/Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
  { value: "America/Phoenix", label: "America/Phoenix (MST, no DST)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" }
];

const STORAGE_KEY = "xf_admin_tasks_display_timezone";

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function loadStoredAdminTasksDisplayTimeZone(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (typeof raw !== "string" || raw.trim() === "") {
      return null;
    }
    const tz = raw.trim();
    return isValidIanaTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

export function persistAdminTasksDisplayTimeZone(timeZone: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, timeZone);
  } catch {
    /* ignore quota / private mode */
  }
}

export function formatDateTimeInTimeZone(iso: string | undefined | null, timeZone: string): string {
  if (iso == null || iso === "") {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_ADMIN_TASKS_DISPLAY_TIME_ZONE;
  const base: Intl.DateTimeFormatOptions = {
    timeZone: safeTz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...base, timeZoneName: "short" }).format(d);
  } catch {
    try {
      return new Intl.DateTimeFormat("en-US", base).format(d);
    } catch {
      return d.toISOString();
    }
  }
}
