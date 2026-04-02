import { describe, expect, it } from "vitest";

import {
    DEFAULT_XF_UI_THEME_PREFERENCE,
    parseXfUiThemePreference,
    resolveXfUiDensity
} from "@/lib/xf-ui-theme";

describe("xf-ui-theme", () => {
  it("defaults preference constant is dark (deep shell)", () => {
    expect(DEFAULT_XF_UI_THEME_PREFERENCE).toBe("dark");
  });

  it("resolves light preference to soft density", () => {
    expect(resolveXfUiDensity("light", false)).toBe("soft");
    expect(resolveXfUiDensity("light", true)).toBe("soft");
  });

  it("resolves dark preference to deep density", () => {
    expect(resolveXfUiDensity("dark", false)).toBe("deep");
    expect(resolveXfUiDensity("dark", true)).toBe("deep");
  });

  it("resolves system from prefers-color-scheme", () => {
    expect(resolveXfUiDensity("system", true)).toBe("soft");
    expect(resolveXfUiDensity("system", false)).toBe("deep");
  });

  it("parses storage values and defaults", () => {
    expect(parseXfUiThemePreference("light")).toBe("light");
    expect(parseXfUiThemePreference("dark")).toBe("dark");
    expect(parseXfUiThemePreference("system")).toBe("system");
    expect(parseXfUiThemePreference(null)).toBe(DEFAULT_XF_UI_THEME_PREFERENCE);
    expect(parseXfUiThemePreference("")).toBe(DEFAULT_XF_UI_THEME_PREFERENCE);
    expect(parseXfUiThemePreference("nope")).toBe(DEFAULT_XF_UI_THEME_PREFERENCE);
  });

});
