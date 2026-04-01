"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

import { ADMIN_FUNCTION_GROUPS } from "@/app/admin/ui/admin-hub-sections";

const ADMIN_APP_USER_SHORTCUTS: Array<{ href: string; label: string; title: string }> = [
  {
    href: "/xchat",
    label: "xChat",
    title: "Open xChat product surface"
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    title: "Open app-user portfolio workspace"
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    title: "Open app-user watchlist workspace"
  },
  {
    href: "/xoptions",
    label: "xOptions",
    title: "Open app-user options workspace"
  },
  {
    href: "/resources/getting-started",
    label: "Resources",
    title: "Open resource hub and guides"
  },
  {
    href: "/account/billing",
    label: "Plans & billing",
    title: "Open app-user billing and plans"
  }
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminRailChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`admin-left-rail__chevron${open ? "" : " admin-left-rail__chevron--collapsed"}`}
      fill="none"
      height={18}
      viewBox="0 0 24 24"
      width={18}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function AdminRailDisclosure({
  title,
  defaultOpen = false,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const triggerId = useId();

  return (
    <div className="admin-left-rail__section">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="admin-left-rail__trigger"
        id={triggerId}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="admin-left-rail__section-title">{title}</span>
        <AdminRailChevron open={open} />
      </button>
      {open ? (
        <div className="admin-left-rail__panel" id={panelId} role="region" aria-labelledby={triggerId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden fill="none" height={18} viewBox="0 0 24 24" width={18}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

type AdminLeftRailProps = {
  /** When set, shows a collapse control at the top of the rail */
  onCollapse?: () => void;
};

export function AdminLeftRail({ onCollapse }: AdminLeftRailProps) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="admin-left-rail xf-widget" aria-label="Admin navigation">
      {onCollapse ? (
        <div className="admin-left-rail__collapse-row">
          <button
            type="button"
            className="admin-left-rail__collapse-btn"
            onClick={onCollapse}
            aria-label="Collapse navigation sidebar"
            title="Collapse navigation"
          >
            <ChevronLeftIcon />
            <span className="admin-left-rail__collapse-label">Collapse</span>
          </button>
        </div>
      ) : null}
      <div className="admin-left-rail__section">
        <Link
          className={`admin-left-rail__link${isActive(pathname, "/admin") ? " admin-left-rail__link--active" : ""}`}
          href="/admin"
        >
          Admin Hub
        </Link>
      </div>

      <AdminRailDisclosure title="App user shortcuts">
        <nav className="admin-left-rail__links" aria-label="App user shortcuts">
          {ADMIN_APP_USER_SHORTCUTS.map((item) => (
            <Link
              className={`admin-left-rail__link${isActive(pathname, item.href) ? " admin-left-rail__link--active" : ""}`}
              href={item.href}
              key={`app-shortcut:${item.href}`}
              title={item.title}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </AdminRailDisclosure>

      {ADMIN_FUNCTION_GROUPS.map((group) => (
        <AdminRailDisclosure key={group.title} title={group.title}>
          <nav className="admin-left-rail__links" aria-label={`${group.title} links`}>
            {group.items.map((item) => (
              <Link
                className={`admin-left-rail__link${isActive(pathname, item.href) ? " admin-left-rail__link--active" : ""}`}
                href={item.href}
                key={`${group.title}:${item.href}:${item.title}`}
                title={item.description}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </AdminRailDisclosure>
      ))}
    </aside>
  );
}
