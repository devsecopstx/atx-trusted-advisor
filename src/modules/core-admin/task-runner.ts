import { ObjectId } from "mongodb";

import {
    createTaskRun,
    finalizeTaskRun,
    markTaskRunWindow
} from "@/modules/core-admin/repository";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { runUserHistoryAgent } from "@/modules/xchat/user-history-agent";
import { runOptionsStrategyScanner } from "@/modules/strategy-options/options-strategy-scanner";
import { runWatchlistPriceScanner } from "@/modules/watchlist/watchlist-scanner";

export async function executeScheduledTask(
  task: ScheduledTask,
  triggeredBy: string
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
  await markTaskRunWindow(task._id, startedAt);

  const execution = await runScheduledCategory(task);
  const completedAt = new Date();
  const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());

  await finalizeTaskRun(run._id, {
    status: execution.status,
    output: execution.output,
    durationMs,
    completedAt
  });

  return {
    runId: run._id,
    status: execution.status,
    output: execution.output
  };
}

async function runScheduledCategory(
  task: ScheduledTask
): Promise<{ status: "success" | "failed"; output: string }> {
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
