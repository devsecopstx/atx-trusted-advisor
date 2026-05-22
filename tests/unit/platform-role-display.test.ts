import { describe, expect, it } from "vitest";

import {
    formatTenantNameWithPlatformRole,
    resolvePrimaryPlatformRoleForDisplay
} from "@/lib/platform-role-display";

describe("platform role display", () => {
  it("picks highest platform role for display", () => {
    expect(resolvePrimaryPlatformRoleForDisplay(["viewer", "operator"])).toBe("operator");
    expect(resolvePrimaryPlatformRoleForDisplay(["advisor", "viewer"])).toBe("advisor");
    expect(resolvePrimaryPlatformRoleForDisplay(["global_admin", "advisor"])).toBe("global_admin");
  });

  it("formats tenant name with role in parentheses", () => {
    expect(formatTenantNameWithPlatformRole("Example IA LLC", "advisor")).toBe(
      "Example IA LLC (advisor)"
    );
    expect(formatTenantNameWithPlatformRole("Example IA LLC", null)).toBe("Example IA LLC");
  });
});
