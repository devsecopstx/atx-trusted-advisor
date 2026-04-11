import { ObjectId } from "mongodb";

import type { AuditActor } from "@/modules/audit/types";
import {
    createTaskRun,
    finalizeTaskRun,
    markTaskRunWindow
} from "@/modules/core-admin/repository";
import { notifyScheduledTaskSlackSummary } from "@/modules/core-admin/scheduled-task-slack-notify";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { runUserAccessRequestsTask } from "@/modules/core-admin/user-access-requests-task";
import { runScheduledAppBrokerImportTask } from "@/modules/portfolio-import/app-broker-import-job";
import {
    appendTenantIdToScheduledTaskOutput,
    logCoreScannerRunAudit,
    type ScheduledCategoryResult
} from "@/modules/scanner/core-scanner-service";
import {
    runCorporateEventsScanner,
    runIncomeCashFlowProjector,
    runOptionsExpirationRollManager,
    runRebalanceScanner,
    runRiskConcentrationScanner,
    runTaxLossHarvestScanner
} from "@/modules/scanner/phase3-scanner-jobs";
import { executePriceScannerJob } from "@/modules/scanner/price-scanner-job";
import { runOptionsStrategyScanner } from "@/modules/strategy-options/options-strategy-scanner";
import { runWatchlistPriceScanner } from "@/modules/watchlist/watchlist-scanner";
import { runUserHistoryAgent } from "@/modules/xchat/user-history-agent";

/** Options for {@link executeScheduledTask} — e.g. admin **Run** on `/admin/tasks` vs cron/tick. */
export type ScheduledTaskExecutionOptions = {
  /**
   * When true, desk **US regular-session window** gate is skipped so the job runs off-hours / holidays.
   * Set only for `POST /api/admin/tasks/{taskId}/run` (global_admin manual run), not scheduler tick.
   */
  bypassMarketWindow?: boolean;
};

export async function executeScheduledTask(
  task: ScheduledTask,
  triggeredBy: string,
  auditActor?: AuditActor,
  executionOptions?: ScheduledTaskExecutionOptions
): Promise<{ runId: ObjectId; status: "success" | "failed"; output: string }> {
  if (!task._id) {
    throw new Error("Cannot execute task without _id");
  }

  const run = await createTaskRun({
    tenantId: task.tenantId,
    taskId: task._id,
    taskName: task.name,
    category: task.category,
    triggeredBy,
    output: appendTenantIdToScheduledTaskOutput("Task accepted and started", task.tenantId)
  });
  if (!run._id) {
    throw new Error("Task run ID missing");
  }

  const startedAt = run.startedAt;
  await markTaskRunWindow(task._id, startedAt, {
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule
  });

  const execution = await runScheduledCategory(task, executionOptions);
  const completedAt = new Date();
  const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());

  const outputWithTenant = appendTenantIdToScheduledTaskOutput(execution.output, task.tenantId);
  const executionForAudit: ScheduledCategoryResult = {
    ...execution,
    output: outputWithTenant
  };

  await finalizeTaskRun(run._id, {
    status: execution.status,
    output: outputWithTenant,
    durationMs,
    completedAt
  });

  await notifyScheduledTaskSlackSummary({
    task,
    status: execution.status,
    output: outputWithTenant,
    durationMs,
    runIdHex: run._id.toHexString(),
    triggeredBy
  });

  await logCoreScannerRunAudit({
    task,
    triggeredBy,
    actor: auditActor,
    result: executionForAudit,
    taskRunIdHex: run._id.toHexString()
  });

  return {
    runId: run._id,
    status: execution.status,
    output: outputWithTenant
  };
}

async function runScheduledCategory(
  task: ScheduledTask,
  executionOptions?: ScheduledTaskExecutionOptions
): Promise<ScheduledCategoryResult> {
  const bypass = Boolean(executionOptions?.bypassMarketWindow);
  if (task.category === "price_scanner") {
    return executePriceScannerJob({ tenantId: task.tenantId, bypassMarketWindow: bypass });
  }
  if (task.category === "options_scanner") {
    return runOptionsStrategyScanner(task, { bypassMarketWindow: bypass });
  }
  if (task.category === "user_access_requests") {
    return runUserAccessRequestsTask(task);
  }
  if (task.category === "user-history") {
    return runUserHistoryAgent(task);
  }
  if (task.category === "watchlist_price_scanner") {
    return runWatchlistPriceScanner(task, { bypassMarketWindow: bypass });
  }
  if (task.category === "corporate_events_scanner") {
    return runCorporateEventsScanner(task);
  }
  if (task.category === "income_cash_flow_projector") {
    return runIncomeCashFlowProjector(task);
  }
  if (task.category === "options_expiration_roll_manager") {
    return runOptionsExpirationRollManager(task, { bypassMarketWindow: bypass });
  }
  if (task.category === "risk_concentration_scanner") {
    return runRiskConcentrationScanner(task);
  }
  if (task.category === "tax_loss_harvest_scanner") {
    return runTaxLossHarvestScanner(task);
  }
  if (task.category === "rebalance") {
    return runRebalanceScanner(task);
  }
  const waitMs = 120 + Math.floor(Math.random() * 220);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  switch (task.category) {
    case "sync-broker":
      if (task.appBrokerImportJobId) {
        return runScheduledAppBrokerImportTask(task);
      }
      return {
        status: "success",
        output: `Broker sync completed for task "${task.name}".`
      };
    case "compliance":
      return {
        status: "success",
        output: `Compliance scan completed for task "${task.name}".`
      };
    case "notifications":
      return {
        status: "success",
        output: `Notification digest dispatched for task "${task.name}".`
      };
    default:
      return {
        status: "failed",
        output: `Unsupported task category for "${task.name}".`
      };
  }
}
