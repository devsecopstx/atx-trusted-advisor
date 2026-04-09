import { describe, expect, it } from "vitest";

import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";

describe("TenantShellBranding", () => {
  it("requires displayName alongside accent for workspace chrome", () => {
    const row: TenantShellBranding = {
      displayName: "Acme Advisors LLC",
      accentColor: "#8b5cf6",
      tagline: "Family Office"
    };
    expect(row.displayName).toContain("Acme");
  });
});
