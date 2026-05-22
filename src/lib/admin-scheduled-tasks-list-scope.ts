/** How `/api/admin/tasks` lists rows — hub uses `system` only. */
export type AdminScheduledTasksListScope = "system" | "tenant_workspace";

export const ADMIN_SCHEDULED_TASKS_LIST_SCOPES: readonly AdminScheduledTasksListScope[] = [
  "system",
  "tenant_workspace"
] as const;

export function parseAdminScheduledTasksListScope(
  value: string | null | undefined
): AdminScheduledTasksListScope {
  return value === "tenant_workspace" ? "tenant_workspace" : "system";
}

export function adminScheduledTasksListScopeLabel(scope: AdminScheduledTasksListScope): string {
  return scope === "system" ? "Platform jobs" : "Platform + workspace";
}
