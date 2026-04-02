import { createHash } from "node:crypto";

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
  "daily_options_scanner",
  "corporate_events_scanner",
  "income_cash_flow_projector",
  "options_expiration_roll_manager",
  "risk_concentration_scanner",
  "tax_loss_harvest_scanner",
  "rebalance"
]);

export function isCoreScannerCategory(category: ScheduledTask["category"]): boolean {
  return CORE_SCANNER_CATEGORIES.has(category);
}

function readEnvInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** SHA-256 prefix for change detection / offline diffs without storing duplicate blobs. */
export function fingerprintUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function truncateOutput(output: string, maxChars: number): { text: string; truncated: boolean } {
  if (output.length <= maxChars) {
    return { text: output, truncated: false };
  }
  return {
    text: `${output.slice(0, Math.max(0, maxChars - 32))}\n…[core_scanner audit: output truncated]`,
    truncated: true
  };
}

/**
 * Stable, compact metrics for admin diffs / dashboards (fingerprints + full `auditDetails` may diverge when capped).
 */
export function extractSummaryForDiff(
  auditDetails: Record<string, unknown> | undefined,
  terminalStatus: string
): Record<string, unknown> {
  const out: Record<string, unknown> = { terminalStatus };
  if (!auditDetails) {
    return out;
  }
  const preferred = new Set([
    "skipped",
    "taskCategory",
    "marketDate",
    "marketTimezone",
    "portfolioCount",
    "accountCount",
    "itemsScanned",
    "strategyCount",
    "preferenceCount",
    "slugCount",
    "optionPositionCount",
    "uniqueUnderlyingCount",
    "alertsCreated",
    "chainFailures",
    "grokCalls",
    "recommendationsExamined",
    "recommendationsStored",
    "durationSeconds",
    "prefsFilterActive",
    "scanTargetsPrePrefs",
    "scanTargetsPostPrefs",
    "chainBatches",
    "watchlistOptionRows",
    "rollTargets",
    "rollMaxDte"
  ]);
  let n = 0;
  const maxKeys = 48;
  for (const [k, v] of Object.entries(auditDetails)) {
    if (preferred.has(k)) {
      out[k] = v;
      n += 1;
      continue;
    }
    if (n >= maxKeys) {
      break;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
      n += 1;
    } else if (typeof v === "string" && v.length <= 160) {
      out[k] = v;
      n += 1;
    }
  }
  return out;
}

function buildAlertsCsv(
  rows: ReadonlyArray<{
    portfolioId: string;
    symbol: string;
    changePct: number;
    newPrice: number;
  }>,
  maxRows: number
): { csv: string; rowsIncluded: number; truncated: boolean } {
  const header = "portfolioId,symbol,changePct,newPrice";
  const slice = rows.length > maxRows ? rows.slice(0, maxRows) : rows;
  const lines = slice.map(
    (r) => `${r.portfolioId},${r.symbol},${r.changePct.toFixed(2)},${String(r.newPrice)}`
  );
  const csv = [header, ...lines].join("\n");
  return {
    csv,
    rowsIncluded: slice.length,
    truncated: rows.length > maxRows
  };
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

function buildCoreScannerAuditPayload(input: {
  task: ScheduledTask;
  triggeredBy: string;
  result: ScheduledCategoryResult;
  taskRunIdHex: string;
}): Record<string, unknown> {
  const { task, triggeredBy, result, taskRunIdHex } = input;
  const outputMax = readEnvInt("CORE_SCANNER_AUDIT_OUTPUT_MAX_CHARS", 12000);
  const detailsJsonMax = readEnvInt("CORE_SCANNER_AUDIT_DETAILS_JSON_MAX_CHARS", 56000);

  const rawAudit = result.auditDetails ?? {};
  const rawAuditJson = JSON.stringify(rawAudit);
  const outPart = truncateOutput(result.output, outputMax);

  const base: Record<string, unknown> = {
    taskName: task.name,
    category: task.category,
    taskRunId: taskRunIdHex,
    triggeredBy,
    terminalStatus: result.status,
    output: outPart.text,
    outputFullChars: result.output.length,
    outputTruncated: outPart.truncated,
    outputFingerprint: fingerprintUtf8(result.output),
    auditDetailsFingerprint: fingerprintUtf8(rawAuditJson),
    summaryForDiff: extractSummaryForDiff(rawAudit, result.status)
  };

  const merged: Record<string, unknown> = { ...base, ...rawAudit };
  const mergedJson = JSON.stringify(merged);
  if (mergedJson.length <= detailsJsonMax) {
    return merged;
  }

  return {
    ...base,
    auditDetailsOversize: true,
    auditDetailsOriginalChars: rawAuditJson.length,
    auditDetailsMergedApproxChars: mergedJson.length,
    auditDetailKeys: Object.keys(rawAudit).sort()
  };
}

/**
 * PLAN 301 — Core Scanner Service: append `admin_audit_events` for scanner runs.
 * Payloads include **`summaryForDiff`**, **fingerprints**, and **size caps** (env) to control Mongo row weight.
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

  const details = buildCoreScannerAuditPayload({ task, triggeredBy, result, taskRunIdHex });

  const rows = result.auditAlertRows;
  const alertRowsMax = readEnvInt("CORE_SCANNER_AUDIT_ALERT_CSV_MAX_ROWS", 500);
  if (rows && rows.length > 0) {
    const { csv, rowsIncluded, truncated } = buildAlertsCsv(rows, alertRowsMax);
    details.alertsCreatedCsv = csv;
    details.alertsCsvRowsIncluded = rowsIncluded;
    details.alertsCsvTruncated = truncated;
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
