"use client";

import { createContext, useContext, type ReactNode } from "react";

export type WorkspaceProductRailContextValue = {
  /** Raw persisted preference (`xf-workspace-product-rail-expanded` localStorage). */
  expanded: boolean;
  /** Effective expanded UI (narrow breakpoints + desk routes may force layout). */
  showExpandedUi: boolean;
  toggle: () => void;
};

const WorkspaceProductRailContext = createContext<WorkspaceProductRailContextValue | null>(null);

export function WorkspaceProductRailProvider({
  value,
  children
}: {
  value: WorkspaceProductRailContextValue;
  children: ReactNode;
}) {
  return <WorkspaceProductRailContext.Provider value={value}>{children}</WorkspaceProductRailContext.Provider>;
}

/** Null when rendered outside the workspace product sidebar tree. */
export function useWorkspaceProductRail(): WorkspaceProductRailContextValue | null {
  return useContext(WorkspaceProductRailContext);
}
