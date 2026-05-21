import { describe, expect, it } from "vitest";

import {
    isKnownScheduledTaskCategory,
    scheduledTaskCategoryDisplayName
} from "@/lib/scheduled-task-category-display";

describe("scheduled-task-category-display", () => {
  it("recognizes executor slugs", () => {
    expect(isKnownScheduledTaskCategory("marketing_post")).toBe(true);
    expect(scheduledTaskCategoryDisplayName("marketing_post")).toContain("Marketing post");
  });

  it("rejects display labels and arbitrary strings", () => {
    const bad = "Marketing post scheduler (weekdays 13:00 UTC)";
    expect(isKnownScheduledTaskCategory(bad)).toBe(false);
    expect(scheduledTaskCategoryDisplayName(bad)).toBeUndefined();
  });
});
