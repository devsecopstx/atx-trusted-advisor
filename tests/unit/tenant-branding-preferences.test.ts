import { describe, expect, it } from "vitest";

import { parseTenantBrandingPreferencesPayload } from "@/modules/identity/tenant-branding-preferences";

describe("parseTenantBrandingPreferencesPayload", () => {
  it("skips empty branding strings instead of failing", () => {
    const parsed = parseTenantBrandingPreferencesPayload({
      xchat_brandname: "",
      xstrategybuilder_brandname: "   "
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({});
    }
  });

  it("accepts non-empty branding values", () => {
    const parsed = parseTenantBrandingPreferencesPayload({
      xchat_brandname: "Alpha Chat"
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({ xchat_brandname: "Alpha Chat" });
    }
  });
});
