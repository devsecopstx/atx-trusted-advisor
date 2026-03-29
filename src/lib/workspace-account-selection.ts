/**
 * Persists which custodian account is active in the app_user workspace (left rail + builders).
 * Scoped per portfolio so switching books does not leak ids.
 */

export const WORKSPACE_ACCOUNT_CHANGED_EVENT = "xf-workspace-account-changed";

export type WorkspaceAccountChangedDetail = {
  portfolioId: string;
  accountId: string;
};

function storageKey(portfolioId: string): string {
  return `xf_workspace_account_${portfolioId}`;
}

export function readStoredWorkspaceAccountId(portfolioId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(portfolioId));
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredWorkspaceAccountId(portfolioId: string, accountId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(portfolioId), accountId);
  } catch {
    /* ignore quota */
  }
}

export function resolveWorkspaceAccountId(
  portfolioId: string,
  validIds: string[],
  serverDefaultId: string | null
): string | null {
  if (validIds.length === 0) {
    return null;
  }
  const stored = readStoredWorkspaceAccountId(portfolioId);
  if (stored && validIds.includes(stored)) {
    return stored;
  }
  if (serverDefaultId && validIds.includes(serverDefaultId)) {
    return serverDefaultId;
  }
  return validIds[0] ?? null;
}

export function dispatchWorkspaceAccountChanged(detail: WorkspaceAccountChangedDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(WORKSPACE_ACCOUNT_CHANGED_EVENT, { detail }));
}
