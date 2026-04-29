import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

import { GET } from "@/app/api/tasks/route";

describe("/api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"],
      email: "u@example.com",
      username: "u",
      tenantRole: "member",
      xUserId: "1"
    });
  });

  it("returns 401 when session gate fails", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(401);
  });
});
