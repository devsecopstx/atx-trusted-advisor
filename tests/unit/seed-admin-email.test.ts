import { describe, expect, it } from "vitest";

import { isSeedAdminEmail } from "@/lib/seed-admin-email";

describe("isSeedAdminEmail", () => {
  it("returns false when configured email is missing or blank", () => {
    expect(isSeedAdminEmail("any@gmail.com", undefined)).toBe(false);
    expect(isSeedAdminEmail("any@gmail.com", "")).toBe(false);
    expect(isSeedAdminEmail("any@gmail.com", "   ")).toBe(false);
  });

  it("matches case-insensitively when configured", () => {
    expect(isSeedAdminEmail("Admin@EXAMPLE.com", "admin@example.com")).toBe(true);
  });
});
