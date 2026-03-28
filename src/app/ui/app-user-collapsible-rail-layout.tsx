"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AppUserRailCollapseIcon, AppUserRailExpandIcon } from "@/app/ui/app-user-rail-toggle-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

const STORAGE_KEY = "xf-app-user-rail-collapsed";

type AppUserCollapsibleRailLayoutProps = {
  rail: ReactNode;
  children: ReactNode;
  /** Applied to the main column (e.g. `app-user-shell-with-rail--padded`). */
  mainClassName?: string;
  /** Set false to keep the rail always expanded. */
  allowCollapse?: boolean;
};

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppUserCollapsibleRailLayout({
  rail,
  children,
  mainClassName,
  allowCollapse = true
}: AppUserCollapsibleRailLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const isCollapsed = allowCollapse && collapsed;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (allowCollapse) {
        setCollapsed(readStoredCollapsed());
      } else {
        setCollapsed(false);
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, [allowCollapse]);

  const toggle = useCallback(() => {
    if (!allowCollapse) {
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [allowCollapse]);

  return (
    <div
      className={`app-user-shell-with-rail${isCollapsed ? " app-user-shell-with-rail--rail-collapsed" : ""}`}
      suppressHydrationWarning={!hydrated}
    >
      <div className={`app-user-rail-stack${isCollapsed ? " app-user-rail-stack--collapsed" : ""}`}>
        <div className="app-user-rail-stack__head">
          {!isCollapsed ? (
            <span className="app-user-rail-stack__label">Workspace</span>
          ) : null}
          {allowCollapse ? (
            <XfHoverHint hint={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <button
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="app-user-rail-toggle"
                type="button"
                onClick={toggle}
              >
                {isCollapsed ? <AppUserRailExpandIcon /> : <AppUserRailCollapseIcon />}
              </button>
            </XfHoverHint>
          ) : null}
        </div>
        {!isCollapsed ? <div className="app-user-rail-stack__body">{rail}</div> : null}
      </div>
      <div className={mainClassName ? `app-user-shell-main ${mainClassName}` : "app-user-shell-main"}>{children}</div>
    </div>
  );
}
