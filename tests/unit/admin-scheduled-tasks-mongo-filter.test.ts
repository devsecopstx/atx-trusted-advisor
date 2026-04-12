import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requiredEnv = {
  XAI_API_KEY: "test-xai",
  XAI_MANAGEMENT_API_KEY: "test-mgmt",
  X_OAUTH_CLIENT_ID: "id",
  X_OAUTH_CLIENT_SECRET: "secret"
} as const;

const scheduledTasksMongo = vi.hoisted(() => {
  const findMock = vi.fn();
  const getDb = vi.fn();
  return { findMock, getDb };
});

function stubFindChain(): void {
  scheduledTasksMongo.findMock.mockReset();
  scheduledTasksMongo.findMock.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
    })
  });
}

vi.mock("@/lib/mongodb", () => ({
  getDb: scheduledTasksMongo.getDb
}));

import { listDueScheduledTasks, listScheduledTasks } from "@/modules/core-admin/repository";

describe("listScheduledTasks tenant read scope (admin /api/admin/tasks)", () => {
  beforeEach(() => {
    Object.assign(process.env, requiredEnv);
    stubFindChain();
    scheduledTasksMongo.getDb.mockReset();
    scheduledTasksMongo.getDb.mockImplementation(async () => ({
      collection: () => ({ find: scheduledTasksMongo.findMock })
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses $and with portfolio filter + tenant OR legacy null/missing tenantId", async () => {
    const tenantHex = "507f1f77bcf86cd799439022";
    const tenantOid = new ObjectId(tenantHex);

    await listScheduledTasks({ tenantId: tenantHex, limit: 50 });

    expect(scheduledTasksMongo.findMock).toHaveBeenCalledTimes(1);
    const filter = scheduledTasksMongo.findMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(filter).toEqual({
      $and: [
        {
          $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
        },
        {
          $or: [{ tenantId: tenantOid }, { tenantId: null }, { tenantId: { $exists: false } }]
        }
      ]
    });
  });

  it("systemWideOnly uses portfolio filter + null/missing tenantId only", async () => {
    await listScheduledTasks({ tenantId: "507f1f77bcf86cd799439022", systemWideOnly: true, limit: 50 });

    expect(scheduledTasksMongo.findMock).toHaveBeenCalledTimes(1);
    const filter = scheduledTasksMongo.findMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(filter).toEqual({
      $and: [
        {
          $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
        },
        { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] }
      ]
    });
  });
});

describe("listDueScheduledTasks tenant read scope (scheduler tick)", () => {
  beforeEach(() => {
    Object.assign(process.env, requiredEnv);
    stubFindChain();
    scheduledTasksMongo.getDb.mockReset();
    scheduledTasksMongo.getDb.mockImplementation(async () => ({
      collection: () => ({ find: scheduledTasksMongo.findMock })
    }));
  });

  it("includes legacy null/missing tenantId alongside session tenant", async () => {
    const tenantHex = "507f1f77bcf86cd799439022";
    const tenantOid = new ObjectId(tenantHex);
    const now = new Date("2026-01-15T12:00:00.000Z");

    await listDueScheduledTasks(now, { tenantId: tenantHex });

    expect(scheduledTasksMongo.findMock).toHaveBeenCalledTimes(1);
    const filter = scheduledTasksMongo.findMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(filter).toEqual({
      $and: [
        {
          enabled: true,
          nextRunAt: { $lte: now },
          $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
        },
        {
          $or: [{ tenantId: tenantOid }, { tenantId: null }, { tenantId: { $exists: false } }]
        }
      ]
    });
  });
});
