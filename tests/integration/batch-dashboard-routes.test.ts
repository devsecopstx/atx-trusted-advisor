import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const rateLimitMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn()
}));

const batchServiceMocks = vi.hoisted(() => ({
  listBatchJobs: vi.fn(),
  getBatchJobRecord: vi.fn(),
  listBatchItemResults: vi.fn(),
  pollBatchJob: vi.fn(),
  submitBatchJob: vi.fn()
}));

const personaMocks = vi.hoisted(() => ({
  getPersonaById: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/rate-limit", () => rateLimitMocks);
vi.mock("@/modules/xchat/batch-service", () => batchServiceMocks);
vi.mock("@/modules/xchat/repository", () => personaMocks);

import { GET as listBatchJobsRoute } from "@/app/api/xchat/batch/route";
import {
  GET as getBatchDetailRoute,
  POST as pollBatchDetailRoute
} from "@/app/api/xchat/batch/[batchId]/route";

describe("xchat batch dashboard read model routes", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      username: "ops_admin"
    });
    rateLimitMocks.checkRateLimit.mockReturnValue({
      allowed: true,
      resetAtMs: Date.now() + 60_000
    });
    batchServiceMocks.listBatchJobs.mockResolvedValue([
      {
        xaiBatchId: "batch_1",
        personaName: "Super-Agent",
        status: "in_progress",
        itemCount: 10,
        completedCount: 6,
        failedCount: 1,
        submittedBy: "ops_admin",
        createdAt: new Date("2026-03-17T10:00:00.000Z"),
        updatedAt: new Date("2026-03-17T10:02:00.000Z")
      },
      {
        xaiBatchId: "batch_2",
        personaName: "Research-Agent",
        status: "completed",
        itemCount: 5,
        completedCount: 5,
        failedCount: 0,
        submittedBy: "ops_admin",
        createdAt: new Date("2026-03-17T09:00:00.000Z"),
        updatedAt: new Date("2026-03-17T09:10:00.000Z"),
        completedAt: new Date("2026-03-17T09:10:00.000Z")
      }
    ]);

    batchServiceMocks.getBatchJobRecord.mockResolvedValue({
      xaiBatchId: "batch_1",
      personaName: "Super-Agent",
      status: "in_progress",
      itemCount: 10,
      completedCount: 6,
      failedCount: 1,
      submittedBy: "ops_admin",
      createdAt: new Date("2026-03-17T10:00:00.000Z"),
      updatedAt: new Date("2026-03-17T10:02:00.000Z")
    });
    batchServiceMocks.listBatchItemResults.mockResolvedValue([
      {
        itemId: "item_1",
        message: "one",
        scope: "global",
        status: "failed",
        errorMessage: "provider timeout"
      },
      {
        itemId: "item_2",
        message: "two",
        scope: "global",
        status: "completed",
        responseText: "done"
      }
    ]);
    batchServiceMocks.pollBatchJob.mockResolvedValue({
      xaiBatchId: "batch_1",
      status: "in_progress",
      itemCount: 10,
      completedCount: 7,
      failedCount: 1,
      completedAt: undefined
    });
  });

  it("returns list payload with dashboard summary", async () => {
    const response = await listBatchJobsRoute();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: Array<{ dashboard: { pendingCount: number; completionPct: number } }>;
      summary: { totalJobs: number; activeJobs: number; pendingItems: number };
    };

    expect(payload.summary.totalJobs).toBe(2);
    expect(payload.summary.activeJobs).toBe(1);
    expect(payload.summary.pendingItems).toBe(3);
    expect(payload.data[0].dashboard.pendingCount).toBe(3);
    expect(payload.data[0].dashboard.completionPct).toBe(70);
  });

  it("returns detail payload with dashboard object and lastError", async () => {
    const response = await getBatchDetailRoute(
      new Request("http://test/api/xchat/batch/batch_1"),
      { params: Promise.resolve({ batchId: "batch_1" }) }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { job: { dashboard: { lastError: string | null; pendingCount: number } } };
    };
    expect(payload.data.job.dashboard.lastError).toBe("provider timeout");
    expect(payload.data.job.dashboard.pendingCount).toBe(3);
  });

  it("returns poll payload with dashboard projection", async () => {
    const response = await pollBatchDetailRoute(
      new Request("http://test/api/xchat/batch/batch_1", { method: "POST" }),
      { params: Promise.resolve({ batchId: "batch_1" }) }
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { dashboard: { completionPct: number; pendingCount: number } };
    };
    expect(payload.data.dashboard.completionPct).toBe(80);
    expect(payload.data.dashboard.pendingCount).toBe(2);
  });

  it("passes through auth failure for list route", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await listBatchJobsRoute();
    expect(response.status).toBe(401);
  });
});
