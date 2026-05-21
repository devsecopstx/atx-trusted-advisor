import { describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

const repoMocks = vi.hoisted(() => ({
  listScheduledTasks: vi.fn(),
  pruneDuplicateSystemWideScheduledTasks: vi.fn()
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: getDbMock
}));

vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    listScheduledTasks: repoMocks.listScheduledTasks,
    pruneDuplicateSystemWideScheduledTasks: repoMocks.pruneDuplicateSystemWideScheduledTasks
  };
});

const batchMocks = vi.hoisted(() => ({
  listBatchJobs: vi.fn().mockResolvedValue([] as unknown[])
}));

vi.mock("@/modules/xchat/batch-service", () => ({
  listBatchJobs: batchMocks.listBatchJobs
}));

import { collectAdminHubSummary } from "@/modules/admin/admin-hub-summary";

function mockDb(counts: { access?: number; taskRuns?: number; logins?: number }) {
  return {
    collection: (name: string) => {
      if (name === "xchat_usage_limits") {
        return {
          aggregate: () => ({
            toArray: vi.fn().mockResolvedValue([{ total: 5 }])
          })
        };
      }
      return {
        countDocuments: vi.fn().mockImplementation(async (filter: Record<string, unknown>) => {
          if (name === "admin_access_requests") {
            return counts.access ?? 0;
          }
          if (name === "admin_task_runs" && filter.status === "failed") {
            return counts.taskRuns ?? 0;
          }
          if (name === "audit_login") {
            return counts.logins ?? 0;
          }
          if (name === "strategy_jobs") {
            return 0;
          }
          return 0;
        })
      };
    }
  };
}

describe("collectAdminHubSummary", () => {
  it("builds quick stats with pending access emphasis", async () => {
    getDbMock.mockResolvedValue(mockDb({ access: 3, taskRuns: 2, logins: 9 }));
    repoMocks.pruneDuplicateSystemWideScheduledTasks.mockResolvedValue(undefined);
    repoMocks.listScheduledTasks.mockResolvedValue([
      { name: "job-a", category: "sync-broker", enabled: true, scheduleCron: "0 * * * *" },
      { name: "job-b", category: "price_scanner", enabled: false, scheduleCron: "0 * * * *" }
    ]);

    const summary = await collectAdminHubSummary({
      userId: "507f1f77bcf86cd799439011",
      email: "admin@example.com",
      username: "admin",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });

    expect(summary.pendingAccessRequests).toBe(3);
    expect(summary.enabledScheduledJobs).toBe(1);
    expect(summary.failedTaskRuns24h).toBe(2);
    expect(summary.loginsToday).toBe(9);
    expect(summary.quickStats.find((s) => s.id === "pending-access")?.emphasis).toBe("warn");
    expect(repoMocks.pruneDuplicateSystemWideScheduledTasks).toHaveBeenCalled();
  });
});
