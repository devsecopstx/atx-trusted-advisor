import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/modules/audit/repository", () => auditMocks);

import {
    appendTenantIdToScheduledTaskOutput,
    extractSummaryForDiff,
    fingerprintUtf8,
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
    expect(isCoreScannerCategory("corporate_events_scanner")).toBe(true);
    expect(isCoreScannerCategory("income_cash_flow_projector")).toBe(true);
    expect(isCoreScannerCategory("options_expiration_roll_manager")).toBe(true);
    expect(isCoreScannerCategory("risk_concentration_scanner")).toBe(true);
    expect(isCoreScannerCategory("tax_loss_harvest_scanner")).toBe(true);
    expect(isCoreScannerCategory("rebalance")).toBe(true);
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
    expect(details?.summaryForDiff).toMatchObject({ terminalStatus: "success", alertsCreated: 1 });
    expect(typeof details?.outputFingerprint).toBe("string");
    expect((details?.outputFingerprint as string).length).toBe(16);
  });

  it("uses explicit actor when provided", async () => {
    const taskId = new ObjectId();
    const result: ScheduledCategoryResult = { status: "success", output: "x" };

    await logCoreScannerRunAudit({
      task: {
        _id: taskId,
        name: "Opt",
        category: "options_scanner",
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

  it("truncates huge task output and sets flags", async () => {
    const taskId = new ObjectId();
    const long = "x".repeat(50_000);
    vi.stubEnv("CORE_SCANNER_AUDIT_OUTPUT_MAX_CHARS", "1000");
    const result: ScheduledCategoryResult = { status: "success", output: long };

    await logCoreScannerRunAudit({
      task: {
        _id: taskId,
        name: "P",
        category: "price_scanner",
        scheduleCron: "0 * * * *",
        enabled: true
      },
      triggeredBy: "scheduler:t",
      result,
      taskRunIdHex: "507f1f77bcf86cd799439088"
    });

    const payload = auditMocks.createAuditEvent.mock.calls[0]?.[0];
    const details = payload?.details as Record<string, unknown>;
    expect(details?.outputTruncated).toBe(true);
    expect(details?.outputFullChars).toBe(50_000);
    expect(String(details?.output).length).toBeLessThan(50_000);
    expect(details?.outputFingerprint).toBe(fingerprintUtf8(long));
    vi.unstubAllEnvs();
  });

  it("drops flat auditDetails when merged JSON exceeds cap", async () => {
    const taskId = new ObjectId();
    const fat: Record<string, unknown> = {};
    for (let i = 0; i < 4000; i++) {
      fat[`k${i}`] = "0123456789";
    }
    vi.stubEnv("CORE_SCANNER_AUDIT_DETAILS_JSON_MAX_CHARS", "8000");
    const result: ScheduledCategoryResult = {
      status: "success",
      output: "ok",
      auditDetails: fat
    };

    await logCoreScannerRunAudit({
      task: {
        _id: taskId,
        name: "O",
        category: "options_scanner",
        scheduleCron: "0 9 * * *",
        enabled: true
      },
      triggeredBy: "scheduler:t",
      result,
      taskRunIdHex: "507f1f77bcf86cd799439088"
    });

    const payload = auditMocks.createAuditEvent.mock.calls[0]?.[0];
    const details = payload?.details as Record<string, unknown>;
    expect(details?.auditDetailsOversize).toBe(true);
    expect(Array.isArray(details?.auditDetailKeys)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("extractSummaryForDiff picks preferred scanner keys", () => {
    const s = extractSummaryForDiff(
      {
        portfolioCount: 3,
        alertsCreated: 2,
        noise: "x".repeat(500)
      },
      "success"
    );
    expect(s.terminalStatus).toBe("success");
    expect(s.portfolioCount).toBe(3);
    expect(s.alertsCreated).toBe(2);
    expect(s.noise).toBeUndefined();
  });

  it("appendTenantIdToScheduledTaskOutput prefixes once", () => {
    const oid = new ObjectId();
    expect(appendTenantIdToScheduledTaskOutput("done", oid)).toBe(
      `tenantId=${oid.toHexString()} | done`
    );
    expect(appendTenantIdToScheduledTaskOutput("done", undefined)).toBe("tenantId=none | done");
    const already = `tenantId=${oid.toHexString()} | x`;
    expect(appendTenantIdToScheduledTaskOutput(already, oid)).toBe(already);
  });

  it("core_scanner audit details include tenantIdHex from task", async () => {
    const taskId = new ObjectId();
    const tenantId = new ObjectId();
    await logCoreScannerRunAudit({
      task: {
        _id: taskId,
        tenantId,
        name: "P",
        category: "price_scanner",
        scheduleCron: "0 * * * *",
        enabled: true
      },
      triggeredBy: "scheduler:t",
      result: { status: "success", output: "ok" },
      taskRunIdHex: "507f1f77bcf86cd799439088"
    });
    const details = auditMocks.createAuditEvent.mock.calls[0]?.[0]?.details as Record<
      string,
      unknown
    >;
    expect(details?.tenantIdHex).toBe(tenantId.toHexString());
  });
});
