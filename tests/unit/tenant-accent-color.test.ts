import { describe, expect, it } from "vitest";

import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";

describe("normalizeXfAccentColor", () => {
  it("defaults empty and undefined", () => {
    expect(normalizeXfAccentColor(undefined)).toBe(DEFAULT_TENANT_ACCENT_HEX);
    expect(normalizeXfAccentColor(null)).toBe(DEFAULT_TENANT_ACCENT_HEX);
    expect(normalizeXfAccentColor("")).toBe(DEFAULT_TENANT_ACCENT_HEX);
    expect(normalizeXfAccentColor("  ")).toBe(DEFAULT_TENANT_ACCENT_HEX);
  });

  it("normalizes #rrggbb and #rgb", () => {
    expect(normalizeXfAccentColor("#8B5CF6")).toBe("#8b5cf6");
    expect(normalizeXfAccentColor("#abc")).toBe("#aabbcc");
  });

  it("rejects invalid", () => {
    expect(() => normalizeXfAccentColor("red")).toThrow();
    expect(() => normalizeXfAccentColor("#gg0000")).toThrow();
    expect(() => normalizeXfAccentColor(1 as unknown as string)).toThrow();
  });
});
