import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
    SCHEDULED_TASK_CATEGORIES,
    SCHEDULED_TASK_CATEGORY_DEFAULT_CRON
} from "@/lib/scheduled-task-category-schema";

describe("task-runner category coverage", () => {
  it("every scheduled category has a default cron", () => {
    for (const c of SCHEDULED_TASK_CATEGORIES) {
      const cron = SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[c];
      expect(cron, `missing default cron for ${c}`).toMatch(/\S/);
    }
  });

  it("task-runner.ts branches include every category string", () => {
    const src = readFileSync(
      join(process.cwd(), "src/modules/core-admin/task-runner.ts"),
      "utf8"
    );
    for (const c of SCHEDULED_TASK_CATEGORIES) {
      const quoted = `"${c}"`;
      expect(src.includes(quoted), `task-runner must reference ${quoted}`).toBe(true);
    }
  });
});
