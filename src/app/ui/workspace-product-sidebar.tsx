"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useState,
    useSyncExternalStore,
    type ReactNode,
    type SVGProps,
    type SyntheticEvent
} from "react";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserRailAccountPanel } from "@/app/ui/app-user-rail-account-panel";
import { ChatHistoryRailIcon } from "@/app/ui/chat-history-rail-icon";
import { LucideMonitorIcon, LucideSquarePenIcon, XoptionsRocketIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { useTenantUxPolicy } from "@/app/ui/use-tenant-ux-policy";
import { WorkspacePortfolioAccountPickerCard } from "@/app/ui/workspace-portfolio-account-picker-card";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatAttachmentsPanel } from "@/app/xchat/ui/xchat-attachments-panel";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import { canAccessPremiumTenantAttachments } from "@/lib/xchat-premium-attachments-policy";
import {
    isXoptionsStrategyBuilderVisible,
    setXoptionsStrategyBuilderVisible,
    subscribeXoptionsStrategyBuilderVisibility
} from "@/lib/xoptions-strategy-builder-visibility";
import {
    getPayoffPreviewSyncSnapshot,
    isShowGreeksCalcLogicEnabled,
    isShowStrategySizingEnabled,
    isTaxEducationEnabled,
    setPayoffPreviewEnabled,
    setShowGreeksCalcLogicEnabled,
    setShowStrategySizingEnabled,
    setTaxEducationEnabled,
    subscribeXoptionsEducationPrefs
} from "@/lib/xoptions/xoptions-education-preferences";

const RAIL_EXPANDED_STORAGE_KEY = "xf-workspace-product-rail-expanded";

/** Fired after localStorage preference writes so `useSyncExternalStore` subscribers re-read. */
export const WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE = "xf-workspace-product-rail-prefs-change";

