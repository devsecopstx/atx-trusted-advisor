import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyScheduledMocks = vi.hoisted(() => ({
  proxyAdminScheduledTasksRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const adminSessionMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyAdminScheduledTasksRequestToBackend: proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend
  };
});

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdminSession: adminSessionMocks.requireAdminSession,
    requireAdminTenantIdHex: adminSessionMocks.requireAdminTenantIdHex
  };
});

const repoMocks = vi.hoisted(() => ({
  getScheduledTaskById: vi.fn(),
  updateScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    getScheduledTaskById: repoMocks.getScheduledTaskById,
    updateScheduledTask: repoMocks.updateScheduledTask,
    deleteScheduledTask: repoMocks.deleteScheduledTask
  };
});

import { DELETE as deleteAdminTask, PATCH as patchAdminTask } from "@/app/api/admin/tasks/[taskId]/route";
import { POST as postAdminTaskRun } from "@/app/api/admin/tasks/[taskId]/run/route";

describe("admin scheduled tasks — BFF proxy ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend.mockResolvedValue(null);
    adminSessionMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      username: "admin1",
      tenantRole: "tenant_admin"
    });
    adminSessionMocks.requireAdminTenantIdHex.mockResolvedValue("507f1f77bcf86cd799439022");
    repoMocks.getScheduledTaskById.mockResolvedValue({
      _id: "task1",
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId: null,
      scheduleCron: "0 9 * * *",
      scheduleRRule: null
    });
    repoMocks.updateScheduledTask.mockResolvedValue({
      _id: "task1",
      name: "patched",
      tenantId: "507f1f77bcf86cd799439022"
    });
    repoMocks.deleteScheduledTask.mockResolvedValue(true);
  });

  it("PATCH returns proxied response without calling requireAdminSession when proxy is non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { via: "bff" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend.mockResolvedValueOnce(proxied);
    adminSessionMocks.requireAdminSession.mockRejectedValue(
      new Error("requireAdminSession must not run when BFF proxy returns a response")
    );

    const req = new Request("http://test/api/admin/tasks/task_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "n1" })
    });
    const res = await patchAdminTask(req, { params: Promise.resolve({ taskId: "task_1" }) });
    expect(res.status).toBe(201);
    expect(proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend).toHaveBeenCalledWith(req);
    const body = (await res.json()) as { data: { via: string } };
    expect(body.data.via).toBe("bff");
  });

  it("DELETE returns proxied response without calling requireAdminSession when proxy is non-null", async () => {
    const proxied = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend.mockResolvedValueOnce(proxied);
    adminSessionMocks.requireAdminSession.mockRejectedValue(
      new Error("requireAdminSession must not run when BFF proxy returns a response")
    );

    const req = new Request("http://test/api/admin/tasks/task_1", { method: "DELETE" });
    const res = await deleteAdminTask(req, { params: Promise.resolve({ taskId: "task_1" }) });
    expect(res.status).toBe(200);
    expect(proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("POST run returns proxied response without calling requireAdminSession when proxy is non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { runId: "run_bff" } }), {
      status: 202,
      headers: { "Content-Type": "application/json" }
    });
    proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend.mockResolvedValueOnce(proxied);
    adminSessionMocks.requireAdminSession.mockRejectedValue(
      new Error("requireAdminSession must not run when BFF proxy returns a response")
    );

    const req = new Request("http://test/api/admin/tasks/task_1/run", { method: "POST" });
    const res = await postAdminTaskRun(req, { params: Promise.resolve({ taskId: "task_1" }) });
    expect(res.status).toBe(202);
    expect(proxyScheduledMocks.proxyAdminScheduledTasksRequestToBackend).toHaveBeenCalledWith(req);
  });
});
