import { afterEach, describe, expect, it, vi } from "vitest";

import {
    resolveXoptionsExpirationForHorizon,
    XOPTIONS_DEFAULT_EXPIRATION_HORIZON_DAYS
} from "@/lib/xoptions/xoptions-expiration-default";

describe("resolveXoptionsExpirationForHorizon", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses 2-week target by default constant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    const selected = resolveXoptionsExpirationForHorizon(
      ["2026-04-03", "2026-04-10", "2026-04-17", "2026-04-24"],
      XOPTIONS_DEFAULT_EXPIRATION_HORIZON_DAYS
    );

    expect(selected).toBe("2026-04-17");
  });

  it("falls back to latest date when target is beyond available list", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    const selected = resolveXoptionsExpirationForHorizon(
      ["2026-04-03", "2026-04-10"],
      XOPTIONS_DEFAULT_EXPIRATION_HORIZON_DAYS
    );

    expect(selected).toBe("2026-04-10");
  });

  it("returns nearest available on-or-after today when horizon is zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    const selected = resolveXoptionsExpirationForHorizon(
      ["2026-03-27", "2026-04-03", "2026-04-10"],
      0
    );

    expect(selected).toBe("2026-04-03");
  });
});
