import { describe, expect, it } from "vitest";

import {
    adminScheduledTasksListScopeLabel,
    parseAdminScheduledTasksListScope
} from "@/lib/admin-scheduled-tasks-list-scope";

describe("admin-scheduled-tasks-list-scope", () => {
  it("defaults to system", () => {
    expect(parseAdminScheduledTasksListScope(undefined)).toBe("system");
    expect(parseAdminScheduledTasksListScope("bogus")).toBe("system");
  });

  it("accepts tenant_workspace", () => {
    expect(parseAdminScheduledTasksListScope("tenant_workspace")).toBe("tenant_workspace");
  });

  it("labels scopes for the Jobs tab selector", () => {
    expect(adminScheduledTasksListScopeLabel("system")).toBe("Platform jobs");
    expect(adminScheduledTasksListScopeLabel("tenant_workspace")).toBe("Platform + workspace");
  });
});
