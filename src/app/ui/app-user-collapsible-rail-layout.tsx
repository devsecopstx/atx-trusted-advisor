"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AppUserRailCollapseIcon, AppUserRailExpandIcon } from "@/app/ui/app-user-rail-toggle-icons";

const STORAGE_KEY = "xf-app-user-rail-collapsed";

type AppUserCollapsibleRailLayoutProps = {
  rail: ReactNode;
  children: ReactNode;
  /** Applied to the main column (e.g. `app-user-shell-with-rail--padded`). */
  mainClassName?: string;
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

export function AppUserCollapsibleRailLayout({ rail, children, mainClassName }: AppUserCollapsibleRailLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCollapsed(readStoredCollapsed());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div
      className={`app-user-shell-with-rail${collapsed ? " app-user-shell-with-rail--rail-collapsed" : ""}`}
      suppressHydrationWarning={!hydrated}
    >
      <div className={`app-user-rail-stack${collapsed ? " app-user-rail-stack--collapsed" : ""}`}>
        <div className="app-user-rail-stack__head">
          {!collapsed ? (
            <span className="app-user-rail-stack__label">Workspace</span>
          ) : null}
          <button
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="app-user-rail-toggle"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
            onClick={toggle}
          >
            {collapsed ? <AppUserRailExpandIcon /> : <AppUserRailCollapseIcon />}
          </button>
        </div>
        {!collapsed ? <div className="app-user-rail-stack__body">{rail}</div> : null}
      </div>
      <div className={mainClassName ? `app-user-shell-main ${mainClassName}` : "app-user-shell-main"}>{children}</div>
    </div>
  );
}
