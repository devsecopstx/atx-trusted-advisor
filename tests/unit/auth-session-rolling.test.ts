import { describe, expect, it } from "vitest";

import { SESSION_REFRESH_WHEN_REMAINING_MS, shouldRefreshSessionExpiry } from "@/lib/auth";

describe("shouldRefreshSessionExpiry", () => {
  const now = 1_700_000_000_000;

  it("returns false when session already expired", () => {
    expect(shouldRefreshSessionExpiry(now - 1000, now)).toBe(false);
  });

  it("returns false when more than threshold remains", () => {
    expect(shouldRefreshSessionExpiry(now + SESSION_REFRESH_WHEN_REMAINING_MS + 60_000, now)).toBe(false);
  });

  it("returns true when some time remains but less than threshold", () => {
    expect(shouldRefreshSessionExpiry(now + 20 * 60 * 1000, now)).toBe(true);
  });

  it("returns false exactly at threshold boundary (exclusive upper)", () => {
    expect(shouldRefreshSessionExpiry(now + SESSION_REFRESH_WHEN_REMAINING_MS, now)).toBe(false);
  });
});
