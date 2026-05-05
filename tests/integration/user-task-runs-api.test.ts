import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  listUserTaskRunsForTask: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/user-tasks/repository", () => repoMocks);

import { GET } from "@/app/api/tasks/[taskId]/runs/route";

describe("GET /api/tasks/{taskId}/runs", () => {
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
    repoMocks.listUserTaskRunsForTask.mockResolvedValue([]);
  });

  it("returns 401 when session helper fails", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(new Request("http://localhost/api/tasks/t/runs"), {
      params: Promise.resolve({ taskId: "507f1f77bcf86cd799439033" })
    });
    expect(res.status).toBe(401);
  });

  it("returns run list envelope", async () => {
    const res = await GET(new Request("http://localhost/api/tasks/t/runs?limit=10"), {
      params: Promise.resolve({ taskId: "507f1f77bcf86cd799439033" })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(json.data)).toBe(true);
  });
});
