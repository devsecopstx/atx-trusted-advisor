"use client";

import { createContext, useContext, type ReactNode } from "react";

const WorkspaceMobileDrawerNavContext = createContext<(() => void) | null>(null);

export function WorkspaceMobileDrawerNavProvider({
  closeDrawer,
  children
}: {
  /** When null, drawer link clicks do not auto-close (desktop lg). */
  closeDrawer: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <WorkspaceMobileDrawerNavContext.Provider value={closeDrawer}>{children}</WorkspaceMobileDrawerNavContext.Provider>
  );
}

export function useWorkspaceMobileDrawerClose(): (() => void) | null {
  return useContext(WorkspaceMobileDrawerNavContext);
}
