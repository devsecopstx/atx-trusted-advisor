import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

import {
  GET,
  POST
} from "@/app/api/admin/platform/tenant-ux/fail-closed-drill/route";

describe("admin tenant ux fail-closed drill route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"]
    });
  });

  it("returns drill cookie + env state", async () => {
    const res = await GET(
      new Request("http://test", {
        headers: { cookie: "xf_tenant_ux_fail_closed=1" }
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { enabled: boolean; envEnabled: boolean } };
    expect(body.data.enabled).toBe(true);
    expect(typeof body.data.envEnabled).toBe("boolean");
  });

  it("sets drill cookie through post", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true })
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("xf_tenant_ux_fail_closed=1");
  });

  it("passes through unauthorized response", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(401);
  });
});
