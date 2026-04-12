"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AppUserRailCollapseIcon } from "@/app/ui/app-user-rail-toggle-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

const STORAGE_KEY = "xf-app-user-rail-collapsed";

export type AppUserRailChromeMode = "default" | "workspace-product";

type AppUserCollapsibleRailLayoutProps = {
  rail: ReactNode;
  children: ReactNode;
  /** Applied to the main column (e.g. `app-user-shell-with-rail--padded`). */
  mainClassName?: string;
  /** Set false to keep the rail always expanded. */
  allowCollapse?: boolean;
  /**
   * When true, the workspace rail starts collapsed after hydration (e.g. Watchlist).
   * User expand/collapse still persists via localStorage; revisiting a page with this flag
   * collapses again so the main content has focus on entry.
   */
  preferCollapsed?: boolean;
  /**
   * `workspace-product` — workspace product sidebar owns width, icon strip, and footer toggle;
   * the outer shell does not hide the rail body.
   */
  railChrome?: AppUserRailChromeMode;
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

function AppUserWorkspaceProductRailLayout({
  rail,
  children,
  mainClassName
}: Pick<AppUserCollapsibleRailLayoutProps, "rail" | "children" | "mainClassName">) {
  return (
    <div className="app-user-shell-with-rail app-user-shell-with-rail--workspace-product">
      <div className="app-user-rail-stack app-user-rail-stack--workspace-product">
        <div className="app-user-rail-stack__body app-user-rail-stack__body--workspace-product">{rail}</div>
      </div>
      <div className={mainClassName ? `app-user-shell-main ${mainClassName}` : "app-user-shell-main"}>{children}</div>
    </div>
  );
}

function AppUserLegacyCollapsibleRailLayout({
  rail,
  children,
  mainClassName,
  allowCollapse = true,
  preferCollapsed = false
}: Omit<AppUserCollapsibleRailLayoutProps, "railChrome">) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (allowCollapse) {
        const stored = readStoredCollapsed();
        setCollapsed(preferCollapsed ? true : stored);
      } else {
        setCollapsed(false);
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, [allowCollapse, preferCollapsed]);

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

  const isCollapsed = allowCollapse && collapsed;

  return (
    <div
      className={`app-user-shell-with-rail${isCollapsed ? " app-user-shell-with-rail--rail-collapsed" : ""}`}
      suppressHydrationWarning={!hydrated}
    >
      <div className={`app-user-rail-stack${isCollapsed ? " app-user-rail-stack--collapsed" : ""}`}>
        <div className="app-user-rail-stack__head">
          {!isCollapsed ? (
            <span className="app-user-rail-stack__brand-zap" aria-hidden>
              <Image
                alt=""
                aria-hidden
                className="app-user-rail-stack__brand-mark"
                height={24}
                src="/branding/aTx.png"
                width={24}
              />
            </span>
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
                {isCollapsed ? (
                  <Image
                    alt=""
                    aria-hidden
                    className="app-user-rail-stack__brand-mark"
                    height={24}
                    src="/branding/aTx.png"
                    width={24}
                  />
                ) : (
                  <AppUserRailCollapseIcon />
                )}
              </button>
            </XfHoverHint>
          ) : null}
        </div>
        <div className={`app-user-rail-stack__body${isCollapsed ? " app-user-rail-stack__body--collapsed" : ""}`} aria-hidden={false}>
          {rail}
        </div>
      </div>
      <div className={mainClassName ? `app-user-shell-main ${mainClassName}` : "app-user-shell-main"}>{children}</div>
    </div>
  );
}

export function AppUserCollapsibleRailLayout({
  rail,
  children,
  mainClassName,
  allowCollapse = true,
  preferCollapsed = false,
  railChrome = "default"
}: AppUserCollapsibleRailLayoutProps) {
  if (railChrome === "workspace-product") {
    return <AppUserWorkspaceProductRailLayout mainClassName={mainClassName} rail={rail}>{children}</AppUserWorkspaceProductRailLayout>;
  }

  return (
    <AppUserLegacyCollapsibleRailLayout
      allowCollapse={allowCollapse}
      mainClassName={mainClassName}
      preferCollapsed={preferCollapsed}
      rail={rail}
    >
      {children}
    </AppUserLegacyCollapsibleRailLayout>
  );
}
