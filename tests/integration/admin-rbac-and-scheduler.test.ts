import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listScheduledTasks: vi.fn(),
  listDueScheduledTasks: vi.fn()
}));

const runnerMocks = vi.hoisted(() => ({
  executeScheduledTask: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/modules/core-admin/task-runner", () => runnerMocks);

import { GET as getTasks } from "@/app/api/admin/tasks/route";
import { POST as postSchedulerTick } from "@/app/api/admin/scheduler/tick/route";

describe("admin RBAC and scheduler semantics", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      username: "admin-user",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    repositoryMocks.listScheduledTasks.mockResolvedValue([]);
    repositoryMocks.listDueScheduledTasks.mockResolvedValue([]);
    runnerMocks.executeScheduledTask.mockResolvedValue({
      runId: new ObjectId("507f1f77bcf86cd799439055"),
      status: "success",
      output: "ok"
    });
  });

  it("blocks non-admin requests on tasks endpoint", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const response = await getTasks();
    expect(response.status).toBe(403);
    expect(repositoryMocks.listScheduledTasks).not.toHaveBeenCalled();
  });

  it("lists tasks scoped to session tenant", async () => {
    repositoryMocks.listScheduledTasks.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439033"),
        tenantId: new ObjectId("507f1f77bcf86cd799439022"),
        name: "Daily Broker Sync",
        category: "sync-broker",
        scheduleCron: "0 2 * * *",
        enabled: true
      }
    ]);

    const response = await getTasks();
    const payload = (await response.json()) as { data: Array<{ name: string }> };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.name).toBe("Daily Broker Sync");
    expect(repositoryMocks.listScheduledTasks).toHaveBeenCalledWith({
      tenantId: "507f1f77bcf86cd799439022"
    });
  });

  it("runs due tasks for tenant and tags scheduler trigger", async () => {
    repositoryMocks.listDueScheduledTasks.mockResolvedValueOnce([
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
    ]);

    const response = await postSchedulerTick();
    const payload = (await response.json()) as {
      data: { processed: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.processed).toBe(2);
    expect(repositoryMocks.listDueScheduledTasks).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listDueScheduledTasks).toHaveBeenCalledWith(expect.any(Date), {
      tenantId: "507f1f77bcf86cd799439022"
    });
    expect(runnerMocks.executeScheduledTask).toHaveBeenCalledTimes(2);
    expect(runnerMocks.executeScheduledTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Daily Broker Sync" }),
      "scheduler:admin-user"
    );
  });
});

