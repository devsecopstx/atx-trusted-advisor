"use client";

import { useSyncExternalStore } from "react";

import {
    resolveWorkspaceAccountId,
    WORKSPACE_ACCOUNT_CHANGED_EVENT
} from "@/lib/workspace-account-selection";

/**
 * Subscribes to workspace account changes (left-rail picker + other surfaces) and resolves
 * the effective account id from localStorage + server default.
 */
export function useWorkspaceAccountSelection(
  portfolioId: string | undefined,
  validIds: string[],
  serverDefaultId: string | null
): string | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }
      const handler = () => onChange();
      window.addEventListener(WORKSPACE_ACCOUNT_CHANGED_EVENT, handler);
      return () => window.removeEventListener(WORKSPACE_ACCOUNT_CHANGED_EVENT, handler);
    },
    () => {
      if (!portfolioId || validIds.length === 0) {
        return null;
      }
      return resolveWorkspaceAccountId(portfolioId, validIds, serverDefaultId);
    },
    () => null
  );
}
