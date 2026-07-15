import { ObjectId } from "mongodb";

import { SCHEDULED_TASK_CATEGORY_CATALOG } from "@/lib/scheduled-task-category-catalog";
import type { ScheduledTaskCategory } from "@/lib/scheduled-task-category-schema";
import type { ScheduledTask } from "@/modules/core-admin/types";

/**
 * System-wide categories that intentionally allow many rows (Marketing Scheduler posts, etc.).
 * Default platform jobs stay one-per-category; these are excluded from collapse/prune.
 */
export const SYSTEM_WIDE_MULTI_INSTANCE_CATEGORIES: ReadonlySet<ScheduledTaskCategory> = new Set([
  "marketing_post"
]);

export function isSystemWideMultiInstanceCategory(category: string): boolean {
  return SYSTEM_WIDE_MULTI_INSTANCE_CATEGORIES.has(category as ScheduledTaskCategory);
}

/** Mongo filter for tenant-level system jobs (no tenantId, no portfolioId). */
export function systemWideScheduledTaskCategoryFilter(category: string) {
  return {
    category,
    $and: [
      { $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }] },
      { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] }
    ]
  };
}

function taskSortKey(row: ScheduledTask): number {
  const category = row.category as ScheduledTaskCategory;
  const catalog = SCHEDULED_TASK_CATEGORY_CATALOG[category];
  const canonicalName = catalog?.defaultJobName?.trim() ?? "";
  const displayName = catalog?.displayName?.trim() ?? "";
  const name = (row.name ?? "").trim();
  let score = 0;
  if (canonicalName && name === canonicalName) {
    score += 100;
  } else if (displayName && name === displayName) {
    score += 40;
  }
  if (row.enabled) {
    score += 10;
  }
  const tie =
    row._id instanceof ObjectId
      ? row._id.getTimestamp().getTime()
      : row.lastRunAt instanceof Date
        ? row.lastRunAt.getTime()
        : 0;
  return score * 1e15 + tie;
}

/** Pick one row to keep when multiple system-wide jobs share a category. */
export function pickCanonicalSystemWideScheduledTask(rows: ScheduledTask[]): ScheduledTask {
  return [...rows].sort((a, b) => taskSortKey(b) - taskSortKey(a))[0]!;
}

/**
 * Collapse to at most one system-wide row per singleton `category` (stable order by name).
 * Multi-instance categories (e.g. `marketing_post`) keep every row.
 * Use after `listScheduledTasks({ systemWideOnly: true })` or before returning admin UI data.
 */
export function dedupeSystemWideScheduledTasksByCategory(rows: ScheduledTask[]): ScheduledTask[] {
  const byCategory = new Map<string, ScheduledTask[]>();
  for (const row of rows) {
    const key = row.category;
    const bucket = byCategory.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byCategory.set(key, [row]);
    }
  }
  const out: ScheduledTask[] = [];
  for (const key of [...byCategory.keys()].sort()) {
    const bucket = byCategory.get(key)!;
    if (isSystemWideMultiInstanceCategory(key)) {
      out.push(
        ...[...bucket].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
        )
      );
      continue;
    }
    out.push(pickCanonicalSystemWideScheduledTask(bucket));
  }
  return out.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
}

export function scheduledTaskRowIdHex(row: ScheduledTask): string | null {
  const id = row._id;
  if (!id) {
    return null;
  }
  return typeof id === "string" ? id : id.toHexString();
}
