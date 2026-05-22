"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

import { ADMIN_HUB_ITEM_ICONS, AdminHubNavIcon } from "@/app/admin/ui/admin-hub-nav-icons";
import {
    ADMIN_FUNCTION_GROUPS,
    ADMIN_PLATFORM_OPS_ITEMS,
    getAdminRailPrimaryItems
} from "@/app/admin/ui/admin-hub-sections";
import type { AdminHubSummaryResponse } from "@/lib/admin-hub-summary-contract";

const ADMIN_APP_USER_SHORTCUTS: Array<{ href: string; label: string; title: string }> = [
  {
    href: "/xchat",
    label: "xChat",
    title: "Open xChat product surface"
  },
  {
    href: "/portfolios",
    label: "Portfolios",
    title: "Open app-user portfolios workspace"
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
    href: "/resources/guides",
    label: "Resources",
    title: "Open guides and resource articles"
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
  badge,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
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
        <span className="admin-left-rail__trigger-label">
          <span className="admin-left-rail__section-title">{title}</span>
          {badge}
        </span>
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

function AdminRailLink({
  href,
  label,
  title,
  pathname
}: {
  href: string;
  label: string;
  title: string;
  pathname: string;
}) {
  const icon = ADMIN_HUB_ITEM_ICONS[href];
  return (
    <Link
      className={`admin-left-rail__link${isActive(pathname, href) ? " admin-left-rail__link--active" : ""}`}
      href={href}
      title={title}
    >
      {icon ? <AdminHubNavIcon className="admin-left-rail__link-icon" icon={icon} /> : null}
      <span className="admin-left-rail__link-text">{label}</span>
    </Link>
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
  onCollapse?: () => void;
};

export function AdminLeftRail({ onCollapse }: AdminLeftRailProps) {
  const pathname = usePathname() ?? "";
  const primaryItems = getAdminRailPrimaryItems();
  const [summary, setSummary] = useState<AdminHubSummaryResponse | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/hub/summary", { cache: "no-store" });
      if (res.ok) {
        setSummary((await res.json()) as AdminHubSummaryResponse);
      }
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSummary();
    });
  }, [loadSummary]);

  const deskBadge =
    summary && summary.pendingAccessRequests > 0 ? (
      <span className="admin-left-rail__dot" title={`${summary.pendingAccessRequests} pending access requests`} />
    ) : null;

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
          className={`admin-left-rail__link admin-left-rail__link--hub${isActive(pathname, "/admin") ? " admin-left-rail__link--active" : ""}`}
          href="/admin"
        >
          <AdminHubNavIcon className="admin-left-rail__link-icon" icon="hub" />
          <span className="admin-left-rail__link-text">Admin Hub</span>
        </Link>
        <Link
          className="admin-left-rail__link admin-left-rail__link--xchat-promo"
          href="/xchat"
          title="Open xChat as admin"
        >
          <AdminHubNavIcon className="admin-left-rail__link-icon" icon="chat" />
          <span className="admin-left-rail__link-text">xChat (admin)</span>
        </Link>
      </div>

      <div className="admin-left-rail__section admin-left-rail__section--flat">
        <p className="admin-left-rail__section-title admin-left-rail__section-title--static">Primary</p>
        <nav className="admin-left-rail__links" aria-label="Primary admin shortcuts">
          {primaryItems.map((item) => (
            <AdminRailLink
              key={item.href}
              href={item.href}
              label={item.title}
              pathname={pathname}
              title={item.description}
            />
          ))}
        </nav>
      </div>

      <AdminRailDisclosure title="App user shortcuts">
        <nav className="admin-left-rail__links" aria-label="App user shortcuts">
          {ADMIN_APP_USER_SHORTCUTS.map((item) => (
            <AdminRailLink
              key={`app-shortcut:${item.href}`}
              href={item.href}
              label={item.label}
              pathname={pathname}
              title={item.title}
            />
          ))}
        </nav>
      </AdminRailDisclosure>

      {ADMIN_FUNCTION_GROUPS.map((group) => (
        <AdminRailDisclosure
          key={group.title}
          badge={group.title === "Desk & operations" ? deskBadge : null}
          defaultOpen={group.title === "Desk & operations"}
          title={group.title}
        >
          <nav className="admin-left-rail__links" aria-label={`${group.title} links`}>
            {group.items.map((item) => (
              <AdminRailLink
                key={`${group.title}:${item.href}:${item.title}`}
                href={item.href}
                label={item.title}
                pathname={pathname}
                title={item.description}
              />
            ))}
          </nav>
        </AdminRailDisclosure>
      ))}

      <AdminRailDisclosure title="Platform ops & audit">
        <nav className="admin-left-rail__links" aria-label="Platform ops and audit">
          {ADMIN_PLATFORM_OPS_ITEMS.map((item) => (
            <AdminRailLink
              key={item.href}
              href={item.href}
              label={item.title}
              pathname={pathname}
              title={item.description}
            />
          ))}
          <AdminRailLink
            href="/admin/platform-health"
            label="Platform health"
            pathname={pathname}
            title="Ops summary, data-plane health, tenant UX drills"
          />
        </nav>
      </AdminRailDisclosure>
    </aside>
  );
}
