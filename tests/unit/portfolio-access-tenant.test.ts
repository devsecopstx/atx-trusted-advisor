import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/auth";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";

function baseSession(overrides: Partial<SessionUser>): SessionUser {
  return {
    userId: "507f1f77bcf86cd799439011",
    email: "u@example.com",
    roles: ["viewer"],
    tenantId: "507f1f77bcf86cd799439011",
    tenantRole: "member",
    xUserId: "1",
    username: "u",
    ...overrides
  };
}

describe("requireTenantHexForPortfolioDataPlane", () => {
  it("returns 403 when tenant id is empty or not a valid ObjectId hex", () => {
    for (const tenantId of ["", "not-hex", "123"]) {
      const res = requireTenantHexForPortfolioDataPlane(baseSession({ tenantId }));
      expect(res).toBeInstanceOf(NextResponse);
      expect((res as NextResponse).status).toBe(403);
    }
  });

  it("returns null when tenant id is valid", () => {
    expect(requireTenantHexForPortfolioDataPlane(baseSession({}))).toBeNull();
  });
});
