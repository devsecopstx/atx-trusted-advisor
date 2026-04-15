import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getScheduledTaskByIdForInternalDelegate: vi.fn()
}));

const taskRunnerMocks = vi.hoisted(() => ({
  executeScheduledTask: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => ({
  getScheduledTaskByIdForInternalDelegate: repoMocks.getScheduledTaskByIdForInternalDelegate
}));

vi.mock("@/modules/core-admin/task-runner", () => ({
  executeScheduledTask: taskRunnerMocks.executeScheduledTask
}));

import { POST as postInternalSchedulerExecute } from "@/app/api/internal/scheduler/execute-task/route";

/** 32 chars — above the 24-char minimum in `internal-scheduler-execute-auth.ts`. */
const VALID_SECRET = "atx-scheduler-test-secret-32chars!!";

describe("POST /api/internal/scheduler/execute-task", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    process.env = { ...envSnapshot };
    process.env.ATX_SCHEDULER_INTERNAL_SECRET = VALID_SECRET;
    repoMocks.getScheduledTaskByIdForInternalDelegate.mockReset();
    taskRunnerMocks.executeScheduledTask.mockReset();
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("returns 503 when ATX_SCHEDULER_INTERNAL_SECRET is unset", async () => {
    delete process.env.ATX_SCHEDULER_INTERNAL_SECRET;
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": VALID_SECRET },
        body: JSON.stringify({ taskId: new ObjectId().toHexString() })
      })
    );
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 503 when secret is shorter than minimum length", async () => {
    process.env.ATX_SCHEDULER_INTERNAL_SECRET = "short";
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": "short" },
        body: JSON.stringify({ taskId: new ObjectId().toHexString() })
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 when header secret is missing", async () => {
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: new ObjectId().toHexString() })
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when header secret does not match (timing-safe)", async () => {
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": `${VALID_SECRET}x` },
        body: JSON.stringify({ taskId: new ObjectId().toHexString() })
      })
    );
    expect(res.status).toBe(401);
  });

  it("accepts X-Atx-Scheduler-Secret case-insensitively", async () => {
    const taskId = new ObjectId();
    repoMocks.getScheduledTaskByIdForInternalDelegate.mockResolvedValueOnce({
      _id: taskId,
      tenantId: new ObjectId(),
      name: "wl-scan",
      category: "watchlist_price_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true
    });
    const runId = new ObjectId();
    taskRunnerMocks.executeScheduledTask.mockResolvedValueOnce({
      runId,
      status: "success",
      output: "watchlist_price_scanner: ok"
    });

    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-atx-scheduler-secret": VALID_SECRET
        },
        body: JSON.stringify({ taskId: taskId.toHexString(), triggeredBy: "integration-test" })
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { runId?: string; status?: string; output?: string };
    };
    expect(json.data?.runId).toBe(runId.toHexString());
    expect(json.data?.status).toBe("success");
    expect(json.data?.output).toContain("watchlist_price_scanner");
    expect(repoMocks.getScheduledTaskByIdForInternalDelegate).toHaveBeenCalledWith(taskId.toHexString());
    expect(taskRunnerMocks.executeScheduledTask).toHaveBeenCalledWith(
      expect.objectContaining({ _id: taskId, category: "watchlist_price_scanner" }),
      "integration-test",
      undefined,
      {}
    );
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": VALID_SECRET },
        body: "{not-json"
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body fails zod (empty taskId)", async () => {
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": VALID_SECRET },
        body: JSON.stringify({ taskId: "  " })
      })
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string; details?: unknown };
    expect(json.error).toBe("Invalid body");
    expect(json.details).toBeDefined();
  });

  it("returns 404 when task id is valid hex but not found", async () => {
    repoMocks.getScheduledTaskByIdForInternalDelegate.mockResolvedValueOnce(null);
    const oid = new ObjectId();
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": VALID_SECRET },
        body: JSON.stringify({ taskId: oid.toHexString() })
      })
    );
    expect(res.status).toBe(404);
    expect(taskRunnerMocks.executeScheduledTask).not.toHaveBeenCalled();
  });

  it("returns 404 when task document has no _id", async () => {
    repoMocks.getScheduledTaskByIdForInternalDelegate.mockResolvedValueOnce({
      name: "orphan",
      category: "options_scanner",
      scheduleCron: "0 9 * * *",
      enabled: true
    } as import("@/modules/core-admin/types").ScheduledTask);
    const res = await postInternalSchedulerExecute(
      new Request("http://127.0.0.1/api/internal/scheduler/execute-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Atx-Scheduler-Secret": VALID_SECRET },
        body: JSON.stringify({ taskId: new ObjectId().toHexString() })
      })
    );
    expect(res.status).toBe(404);
    expect(taskRunnerMocks.executeScheduledTask).not.toHaveBeenCalled();
  });
});
