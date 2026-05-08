import { ObjectId } from "mongodb";

import { SCHEDULED_TASK_CATEGORY_DEFAULT_CRON } from "@/lib/scheduled-task-category-schema";
import { createScheduledTask, listScheduledTasks } from "@/modules/core-admin/repository";

/**
 * Idempotent: ensures exactly one enabled tenant-level `user_alert_manager` row exists.
 * Called when the first NL price alert is created for a tenant (Architect spec).
 */
export async function ensureUserAlertManagerScheduledTaskForTenant(tenantIdHex: string): Promise<void> {
  if (!ObjectId.isValid(tenantIdHex)) {
    return;
  }
  const existing = await listScheduledTasks({ tenantId: tenantIdHex, limit: 300 });
  if (existing.some((t) => t.category === "user_alert_manager")) {
    return;
  }
  await createScheduledTask({
    name: "User price alert manager",
    category: "user_alert_manager",
    scheduleCron: SCHEDULED_TASK_CATEGORY_DEFAULT_CRON.user_alert_manager,
    enabled: true,
    tenantId: tenantIdHex
  });
}
