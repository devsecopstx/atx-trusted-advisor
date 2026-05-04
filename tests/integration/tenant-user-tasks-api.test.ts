import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gateMocks = vi.hoisted(() => ({
  requireTenantAutomationSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  listTenantUserScheduledTasks: vi.fn(),
  countEnabledTenantUserScheduledTasks: vi.fn(),
  insertTenantUserScheduledTask: vi.fn(),
  getTenantUserScheduledTaskById: vi.fn(),
  updateScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn(),
  listTaskRunsForTaskScoped: vi.fn()
}));

vi.mock("@/lib/require-tenant-automation-session", () => gateMocks);
vi.mock("@/modules/core-admin/repository", () => repoMocks);

import { DELETE, PATCH } from "@/app/api/tenant-tasks/[taskId]/route";
import { GET as GET_RUNS } from "@/app/api/tenant-tasks/[taskId]/runs/route";
import { GET, POST } from "@/app/api/tenant-tasks/route";

describe("/api/tenant-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMocks.requireTenantAutomationSession.mockResolvedValue({
      ok: true,
      session: {
        userId: "507f1f77bcf86cd799439011",
        tenantId: "507f1f77bcf86cd799439022",
        roles: ["operator"],
        email: "u@example.com",
        username: "u",
        tenantRole: "member",
        xUserId: "1"
      },
      tenantIdHex: "507f1f77bcf86cd799439022"
    });
    repoMocks.listTenantUserScheduledTasks.mockResolvedValue([]);
    repoMocks.countEnabledTenantUserScheduledTasks.mockResolvedValue(0);
  });

  it("GET returns 401 gate when session helper fails closed", async () => {
    gateMocks.requireTenantAutomationSession.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns list envelope", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[]; meta?: { maxTasks?: number } };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.meta?.maxTasks).toBe(5);
  });

  it("POST returns 400 on invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/tenant-tasks", { method: "POST", body: "{" })
    );
    expect(res.status).toBe(400);
  });

  it("POST returns 409 when enabled task cap reached", async () => {
    repoMocks.countEnabledTenantUserScheduledTasks.mockResolvedValue(5);
    const res = await POST(
      new Request("http://localhost/api/tenant-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          category: "notifications",
          scheduleCron: "0 9 * * *",
          enabled: true
        })
      })
    );
    expect(res.status).toBe(409);
  });

  it("PATCH returns 404 when task is not a tenant_user row", async () => {
    repoMocks.getTenantUserScheduledTaskById.mockResolvedValue(null);
    const res = await PATCH(
      new Request("http://localhost/api/tenant-tasks/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nope" })
      }),
      { params: Promise.resolve({ taskId: "507f1f77bcf86cd799439033" }) }
    );
    expect(res.status).toBe(404);
  });

  it("DELETE returns 404 when task missing", async () => {
    repoMocks.getTenantUserScheduledTaskById.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/tenant-tasks/x"), {
      params: Promise.resolve({ taskId: "507f1f77bcf86cd799439033" })
    });
    expect(res.status).toBe(404);
  });

  it("GET runs returns 404 when task missing", async () => {
    repoMocks.getTenantUserScheduledTaskById.mockResolvedValue(null);
    const res = await GET_RUNS(new Request("http://localhost/api/tenant-tasks/x/runs"), {
      params: Promise.resolve({ taskId: "507f1f77bcf86cd799439033" })
    });
    expect(res.status).toBe(404);
  });
});
