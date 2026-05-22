import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listScheduledTasks: vi.fn(),
  listDueScheduledTasks: vi.fn(),
  claimDueScheduledTaskForExecution: vi.fn(),
  pruneDuplicateSystemWideScheduledTasks: vi.fn(),
  findSystemWideScheduledTaskByCategory: vi.fn(),
  createScheduledTask: vi.fn()
}));

const runnerMocks = vi.hoisted(() => ({
  executeScheduledTask: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn()
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdminSession: authMocks.requireAdminSession,
    requireAdminTenantIdHex: authMocks.requireAdminTenantIdHex
  };
});
vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    // Keep scheduler/admin task tests hermetic (no backend proxy from shell env).
    proxyAdminScheduledTasksRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});
vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/modules/core-admin/task-runner", () => runnerMocks);
vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getTenantByHexId: identityMocks.getTenantByHexId
  };
});

import { POST as postSchedulerTick } from "@/app/api/admin/scheduler/tick/route";
import { GET as getTasks, POST as postTasks } from "@/app/api/admin/tasks/route";

describe("admin RBAC and scheduler semantics", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      email: "admin@example.com",
      username: "admin-user",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    authMocks.requireAdminTenantIdHex.mockResolvedValue("507f1f77bcf86cd799439022");
    repositoryMocks.listScheduledTasks.mockResolvedValue([]);
    repositoryMocks.listDueScheduledTasks.mockResolvedValue([]);
    repositoryMocks.claimDueScheduledTaskForExecution.mockResolvedValue(null);
    repositoryMocks.pruneDuplicateSystemWideScheduledTasks.mockResolvedValue(undefined);
    repositoryMocks.findSystemWideScheduledTaskByCategory.mockResolvedValue(null);
    runnerMocks.executeScheduledTask.mockResolvedValue({
      runId: new ObjectId("507f1f77bcf86cd799439055"),
      status: "success",
      output: "ok"
    });
    identityMocks.getTenantByHexId.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439022"),
      name: "Test workspace",
      slug: "test-workspace"
    });
  });

  it("blocks non-admin requests on tasks endpoint", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const response = await getTasks(new Request("http://localhost/api/admin/tasks"));
    expect(response.status).toBe(403);
    expect(repositoryMocks.listScheduledTasks).not.toHaveBeenCalled();
  });

  it("lists system-wide scheduled tasks (fan-out jobs, no task.tenantId)", async () => {
    repositoryMocks.listScheduledTasks.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439033"),
        name: "Watchlist price scanner",
        category: "watchlist_price_scanner",
        scheduleCron: "0 2 * * *",
        enabled: true
      }
    ]);

    const response = await getTasks(new Request("http://localhost/api/admin/tasks"));
    const payload = (await response.json()) as { data: Array<{ name: string }> };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.name).toBe("Watchlist price scanner");
    expect(repositoryMocks.pruneDuplicateSystemWideScheduledTasks).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listScheduledTasks).toHaveBeenCalledWith({
      tenantId: "507f1f77bcf86cd799439022",
      systemWideOnly: true,
      limit: 200
    });
  });

  it("returns 409 when creating a duplicate system-wide category", async () => {
    repositoryMocks.findSystemWideScheduledTaskByCategory.mockResolvedValueOnce({
      _id: new ObjectId("507f1f77bcf86cd799439099"),
      name: "sync-broker-job",
      category: "sync-broker",
      scheduleCron: "0 * * * *",
      enabled: true
    });

    const response = await postTasks(
      new Request("http://localhost/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "duplicate-broker",
          category: "sync-broker",
          scheduleCron: "0 3 * * *",
          enabled: true
        })
      })
    );

    expect(response.status).toBe(409);
    expect(repositoryMocks.createScheduledTask).not.toHaveBeenCalled();
  });

  it("runs due tasks for tenant and tags scheduler trigger", async () => {
    const dueTasks = [
      {
        _id: new ObjectId("507f1f77bcf86cd799439044"),
        tenantId: new ObjectId("507f1f77bcf86cd799439022"),
        name: "Daily Broker Sync",
        category: "sync-broker",
        scheduleCron: "0 2 * * *",
        enabled: true
      },
      {
        _id: new ObjectId("507f1f77bcf86cd799439045"),
        tenantId: new ObjectId("507f1f77bcf86cd799439022"),
        name: "Compliance Sweep",
        category: "compliance",
        scheduleCron: "0 5 * * *",
        enabled: true
      }
    ];
    repositoryMocks.listDueScheduledTasks.mockResolvedValueOnce(dueTasks);
    repositoryMocks.claimDueScheduledTaskForExecution
      .mockResolvedValueOnce(dueTasks[0])
      .mockResolvedValueOnce(dueTasks[1]);

    const response = await postSchedulerTick(
      new Request("http://localhost/api/admin/scheduler/tick", { method: "POST" })
    );
    const payload = (await response.json()) as {
      data: { processed: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.processed).toBe(2);
    expect(repositoryMocks.listDueScheduledTasks).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listDueScheduledTasks).toHaveBeenCalledWith(expect.any(Date), {
      tenantId: "507f1f77bcf86cd799439022"
    });
    expect(repositoryMocks.claimDueScheduledTaskForExecution).toHaveBeenCalledTimes(2);
    expect(runnerMocks.executeScheduledTask).toHaveBeenCalledTimes(2);
    expect(runnerMocks.executeScheduledTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Daily Broker Sync" }),
      "scheduler:admin-user",
      {
        userId: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        username: "admin-user"
      },
      { scheduleAlreadyClaimed: true }
    );
  });
});

