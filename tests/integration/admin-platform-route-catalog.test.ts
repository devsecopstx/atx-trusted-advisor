import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

import { GET } from "@/app/api/admin/platform/route-catalog/route";

describe("GET /api/admin/platform/route-catalog", () => {
  beforeEach(() => {
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@atxfinance.ai",
      username: "admin"
    });
  });

  it("returns catalog JSON for global_admin", async () => {
    const res = await GET();
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { catalogKind?: string; entries?: unknown[] };
    expect(body.catalogKind).toBe("app_user_route_catalog");
    expect(Array.isArray(body.entries)).toBe(true);
    expect((body.entries as unknown[]).length).toBeGreaterThan(5);
  });

  it("returns 403 when not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
