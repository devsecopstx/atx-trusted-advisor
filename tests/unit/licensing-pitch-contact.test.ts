import { afterEach, describe, expect, it, vi } from "vitest";

describe("getLicensingPitchContact", () => {
  afterEach(() => {
    delete process.env.XSTRATEGYBUILDER_LICENSING_EMAIL;
    delete process.env.XSTRATEGYBUILDER_LICENSING_X_URL;
    delete process.env.XSTRATEGYBUILDER_LICENSING_X_LABEL;
    delete process.env.XSTRATEGYBUILDER_COMPANY_EMAIL;
    vi.resetModules();
  });

  it("uses committed defaults when env overrides are unset", async () => {
    const { getLicensingPitchContact, LICENSING_PITCH_CONTACT_DEFAULTS } = await import("@/lib/env");
    const c = getLicensingPitchContact();
    expect(c.licensingEmail).toBe(LICENSING_PITCH_CONTACT_DEFAULTS.licensingEmail);
    expect(c.licensingXUrl).toBe(LICENSING_PITCH_CONTACT_DEFAULTS.licensingXUrl);
    expect(c.licensingXLabel).toBe(LICENSING_PITCH_CONTACT_DEFAULTS.licensingXLabel);
    expect(c.companyEmail).toBeUndefined();
  });

  it("env overrides replace defaults", async () => {
    process.env.XSTRATEGYBUILDER_LICENSING_EMAIL = "other@example.com";
    process.env.XSTRATEGYBUILDER_LICENSING_X_URL = "https://x.com/other";
    process.env.XSTRATEGYBUILDER_LICENSING_X_LABEL = "@other";
    process.env.XSTRATEGYBUILDER_COMPANY_EMAIL = "company@example.com";
    vi.resetModules();
    const { getLicensingPitchContact } = await import("@/lib/env");
    const c = getLicensingPitchContact();
    expect(c.licensingEmail).toBe("other@example.com");
    expect(c.licensingXUrl).toBe("https://x.com/other");
    expect(c.licensingXLabel).toBe("@other");
    expect(c.companyEmail).toBe("company@example.com");
  });
});
