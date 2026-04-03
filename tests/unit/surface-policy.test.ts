import { describe, expect, it } from "vitest";

import {
    isAdminConsolePath,
    isAppUserProductPath,
    requireApprovedLoginForProduct
} from "@/modules/surface-policy";

describe("surface-policy", () => {
  it("detects app_user product paths", () => {
    expect(isAppUserProductPath("/xchat")).toBe(true);
    expect(isAppUserProductPath("/xchat/thread")).toBe(true);
    expect(isAppUserProductPath("/portfolio/accounts/abc")).toBe(true);
    expect(isAppUserProductPath("/xoptions")).toBe(true);
    expect(isAppUserProductPath("/xoptions/builder")).toBe(true);
    expect(isAppUserProductPath("/portfolios")).toBe(true);
    expect(isAppUserProductPath("/import-activity")).toBe(true);
    expect(isAppUserProductPath("/workspace/portfolios")).toBe(true);
    expect(isAppUserProductPath("/recommendations")).toBe(false);
    expect(isAppUserProductPath("/admin")).toBe(false);
    expect(isAppUserProductPath("/login")).toBe(false);
    expect(isAppUserProductPath("/xstrategybuilder")).toBe(false);
    expect(isAppUserProductPath("/xstrategybuilder/foo")).toBe(false);
  });

  it("detects admin console paths", () => {
    expect(isAdminConsolePath("/admin")).toBe(true);
    expect(isAdminConsolePath("/admin/personas")).toBe(true);
    expect(isAdminConsolePath("/admin/recommendations")).toBe(true);
    expect(isAdminConsolePath("/xchat")).toBe(false);
  });

  it("requireApprovedLoginForProduct checks canUserLogin", () => {
    expect(
      requireApprovedLoginForProduct({
        userId: "u",
        email: "e",
        roles: ["viewer"],
        tenantId: "t",
        tenantRole: "member",
        xUserId: "x",
        username: "n"
      })
    ).toBe(true);
    expect(
      requireApprovedLoginForProduct({
        userId: "u",
        email: "e",
        roles: [],
        tenantId: "t",
        tenantRole: "member",
        xUserId: "x",
        username: "n"
      })
    ).toBe(false);
    expect(requireApprovedLoginForProduct(null)).toBe(false);
  });
});
