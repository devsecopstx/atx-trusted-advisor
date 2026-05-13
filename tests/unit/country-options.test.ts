import { describe, expect, it } from "vitest";

import {
    COUNTRY_OPTIONS,
    DEFAULT_COUNTRY_CODE,
    countryLabelFor,
    normalizeCountryCode,
    parseCountryCode
} from "@/lib/country-options";

describe("country-options", () => {
  it("default code is US (matches advisor target market)", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("US");
    expect(COUNTRY_OPTIONS[0]?.code).toBe("US");
    expect(COUNTRY_OPTIONS[0]?.label).toBe("United States of America");
  });

  it("normalizeCountryCode lowercases input and falls back to default for unknown values", () => {
    expect(normalizeCountryCode("us")).toBe("US");
    expect(normalizeCountryCode("CA")).toBe("CA");
    expect(normalizeCountryCode("ZZ")).toBe("US");
    expect(normalizeCountryCode(undefined)).toBe("US");
    expect(normalizeCountryCode(123)).toBe("US");
  });

  it("parseCountryCode returns null for unknown values (no fallback)", () => {
    expect(parseCountryCode("us")).toBe("US");
    expect(parseCountryCode("zz")).toBeNull();
    expect(parseCountryCode("")).toBeNull();
    expect(parseCountryCode(null)).toBeNull();
  });

  it("countryLabelFor returns the human label for known codes and the upper code for unknown", () => {
    expect(countryLabelFor("US")).toBe("United States of America");
    expect(countryLabelFor("ca")).toBe("Canada");
    expect(countryLabelFor("zz")).toBe("ZZ");
  });

  it("country options list is frozen (no accidental mutation in app code)", () => {
    expect(Object.isFrozen(COUNTRY_OPTIONS)).toBe(true);
  });
});
