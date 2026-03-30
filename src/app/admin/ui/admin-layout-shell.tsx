"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AdminLeftRail } from "@/app/admin/ui/admin-left-rail";

const STORAGE_KEY = "xf_admin_left_rail_collapsed";

function ChevronRightIcon() {
  return (
    <svg aria-hidden fill="none" height={18} viewBox="0 0 24 24" width={18}>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

function AdminRailCollapsedStrip({ onExpand }: { onExpand: () => void }) {
  return (
    <aside
      className="admin-rail-collapsed-strip xf-widget"
      aria-label="Admin navigation collapsed"
    >
      <button
        type="button"
        className="admin-rail-collapsed-strip__btn"
        onClick={onExpand}
        aria-label="Expand navigation"
        title="Expand navigation"
      >
        <ChevronRightIcon />
      </button>
    </aside>
  );
}

type AdminLayoutShellProps = {
  children: ReactNode;
};

export function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        queueMicrotask(() => {
          setCollapsed(true);
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const expand = useCallback(() => {
    setCollapsed(false);
    persist(false);
  }, [persist]);

  const collapse = useCallback(() => {
    setCollapsed(true);
    persist(true);
  }, [persist]);

  return (
    <div
      className={`admin-layout-shell${collapsed ? " admin-layout-shell--rail-collapsed" : ""}`}
      data-admin-rail-collapsed={collapsed ? "true" : "false"}
    >
      {collapsed ? (
        <AdminRailCollapsedStrip onExpand={expand} />
      ) : (
        <AdminLeftRail onCollapse={collapse} />
      )}
      <div className="admin-layout-main">{children}</div>
    </div>
  );
}
