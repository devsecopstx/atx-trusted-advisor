import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const taskRepoMocks = vi.hoisted(() => ({
  listUserTasksForUser: vi.fn(),
  countUserTasksForUser: vi.fn(),
  insertUserTask: vi.fn()
}));

const limitsMocks = vi.hoisted(() => ({
  getEffectiveWorkspaceLimitsForUser: vi.fn()
}));

const coreAdminRepoMocks = vi.hoisted(() => ({
  getPortfolioByIdForSessionUser: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/user-tasks/repository", () => taskRepoMocks);
vi.mock("@/lib/tenant-workspace-limits", () => limitsMocks);
vi.mock("@/modules/core-admin/repository", () => coreAdminRepoMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { GET, POST } from "@/app/api/tasks/route";

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
    taskRepoMocks.listUserTasksForUser.mockResolvedValue([]);
    taskRepoMocks.countUserTasksForUser.mockResolvedValue(0);
    taskRepoMocks.insertUserTask.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      userId: { toHexString: () => "507f1f77bcf86cd799439011" },
      portfolioId: null,
      name: "Daily Portfolio Monitor",
      type: "prompt",
      prompt: "Test prompt",
      personaId: null,
      scheduleCron: "0 9 * * *",
      scheduleRRule: undefined,
      scheduleDescription: "Daily",
      schedulePreset: "daily",
      timeZone: undefined,
      nextRunAt: new Date("2026-01-01T10:00:00.000Z"),
      lastRunAt: null,
      enabled: true,
      lastResultSnippet: null,
      lastRunId: null,
      delivery: ["in_app"],
      params: undefined,
      createdAt: new Date("2026-01-01T09:00:00.000Z"),
      updatedAt: new Date("2026-01-01T09:00:00.000Z")
    });
    limitsMocks.getEffectiveWorkspaceLimitsForUser.mockResolvedValue({
      userXoptionsLimit: 10,
      userChatLimit: 10,
      tenantPortfolioLimit: 1,
      portfolioAccountLimit: 1,
      changePersonaEnabled: true,
      chatHistoryMax: 10,
      maxUsersPerTenant: 5,
      userTasksMax: 5
    });
    coreAdminRepoMocks.getPortfolioByIdForSessionUser.mockResolvedValue(null);
  });

  it("returns 401 when session gate fails", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("GET returns list with meta", async () => {
    taskRepoMocks.countUserTasksForUser.mockResolvedValueOnce(2);
    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { meta?: { totalCount?: number; userTasksMax?: number } };
    expect(json.meta?.totalCount).toBe(2);
    expect(json.meta?.userTasksMax).toBe(5);
  });

  it("POST returns 409 when tenant user task cap reached", async () => {
    taskRepoMocks.countUserTasksForUser.mockResolvedValueOnce(5);
    const res = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Daily",
          type: "prompt",
          prompt: "Monitor portfolio",
          schedule: { preset: "daily" }
        })
      })
    );
    expect(res.status).toBe(409);
  });

  it("POST returns 403 when persona override is disabled", async () => {
    limitsMocks.getEffectiveWorkspaceLimitsForUser.mockResolvedValueOnce({
      userXoptionsLimit: 10,
      userChatLimit: 10,
      tenantPortfolioLimit: 1,
      portfolioAccountLimit: 1,
      changePersonaEnabled: false,
      chatHistoryMax: 10,
      maxUsersPerTenant: 5,
      userTasksMax: 5
    });
    const res = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Daily",
          type: "prompt",
          prompt: "Monitor portfolio",
          personaId: "507f1f77bcf86cd799439088",
          schedule: { preset: "daily" }
        })
      })
    );
    expect(res.status).toBe(403);
  });
});
