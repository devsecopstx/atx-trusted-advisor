import { describe, expect, it } from "vitest";

import {
  detectMarketingSchedulePreset,
  MARKETING_SCHEDULE_PRESET_OPTIONS
} from "@/lib/marketing/schedule-presets";

describe("marketing schedule presets", () => {
  it("defaults weekdays to Mon–Fri UTC cron", () => {
    expect(MARKETING_SCHEDULE_PRESET_OPTIONS.weekdays.cron).toBe("0 13 * * 1-5");
    expect(detectMarketingSchedulePreset("0 13 * * 1-5")).toBe("weekdays");
  });

  it("keeps every-day as a separate preset", () => {
    expect(MARKETING_SCHEDULE_PRESET_OPTIONS.daily.cron).toBe("0 13 * * *");
    expect(detectMarketingSchedulePreset("0 13 * * *")).toBe("daily");
  });

  it("falls back to custom for unknown cron", () => {
    expect(detectMarketingSchedulePreset("30 14 * * 1-5")).toBe("custom");
  });
});
