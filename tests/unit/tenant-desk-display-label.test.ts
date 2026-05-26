import { describe, expect, it } from "vitest";

import { resolveTenantDeskDisplayLabel } from "@/lib/tenant-desk-display-label";
import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";

describe("resolveTenantDeskDisplayLabel", () => {
  it("prefers xchat brand name over display name", () => {
    const branding: TenantShellBranding = {
      displayName: "ATX Finance Advisory",
      accentColor: "#22c55e",
      xchatBrandName: "Desk xChat",
      tagline: "HNWI options desk"
    };
    expect(resolveTenantDeskDisplayLabel(branding)).toEqual({
      primary: "Desk xChat",
      tagline: "HNWI options desk",
      logoUrl: undefined
    });
  });

  it("falls back to workspace tenant name", () => {
    expect(resolveTenantDeskDisplayLabel(null, "Samuel Perez Family Office")).toEqual({
      primary: "Samuel Perez Family Office",
      tagline: undefined,
      logoUrl: undefined
    });
  });
});
