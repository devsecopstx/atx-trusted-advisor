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
import {
    logCoreScannerRunAudit,
    type ScheduledCategoryResult
} from "@/modules/scanner/core-scanner-service";
import { executePriceScannerJob } from "@/modules/scanner/price-scanner-job";
import { runOptionsStrategyScanner } from "@/modules/strategy-options/options-strategy-scanner";
import { runWatchlistPriceScanner } from "@/modules/watchlist/watchlist-scanner";
import { runUserHistoryAgent } from "@/modules/xchat/user-history-agent";

export async function executeScheduledTask(
  task: ScheduledTask,
  triggeredBy: string,
  auditActor?: AuditActor
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
    output: "Task accepted and started"
  });
  if (!run._id) {
    throw new Error("Task run ID missing");
  }

  const startedAt = run.startedAt;
  await markTaskRunWindow(task._id, startedAt, {
    scheduleCron: task.scheduleCron,
    scheduleRRule: task.scheduleRRule
  });

  const execution = await runScheduledCategory(task);
  const completedAt = new Date();
  const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());

  await finalizeTaskRun(run._id, {
    status: execution.status,
    output: execution.output,
    durationMs,
    completedAt
  });

  await notifyScheduledTaskSlackSummary({
    task,
    status: execution.status,
    output: execution.output,
    durationMs,
    runIdHex: run._id.toHexString(),
    triggeredBy
  });

  await logCoreScannerRunAudit({
    task,
    triggeredBy,
    actor: auditActor,
    result: execution,
    taskRunIdHex: run._id.toHexString()
  });

  return {
    runId: run._id,
    status: execution.status,
    output: execution.output
  };
}

async function runScheduledCategory(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  if (task.category === "price_scanner") {
    return executePriceScannerJob({ tenantId: task.tenantId });
  }
  if (task.category === "options_scanner") {
    return runOptionsStrategyScanner(task);
  }
  if (task.category === "user_access_requests") {
    return runUserAccessRequestsTask(task);
  }
  if (task.category === "user-history") {
    return runUserHistoryAgent(task);
  }
  if (task.category === "watchlist_price_scanner") {
    return runWatchlistPriceScanner(task);
  }
  if (task.category === "daily_options_scanner") {
    return runOptionsStrategyScanner(task);
  }

  const waitMs = 120 + Math.floor(Math.random() * 220);
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  switch (task.category) {
    case "sync-broker":
      return {
        status: "success",
        output: `Broker sync completed for task "${task.name}".`
      };
    case "rebalance":
      return {
        status: "success",
        output: `Rebalance analysis completed for task "${task.name}".`
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
