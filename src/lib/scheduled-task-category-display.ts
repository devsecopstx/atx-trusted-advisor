import { SCHEDULED_TASK_CATEGORY_CATALOG } from "@/lib/scheduled-task-category-catalog";
import {
    SCHEDULED_TASK_CATEGORIES,
    type ScheduledTaskCategory
} from "@/lib/scheduled-task-category-schema";

export function isKnownScheduledTaskCategory(category: string): category is ScheduledTaskCategory {
  return (SCHEDULED_TASK_CATEGORIES as readonly string[]).includes(category);
}

/** Human label from catalog; `undefined` when slug is missing or not a known executor category. */
export function scheduledTaskCategoryDisplayName(category: string): string | undefined {
  if (!isKnownScheduledTaskCategory(category)) {
    return undefined;
  }
  return SCHEDULED_TASK_CATEGORY_CATALOG[category].displayName;
}
