"use client";

import { Children, useCallback, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "xf-app-user-rail-collapsed";

type AppUserShellCollapsibleRailProps = {
  /** First child: rail (`AppUserAccountPublicRailForSession`). Remaining: main column content. */
  children: ReactNode;
  /** Adds `app-user-shell-with-rail--padded` on the outer shell (e.g. watchlist). */
  shellPadded?: boolean;
  /** Adds `app-user-shell-with-rail--padded` on the main column only (e.g. billing). */
  mainPadded?: boolean;
};

export function AppUserShellCollapsibleRail({
  children,
  shellPadded = false,
  mainPadded = false
}: AppUserShellCollapsibleRailProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const all = Children.toArray(children);
  const railChild = all[0];
  const mainChildren = all.slice(1);

  return (
    <div
      className={`app-user-shell-with-rail${shellPadded ? " app-user-shell-with-rail--padded" : ""}${collapsed ? " app-user-shell-with-rail--rail-collapsed" : ""}`}
      data-rail-collapsed={collapsed ? "true" : "false"}
    >
      <div className="app-user-rail-aside">
        <div className="app-user-rail-aside__toolbar">
          <button
            type="button"
            className="xchat-rail-toggle app-user-rail-aside__toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand account sidebar" : "Collapse account sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
          >
            {collapsed ? <AppUserRailExpandIcon /> : <AppUserRailCollapseIcon />}
          </button>
        </div>
        {!collapsed ? <div className="app-user-rail-aside__body">{railChild}</div> : null}
      </div>
      <div className={`app-user-shell-main${mainPadded ? " app-user-shell-with-rail--padded" : ""}`}>
        {mainChildren}
      </div>
    </div>
  );
}

function AppUserRailCollapseIcon() {
  return (
    <svg aria-hidden className="xchat-rail-toggle__glyph" fill="none" viewBox="0 0 24 24">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </svg>
  );
}

function AppUserRailExpandIcon() {
  return (
    <svg aria-hidden className="xchat-rail-toggle__glyph" fill="none" viewBox="0 0 24 24">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </svg>
  );
}
