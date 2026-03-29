import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/modules/audit/repository", () => auditMocks);

import {
    isCoreScannerCategory,
    logCoreScannerRunAudit,
    type ScheduledCategoryResult
} from "@/modules/scanner/core-scanner-service";

describe("core-scanner-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMocks.createAuditEvent.mockResolvedValue({});
  });

  it("isCoreScannerCategory is true for scanner categories", () => {
    expect(isCoreScannerCategory("price_scanner")).toBe(true);
    expect(isCoreScannerCategory("options_scanner")).toBe(true);
    expect(isCoreScannerCategory("watchlist_price_scanner")).toBe(true);
    expect(isCoreScannerCategory("daily_options_scanner")).toBe(true);
    expect(isCoreScannerCategory("sync-broker")).toBe(false);
  });

  it("writes core_scanner audit with CSV when alert rows present", async () => {
    const taskId = new ObjectId();
    const runId = new ObjectId();
    const result: ScheduledCategoryResult = {
      status: "success",
      output: "ok",
      auditDetails: { alertsCreated: 1 },
      auditAlertRows: [
        { portfolioId: "507f1f77bcf86cd799439011", symbol: "TSLA", changePct: 6.1, newPrice: 250 }
      ]
    };

    await logCoreScannerRunAudit({
      task: {
        _id: taskId,
        name: "WL",
        category: "watchlist_price_scanner",
        scheduleCron: "0 * * * *",
        enabled: true
      },
      triggeredBy: "scheduler:ops",
      result,
      taskRunIdHex: runId.toHexString()
    });

    expect(auditMocks.createAuditEvent).toHaveBeenCalledTimes(1);
    const payload = auditMocks.createAuditEvent.mock.calls[0]?.[0];
    expect(payload?.entityType).toBe("core_scanner");
    expect(payload?.entityId).toBe(taskId.toHexString());
    expect(payload?.action).toBe("scanner_run_completed");
    expect(payload?.actor.username).toBe("ops");
    const details = payload?.details as Record<string, unknown>;
    expect(details?.alertsCreatedCsv).toContain("portfolioId,symbol,changePct,newPrice");
    expect(details?.alertsCreatedCsv).toContain("TSLA");
    expect(details?.taskRunId).toBe(runId.toHexString());
  });

  it("uses explicit actor when provided", async () => {
    const taskId = new ObjectId();
    const result: ScheduledCategoryResult = { status: "success", output: "x" };

    await logCoreScannerRunAudit({
      task: {
        _id: taskId,
        name: "Opt",
        category: "daily_options_scanner",
        scheduleCron: "0 9 * * *",
        enabled: true
      },
      triggeredBy: "u1",
      actor: { userId: "507f1f77bcf86cd799439099", email: "a@b.co", username: "alice" },
      result,
      taskRunIdHex: "507f1f77bcf86cd799439088"
    });

    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: "507f1f77bcf86cd799439099", email: "a@b.co", username: "alice" }
      })
    );
  });

  it("no-ops for non-scanner categories", async () => {
    await logCoreScannerRunAudit({
      task: {
        name: "Sync",
        category: "sync-broker",
        scheduleCron: "0 2 * * *",
        enabled: true
      },
      triggeredBy: "scheduler:x",
      result: { status: "success", output: "y" },
      taskRunIdHex: "507f1f77bcf86cd799439088"
    });
    expect(auditMocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it("swallows createAuditEvent errors", async () => {
    auditMocks.createAuditEvent.mockRejectedValueOnce(new Error("mongo down"));
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await logCoreScannerRunAudit({
      task: {
        _id: new ObjectId(),
        name: "WL",
        category: "watchlist_price_scanner",
        scheduleCron: "0 * * * *",
        enabled: true
      },
      triggeredBy: "scheduler:z",
      result: { status: "success", output: "z" },
      taskRunIdHex: "507f1f77bcf86cd799439088"
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
