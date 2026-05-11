import { describe, expect, it } from "vitest";

import { getFeatureFlag, isFeatureEnabled } from "@/lib/feature-flags";
import {
  isValidFeatureFlagKey,
  parseFeatureFlagsPayload
} from "@/modules/identity/tenant-branding-preferences";

describe("feature flag runtime helpers", () => {
  it("isFeatureEnabled returns default when tenant is null", () => {
    expect(isFeatureEnabled(null, "some-flag")).toBe(false);
    expect(isFeatureEnabled(null, "some-flag", true)).toBe(true);
  });

  it("isFeatureEnabled returns default when featureFlags missing", () => {
    expect(isFeatureEnabled({ tenantPreferences: null }, "x")).toBe(false);
    expect(isFeatureEnabled({ tenantPreferences: {} }, "x")).toBe(false);
  });

  it("isFeatureEnabled reads boolean flags", () => {
    const tenant = {
      tenantPreferences: { featureFlags: { "voice-input": true, "beta-ui": false } }
    };
    expect(isFeatureEnabled(tenant, "voice-input")).toBe(true);
    expect(isFeatureEnabled(tenant, "beta-ui")).toBe(false);
    expect(isFeatureEnabled(tenant, "missing")).toBe(false);
  });

  it("isFeatureEnabled ignores non-boolean values", () => {
    const tenant = {
      tenantPreferences: { featureFlags: { "threshold": 42, "label": "test" } }
    };
    expect(isFeatureEnabled(tenant, "threshold")).toBe(false);
    expect(isFeatureEnabled(tenant, "label")).toBe(false);
  });

  it("getFeatureFlag returns typed values", () => {
    const tenant = {
      tenantPreferences: { featureFlags: { "max-retries": 5, "label": "beta", "on": true } }
    };
    expect(getFeatureFlag(tenant, "max-retries", 0)).toBe(5);
    expect(getFeatureFlag(tenant, "label", "default")).toBe("beta");
    expect(getFeatureFlag(tenant, "on", false)).toBe(true);
    expect(getFeatureFlag(tenant, "missing", 99)).toBe(99);
  });

  it("getFeatureFlag returns default on type mismatch", () => {
    const tenant = {
      tenantPreferences: { featureFlags: { "threshold": "not-a-number" } }
    };
    expect(getFeatureFlag(tenant, "threshold", 42)).toBe(42);
  });
});

describe("feature flag key validation", () => {
  it("accepts valid kebab-case keys", () => {
    expect(isValidFeatureFlagKey("voice-input")).toBe(true);
    expect(isValidFeatureFlagKey("a")).toBe(true);
    expect(isValidFeatureFlagKey("wheel-strategy-visual")).toBe(true);
    expect(isValidFeatureFlagKey("v2")).toBe(true);
    expect(isValidFeatureFlagKey("abc-123-def")).toBe(true);
  });

  it("rejects invalid keys", () => {
    expect(isValidFeatureFlagKey("")).toBe(false);
    expect(isValidFeatureFlagKey("-leading")).toBe(false);
    expect(isValidFeatureFlagKey("UPPERCASE")).toBe(false);
    expect(isValidFeatureFlagKey("has space")).toBe(false);
    expect(isValidFeatureFlagKey("has_underscore")).toBe(false);
    expect(isValidFeatureFlagKey("a".repeat(65))).toBe(false);
  });
});

describe("parseFeatureFlagsPayload", () => {
  it("accepts null/undefined as empty", () => {
    expect(parseFeatureFlagsPayload(null)).toEqual({ ok: true, value: {} });
    expect(parseFeatureFlagsPayload(undefined)).toEqual({ ok: true, value: {} });
  });

  it("accepts valid flag objects", () => {
    const result = parseFeatureFlagsPayload({
      "voice-input": true,
      "max-retries": 3,
      "banner-text": "hello"
    });
    expect(result).toEqual({
      ok: true,
      value: { "voice-input": true, "max-retries": 3, "banner-text": "hello" }
    });
  });

  it("rejects arrays", () => {
    const result = parseFeatureFlagsPayload([1, 2, 3]);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid keys", () => {
    const result = parseFeatureFlagsPayload({ "INVALID_KEY": true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("INVALID_KEY");
    }
  });

  it("rejects invalid value types", () => {
    const result = parseFeatureFlagsPayload({ "ok-key": { nested: true } });
    expect(result.ok).toBe(false);
  });

  it("truncates long string values", () => {
    const longStr = "a".repeat(300);
    const result = parseFeatureFlagsPayload({ "long": longStr });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.long as string).length).toBe(256);
    }
  });
});