function subscribeRailExpandedPrefs(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onChange = () => cb();
  window.addEventListener(WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getRailExpandedSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(RAIL_EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Expand the workspace product rail and persist (e.g. xChat `?rail=` deep links). */
export function expandWorkspaceProductRail(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(RAIL_EXPANDED_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE));
}

function pathKeyFromHref(href: string): string {
  const beforeHash = href.split("#")[0] ?? href;
  const beforeQuery = beforeHash.split("?")[0] ?? beforeHash;
  return beforeQuery;
}

function sublinkActive(pathname: string, href: string): boolean {
  const base = pathKeyFromHref(href);
  if (!base.startsWith("/")) {
    return false;
  }
  if (href.includes("#")) {
    return pathname === base;
  }
  return pathname === base || pathname.startsWith(`${base}/`);
}

function SidebarLink({
  href,
  children,
  title,
  nested = false
}: {
  href: string;
  children: ReactNode;
  title?: string;
  nested?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const active = sublinkActive(pathname, href);
  const cls = [
    "portfolios-workspace-sidebar__link",
    active ? "portfolios-workspace-sidebar__link--active" : "",
    nested ? "portfolios-workspace-sidebar__link--nested" : ""
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Link
      className={cls}
      href={href}
      title={title}
      suppressHydrationWarning={true}
    >
      {children}
    </Link>
  );
}

function ResourcesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 6.5c2.2-1 4.7-1 7 0v11c-2.3-1-4.8-1-7 0v-11zm16 0c-2.2-1-4.7-1-7 0v11c2.3-1 4.8-1 7 0v-11z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M12 6.5v11" stroke="currentColor" strokeWidth={1.75} />
    </svg>
  );
}

function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

function AdminHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 14h7v6H4v-6zm9 0h7v6h-7v-6z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function UploadGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 5v10m0 0l-3.5-3.5M12 15l3.5-3.5M5 19h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function RailSectionChevron() {
  return (
    <svg
      aria-hidden
      className="portfolios-workspace-sidebar__chevron"
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

/** Icon-only hit target uses `data-workspace-sidebar-primary`; summary must skip native toggle so Next Link navigates. */
function preventDetailsToggleForSidebarPrimaryLink(e: SyntheticEvent<HTMLElement>) {
  const el = e.target as HTMLElement | null;
  if (el?.closest("[data-workspace-sidebar-primary]")) {
    e.preventDefault();
  }
}

function RouteSyncedDetails({
  className,
  routeMatch,
  children
}: {
  className?: string;
  routeMatch: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(routeMatch);
  useEffect(() => {
    setOpen(routeMatch);
  }, [routeMatch]);
  return (
    <details
      className={className}
      open={open}
      onToggle={(e: SyntheticEvent<HTMLDetailsElement>) => {
        setOpen(e.currentTarget.open);
      }}
      suppressHydrationWarning={true}
    >
      {children}
    </details>
  );
}

function SidebarAccordionSummary({
  label,
  icon,
  primaryHref,
  primaryNavTitle
}: {
  label: string;
  icon?: ReactNode;
  /** When set, the icon navigates here; clicking the label or chevron still expands/collapses the group. */
  primaryHref?: string;
  primaryNavTitle?: string;
}) {
  const iconNode =
    icon != null ? (
      primaryHref ? (
        <Link
          className="portfolios-workspace-sidebar__summary-icon portfolios-workspace-sidebar__summary-primary-link"
          data-workspace-sidebar-primary=""
          href={primaryHref}
          title={primaryNavTitle ?? `Open ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          {icon}
        </Link>
      ) : (
        <span className="portfolios-workspace-sidebar__summary-icon">{icon}</span>
      )
    ) : null;

  return (
    <>
      <span className="portfolios-workspace-sidebar__summary-main">
        {iconNode}
        <span className="portfolios-workspace-sidebar__summary-label">{label}</span>
      </span>
      <RailSectionChevron />
    </>
  );
}

function ChevronsExpandIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M13 17l5-5-5-5M6 17l5-5-5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function ChevronsCollapseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M11 17l-5-5 5-5M18 17l-5-5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function subscribeMaxWidth980(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia("(max-width: 980px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMaxWidth980Snapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 980px)").matches;
}

export type WorkspaceProductSidebarProps = {
  defaultPortfolioId: string | null;
  isGlobalAdmin: boolean;
  accountDetails: AppUserRailAccountPanelDetails | null;
  googleLinkHref?: string | null;
  accountFeedbackPageLabel?: string;
  workspaceBook?: AppUserDefaultBook | null;
  showReferenceDocs?: boolean;
  visiblePathPrefixes?: string[];
  xchatSection?: ReactNode;
};

type CollapsedIconItem = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
};

export function WorkspaceProductSidebar({
  defaultPortfolioId,
  isGlobalAdmin,
  accountDetails,
  googleLinkHref = null,
  accountFeedbackPageLabel,
  workspaceBook = null,
  showReferenceDocs = true,
  visiblePathPrefixes,
  xchatSection
}: WorkspaceProductSidebarProps) {
  const { allowedRoutes } = useTenantUxPolicy();
  const effectiveVisiblePathPrefixes = visiblePathPrefixes ?? allowedRoutes ?? undefined;
  const isPathVisible = useCallback(
    (pathPrefix: string) =>
      pathPrefix === "/resources" ||
      !effectiveVisiblePathPrefixes ||
      effectiveVisiblePathPrefixes.some((allowed) => allowed === pathPrefix),
    [effectiveVisiblePathPrefixes]
  );
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const narrowViewport = useSyncExternalStore(subscribeMaxWidth980, getMaxWidth980Snapshot, () => false);
  const xchatHistoryDeepLinkActive =
    pathname.startsWith("/xchat") && searchParams.get("item") === "history";
  const xchatAttachmentsDeepLinkActive =
    pathname.startsWith("/xchat") && searchParams.get("item") === "attachments";

  const showAttachmentsRail =
    accountDetails != null &&
    canAccessPremiumTenantAttachments(
      accountDetails.subscriptionPlan,
      accountDetails.isGlobalAdmin ? ["global_admin"] : []
    );

  const expanded = useSyncExternalStore(
    subscribeRailExpandedPrefs,
    getRailExpandedSnapshot,
    () => false
  );

  const persistExpanded = useCallback((next: boolean) => {
    try {
      localStorage.setItem(RAIL_EXPANDED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE));
    }
  }, []);

  /** Full labels + accordions; on narrow viewports the stacked layout stays expanded (toggle hidden). */
  const showExpandedUi = narrowViewport || expanded;
  const showCollapseToggle = !narrowViewport;

  const showXoptionsToggle = pathname.startsWith("/xoptions");
  const xoptionsStrategyBuilderVisible = useSyncExternalStore(
    subscribeXoptionsStrategyBuilderVisibility,
    isXoptionsStrategyBuilderVisible,
    () => false
  );
  const taxEducationEnabled = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isTaxEducationEnabled,
    () => false
  );
  const showGreeksCalcLogic = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isShowGreeksCalcLogicEnabled,
    () => false
  );
  const showStrategySizing = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isShowStrategySizingEnabled,
    () => false
  );
  const payoffPreviewEnabled = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    getPayoffPreviewSyncSnapshot,
    () => false
  );
  const importHref =
    defaultPortfolioId !== null
      ? `/import-activity?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
      : "/import-activity";
  const watchlistHref =
    defaultPortfolioId !== null
      ? `/watchlist?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
      : "/watchlist";
  const alertsHref =
    defaultPortfolioId !== null
      ? `/portfolio/alerts?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
      : "/portfolio/alerts";

  const portfolioDeskPrimaryHref: string | undefined = isPathVisible("/portfolios")
    ? "/portfolios"
    : isPathVisible("/watchlist")
      ? watchlistHref
      : isPathVisible("/portfolio")
        ? alertsHref
        : isPathVisible("/import-activity")
          ? importHref
          : undefined;

  const portfolioRouteMatch =
    (isPathVisible("/portfolios") && pathname.startsWith("/portfolios")) ||
    (isPathVisible("/portfolio") && pathname.startsWith("/portfolio")) ||
    (isPathVisible("/watchlist") && pathname.startsWith("/watchlist")) ||
    (isPathVisible("/import-activity") && pathname.startsWith("/import-activity")) ||
    (isPathVisible("/workspace") && pathname.startsWith("/workspace/tasks"));

  const fallbackXchatSection = (
    <RouteSyncedDetails
      className="portfolios-workspace-sidebar__accordion"
      routeMatch={pathname.startsWith("/xchat")}
    >
      <summary
        className="portfolios-workspace-sidebar__accordion-summary"
        onClick={preventDetailsToggleForSidebarPrimaryLink}
      >
        <SidebarAccordionSummary
          icon={<RailSidebarZapIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--zap" size="disclosure" />}
          label="xChat"
          primaryHref="/xchat"
          primaryNavTitle="Open xChat"
        />
      </summary>
      <div className="portfolios-workspace-sidebar__accordion-body">
        <SidebarLink href="/xchat?rail=xchat&item=composer#xchat-composer" nested title="Open xChat composer">
          <LucideSquarePenIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--composer" />
          <span>Composer</span>
        </SidebarLink>
        <SidebarLink href="/xchat?rail=xchat&item=history" nested title="Chat history">
          <ChatHistoryRailIcon className="portfolios-workspace-sidebar__glyph" />
          <span>Chat history</span>
        </SidebarLink>
      </div>
    </RouteSyncedDetails>
  );

  const collapsedIcons: CollapsedIconItem[] = [
    ...(isPathVisible("/portfolios")
      ? [{
      key: "portfolio",
      href: "/portfolios",
      label: "Portfolio desk",
      isActive: portfolioRouteMatch,
      icon: <LucideMonitorIcon className="h-[1.25rem] w-[1.25rem] text-[var(--xf-text-200)]" />
    }]
      : []),
    ...(isPathVisible("/xchat")
      ? [{
      key: "xchat",
      href: "/xchat",
      label: "xChat",
      isActive: pathname.startsWith("/xchat"),
      icon: <RailSidebarZapIcon className="text-[var(--xf-lightning-yellow)]" size="disclosure" />
    }]
      : []),
    ...(pathname.startsWith("/xchat")
      ? ([
          {
            key: "xchat-history",
            href: "/xchat?rail=xchat&item=history",
            label: "Chat history",
            isActive: xchatHistoryDeepLinkActive,
            icon: (
              <ChatHistoryRailIcon className="h-[1.15rem] w-[1.15rem] shrink-0 text-[var(--xf-text-200)]" />
            )
          }
        ] satisfies CollapsedIconItem[])
      : []),
    ...(isPathVisible("/xoptions")
      ? [{
      key: "xoptions",
      href: "/xoptions",
      label: "xOptions",
      isActive: pathname.startsWith("/xoptions"),
      icon: <XoptionsRocketIcon className="h-[1.25rem] w-[1.25rem] text-[var(--xf-text-200)]" />
    }]
      : []),
    {
      key: "resources",
      href: "/resources/about",
      label: "Resources",
      isActive:
        pathname.startsWith("/resources") ||
        pathname.startsWith("/account/tasks") ||
        xchatAttachmentsDeepLinkActive,
      icon: <ResourcesIcon className="h-[1.35rem] w-[1.35rem] text-[var(--xf-text-200)]" />
    }
  ];

  if (isGlobalAdmin) {
    collapsedIcons.push({
      key: "admin",
      href: "/admin",
      label: "Admin hub",
      isActive: pathname.startsWith("/admin"),
      icon: <AdminHubIcon className="h-4 w-4 text-[var(--xf-text-200)]" />
    });
  }

  const railWidthPx = narrowViewport ? undefined : showExpandedUi ? 260 : 64;

  const expandedNav = (
    <nav className="portfolios-workspace-sidebar portfolios-workspace-sidebar--rail-fill" aria-label="Workspace">
      {isPathVisible("/portfolios") || isPathVisible("/portfolio") || isPathVisible("/watchlist") || isPathVisible("/import-activity") ? (
      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion"
        routeMatch={portfolioRouteMatch}
      >
        <summary
          className="portfolios-workspace-sidebar__accordion-summary"
          onClick={preventDetailsToggleForSidebarPrimaryLink}
        >
          <SidebarAccordionSummary
            icon={
              <LucideMonitorIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--hero portfolios-workspace-sidebar__glyph--portfolio-workspace" />
            }
            label="Portfolio desk"
            primaryHref={portfolioDeskPrimaryHref}
            primaryNavTitle="Open portfolio desk home"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
          <WorkspacePortfolioAccountPickerCard book={workspaceBook} />
          {isPathVisible("/portfolios") ? (
          <SidebarLink href="/portfolios" nested title="Books overview">
            Books Overview
          </SidebarLink>
          ) : null}
          {isPathVisible("/watchlist") ? (
          <SidebarLink href={watchlistHref} nested title="Watchlist workspace">
            Watchlist
          </SidebarLink>
          ) : null}
          {isPathVisible("/portfolio") ? (
          <SidebarLink href={alertsHref} nested title="Portfolio alerts">
            Alerts
          </SidebarLink>
          ) : null}
          {isPathVisible("/workspace") ? (
            <SidebarLink href="/workspace/tasks" nested title="Tenant automations (scheduled scanners)">
              Automations
            </SidebarLink>
          ) : null}
        </div>
      </RouteSyncedDetails>
      ) : null}

      {xchatSection ?? fallbackXchatSection}

      {isPathVisible("/xoptions") ? (
      <RouteSyncedDetails className="portfolios-workspace-sidebar__accordion" routeMatch={pathname.startsWith("/xoptions")}>
        <summary
          className="portfolios-workspace-sidebar__accordion-summary"
          onClick={preventDetailsToggleForSidebarPrimaryLink}
        >
          <SidebarAccordionSummary
            icon={<XoptionsRocketIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--hero" />}
            label="xOptions"
            primaryHref="/xoptions"
            primaryNavTitle="Open xOptions"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
          <SidebarLink href="/xoptions" nested title="Find contracts and strategies — xOptions desk">
            <span className="portfolios-workspace-sidebar__emph">Find xOptions</span>
          </SidebarLink>
          <SidebarLink href="/xoptions/wheel" nested title="xWheel Studio — wheel ideas and reports">
            xWheel Studio
          </SidebarLink>
          {showXoptionsToggle ? (
            <>
              <div className="xchat-sidebar-privacy-row">
                <span className="xchat-sidebar-privacy-row__label" title="Cash or share sizing on Choose strategy">
                  Show sizing
                </span>
                <label className="xchat-sidebar-privacy-row__control" aria-label="Show start sizing on choose strategy">
                  <input
                    checked={showStrategySizing}
                    onChange={(e) => setShowStrategySizingEnabled(e.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="xchat-sidebar-privacy-row">
                <span
                  className="xchat-sidebar-privacy-row__label"
                  title="P/L chart below the chain; off hides chart and shows position review under the chain"
                >
                  Payoff preview
                </span>
                <label className="xchat-sidebar-privacy-row__control" aria-label="Show payoff preview chart">
                  <input
                    checked={payoffPreviewEnabled}
                    onChange={(e) => setPayoffPreviewEnabled(e.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="xchat-sidebar-privacy-row">
                <span className="xchat-sidebar-privacy-row__label" title="Educational tax blurbs in the builder">
                  Tax education
                </span>
                <label className="xchat-sidebar-privacy-row__control" aria-label="Show tax education panels">
                  <input
                    checked={taxEducationEnabled}
                    onChange={(e) => setTaxEducationEnabled(e.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="xchat-sidebar-privacy-row">
                <span
                  className="xchat-sidebar-privacy-row__label"
                  title="Black–Scholes formulas next to the option chain"
                >
                  Show Greeks calc logic
                </span>
                <label className="xchat-sidebar-privacy-row__control" aria-label="Show Greeks calculation logic">
                  <input
                    checked={showGreeksCalcLogic}
                    onChange={(e) => setShowGreeksCalcLogicEnabled(e.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="xchat-sidebar-privacy-row">
                <span className="xchat-sidebar-privacy-row__label">xStrategybuilder</span>
                <label className="xchat-sidebar-privacy-row__control" aria-label="Show hardcore strategy jobs">
                  <input
                    checked={xoptionsStrategyBuilderVisible}
                    onChange={(e) => setXoptionsStrategyBuilderVisible(e.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
            </>
          ) : null}
        </div>
      </RouteSyncedDetails>
      ) : null}

      {isGlobalAdmin ? (
        <SidebarLink href="/admin" title="Admin Hub">
          <AdminHubIcon className="portfolios-workspace-sidebar__glyph" />
          <span>Admin hub</span>
        </SidebarLink>
      ) : null}

      <div className="portfolios-workspace-sidebar__spacer" aria-hidden />

      <div className="portfolios-workspace-sidebar__bottom">
      {isPathVisible("/resources") || showAttachmentsRail ? (
      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion"
        routeMatch={
          pathname.startsWith("/resources") ||
          pathname.startsWith("/account/tasks") ||
          xchatAttachmentsDeepLinkActive
        }
      >
        <summary
          className="portfolios-workspace-sidebar__accordion-summary"
          onClick={preventDetailsToggleForSidebarPrimaryLink}
        >
          <SidebarAccordionSummary
            icon={<ResourcesIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--resources" />}
            label="Resources"
            primaryHref={isPathVisible("/resources") ? "/resources/about" : undefined}
            primaryNavTitle="Open Resources"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
          {showAttachmentsRail ? (
            <div className="portfolios-workspace-sidebar__collections-block">
              <p className="portfolios-workspace-sidebar__collections-label">User Collections</p>
              <XchatAttachmentsPanel />
            </div>
          ) : null}
          {isPathVisible("/resources") && showAttachmentsRail ? (
            <div aria-hidden className="portfolios-workspace-sidebar__collections-rule" />
          ) : null}
          {isPathVisible("/resources") ? (
            <>
          <SidebarLink href="/resources/about" nested>
            About
          </SidebarLink>
          <SidebarLink href="/resources/decision-workflow" nested>
            Decision workflow
          </SidebarLink>
          <SidebarLink href="/resources/secret-sauce" nested>
            Secret sauce
          </SidebarLink>
          <SidebarLink href="/resources/getting-started" nested title="Guide to investing with options">
            Getting started
          </SidebarLink>
          <SidebarLink
            href="/resources/top-10-hnwi-xchat-prompts"
            nested
            title="Top 10 HNWI xChat prompts — conservative, balanced, and aggressive playbooks"
          >
            Top 10 HNWI prompts
          </SidebarLink>
          <SidebarLink href="/resources/building-wheel" nested title="Building a wheel strategy">
            Building a wheel
          </SidebarLink>
          <SidebarLink href="/resources/building-wheel/wheel-vs-iron-condor" nested title="Wheel vs iron condor">
            Wheel vs Iron Condor
          </SidebarLink>
          {showReferenceDocs ? (
            isGlobalAdmin ? (
              <SidebarLink href="/admin/api-docs" nested>
                Reference docs
              </SidebarLink>
            ) : (
              <XfHoverHint hint="Open API reference from Hub when you have admin access">
                <span
                  className="portfolios-workspace-sidebar__link portfolios-workspace-sidebar__link--nested portfolios-workspace-sidebar__link--muted"
                  role="note"
                  tabIndex={0}
                >
                  Reference docs
                </span>
              </XfHoverHint>
            )
          ) : null}
          <SidebarLink href={importHref} nested title="Merrill / Fidelity broker import">
            <UploadGlyph className="portfolios-workspace-sidebar__glyph" />
            Broker import
          </SidebarLink>
          <SidebarLink href="/account/tasks" nested title="Scheduled and saved user tasks">
            Tasks
          </SidebarLink>
            </>
          ) : null}
        </div>
      </RouteSyncedDetails>
      ) : null}

      {accountDetails ? (
        <RouteSyncedDetails
          className="portfolios-workspace-sidebar__accordion"
          routeMatch={
            (pathname.startsWith("/account") && !pathname.startsWith("/account/tasks")) ||
            pathname.startsWith("/legal")
          }
        >
          <summary className="portfolios-workspace-sidebar__accordion-summary">
            <SidebarAccordionSummary icon={<PersonIcon className="portfolios-workspace-sidebar__glyph" />} label="Account" />
          </summary>
          <div className="portfolios-workspace-sidebar__accordion-body portfolios-workspace-sidebar__accordion-body--account">
            <AppUserRailAccountPanel
              details={accountDetails}
              feedbackPageLabel={accountFeedbackPageLabel}
              googleLinkHref={googleLinkHref}
            />
          </div>
        </RouteSyncedDetails>
      ) : null}
      </div>
    </nav>
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] shadow-sm backdrop-blur-sm transition-[width] duration-200 ease-out dark:shadow-md"
      style={{
        width: railWidthPx === undefined ? "100%" : `${railWidthPx}px`,
        boxSizing: "border-box"
      }}
      suppressHydrationWarning={true}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain py-1">
        {showExpandedUi ? (
          expandedNav
        ) : (
          <nav aria-label="Workspace" className="flex flex-col items-center gap-0.5 px-1 pt-1">
            {collapsedIcons.map((item) => (
              <XfHoverHint hint={item.label} key={item.key}>
                <Link
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent transition-[background-color,color] duration-150 hover:bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_10%,transparent)] hover:text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] ${
                    item.isActive
                      ? "bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_14%,transparent)] text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]"
                      : "text-[var(--xf-text-200)]"
                  }`}
                  href={item.href}
                  title={item.label}
                >
                  {item.icon}
                </Link>
              </XfHoverHint>
            ))}
          </nav>
        )}
      </div>

      <footer
        className={`flex shrink-0 border-t border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] bg-[color-mix(in_srgb,var(--xf-xchat-rail-bg)_92%,transparent)] ${
          showExpandedUi
            ? showCollapseToggle
              ? "flex-row items-center justify-between gap-2 px-2.5 py-2"
              : "flex-row items-center justify-end gap-2 px-2.5 py-2"
            : "flex-col items-center gap-2 py-2.5"
        }`}
      >
        {showCollapseToggle ? (
          <XfHoverHint hint={showExpandedUi ? "Collapse sidebar" : "Expand sidebar"}>
            <button
              aria-expanded={showExpandedUi}
              aria-label={showExpandedUi ? "Collapse sidebar" : "Expand sidebar"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-toggle-bg)] text-[var(--xf-xchat-rail-toggle-color)] transition-[border-color,background-color,color] duration-150 hover:border-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_35%,transparent)] hover:text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]"
              type="button"
              onClick={() => persistExpanded(!expanded)}
            >
              {showExpandedUi ? (
                <ChevronsCollapseIcon className="h-5 w-5" />
              ) : (
                <ChevronsExpandIcon className="h-5 w-5" />
              )}
            </button>
          </XfHoverHint>
        ) : null}

        <XfHoverHint hint="Account">
          <Link
            aria-label="Account"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_6%,transparent)] transition-[border-color] duration-150 hover:border-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_40%,transparent)]"
            href="/account"
            title="Account"
          >
            {accountDetails?.avatarUrl?.trim() ? (
              <Image alt="" aria-hidden className="h-full w-full object-cover" height={40} src={accountDetails.avatarUrl} unoptimized width={40} />
            ) : (
              <PersonIcon className="h-5 w-5 text-[var(--xf-text-300)]" />
            )}
          </Link>
        </XfHoverHint>
      </footer>
    </div>
  );
}
