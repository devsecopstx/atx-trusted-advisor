import { createAuditEvent } from "@/modules/audit/repository";
import type { AuditActor } from "@/modules/audit/types";
import type { ScheduledTask } from "@/modules/core-admin/types";

/** Result shape for scheduled task category executors (PLAN 301 audit hooks). */
export type ScheduledCategoryResult = {
  status: "success" | "failed";
  output: string;
  auditDetails?: Record<string, unknown>;
  /** Materialized price alerts this run (watchlist scanner) for optional CSV in audit. */
  auditAlertRows?: ReadonlyArray<{
    portfolioId: string;
    symbol: string;
    changePct: number;
    newPrice: number;
  }>;
};

const CORE_SCANNER_CATEGORIES = new Set<ScheduledTask["category"]>([
  "price_scanner",
  "options_scanner",
  "watchlist_price_scanner",
  "daily_options_scanner"
]);

export function isCoreScannerCategory(category: ScheduledTask["category"]): boolean {
  return CORE_SCANNER_CATEGORIES.has(category);
}

function buildAlertsCsv(
  rows: ReadonlyArray<{
    portfolioId: string;
    symbol: string;
    changePct: number;
    newPrice: number;
  }>
): string {
  const header = "portfolioId,symbol,changePct,newPrice";
  const lines = rows.map(
    (r) => `${r.portfolioId},${r.symbol},${r.changePct.toFixed(2)},${String(r.newPrice)}`
  );
  return [header, ...lines].join("\n");
}

function resolveAuditActor(triggeredBy: string, actor?: AuditActor): AuditActor {
  if (actor) {
    return actor;
  }
  const m = /^scheduler:(.+)$/.exec(triggeredBy);
  return {
    userId: "000000000000000000000000",
    username: m?.[1] ?? "scheduler"
  };
}

/**
 * PLAN 301 — Core Scanner Service: append `admin_audit_events` for watchlist + options scanner runs.
 * Failures are logged only; they never fail the scheduled task.
 */
export async function logCoreScannerRunAudit(input: {
  task: ScheduledTask;
  triggeredBy: string;
  actor?: AuditActor;
  result: ScheduledCategoryResult;
  taskRunIdHex: string;
}): Promise<void> {
  const { task, triggeredBy, result, taskRunIdHex } = input;
  if (!isCoreScannerCategory(task.category)) {
    return;
  }

  const entityId = task._id?.toHexString() ?? `category:${task.category}`;
  const actor = resolveAuditActor(triggeredBy, input.actor);

  const details: Record<string, unknown> = {
    taskName: task.name,
    category: task.category,
    taskRunId: taskRunIdHex,
    triggeredBy,
    terminalStatus: result.status,
    output: result.output,
    ...(result.auditDetails ?? {})
  };

  const rows = result.auditAlertRows;
  if (rows && rows.length > 0) {
    details.alertsCreatedCsv = buildAlertsCsv(rows);
  }

  try {
    await createAuditEvent({
      entityType: "core_scanner",
      entityId,
      action: result.status === "success" ? "scanner_run_completed" : "scanner_run_failed",
      actor,
      details
    });
  } catch (error) {
    console.warn("[core-scanner/audit] createAuditEvent failed", {
      category: task.category,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
