import { z } from "zod";

import type { ScheduledTask } from "@/modules/core-admin/types";

/** v1 allowed categories for tenant-operator scheduled rows (safe execution on Next task-runner). */
export const TENANT_USER_SCHEDULED_TASK_CATEGORIES = [
  "watchlist_price_scanner",
  "options_scanner",
  "notifications"
] as const satisfies readonly ScheduledTask["category"][];

export type TenantUserScheduledTaskCategory = (typeof TENANT_USER_SCHEDULED_TASK_CATEGORIES)[number];

export const tenantUserScheduledTaskCategorySchema = z.enum(TENANT_USER_SCHEDULED_TASK_CATEGORIES);

export function isTenantUserScheduledTaskCategory(
  value: string
): value is TenantUserScheduledTaskCategory {
  return (TENANT_USER_SCHEDULED_TASK_CATEGORIES as readonly string[]).includes(value);
}

/** Hard cap for enabled `ownerKind: tenant_user` rows per tenant (planOverrides may raise later). */
export function getMaxTenantUserScheduledTasks(): number {
  const raw = process.env.MAX_TENANT_USER_TASKS?.trim();
  if (!raw) {
    return 5;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 5;
  }
  const floor = Math.floor(n);
  if (floor < 1) {
    return 1;
  }
  if (floor > 50) {
    return 50;
  }
  return floor;
}

/** UI soft warning when enabled count reaches this threshold (spec: 3 of 5). */
export const TENANT_USER_TASK_SOFT_WARNING_THRESHOLD = 3;
