"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
    type ReactNode,
    type SVGProps,
    type SyntheticEvent
} from "react";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserRailAccountPanel } from "@/app/ui/app-user-rail-account-panel";
import { AtxFinanceMark, LightningBolt } from "@/app/ui/atxfinance-logo";
import { ChatHistoryRailIcon } from "@/app/ui/chat-history-rail-icon";
import {
    LucideBookOpenIcon,
    LucideChevronLeftIcon,
    LucideChevronRightIcon,
    LucideClipboardListIcon,
    LucideListBulletsIcon,
    LucideMonitorIcon,
    LucideSettingsIcon,
    LucideSquarePenIcon,
    LucideUploadIcon,
    XoptionsRocketIcon
} from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { useTenantUxPolicy } from "@/app/ui/use-tenant-ux-policy";
import { WorkspacePortfolioAccountPickerCard } from "@/app/ui/workspace-portfolio-account-picker-card";
import { WorkspaceProductRailProvider } from "@/app/ui/workspace-product-rail-context";
import { WorkspaceRailAppearance } from "@/app/ui/workspace-rail-appearance";
import { WorkspaceRailLogout } from "@/app/ui/workspace-rail-logout";
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
      aria-current={active ? "page" : undefined}
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

function UtilitiesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.77 3.77z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.65}
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

/** Resources → Utilities nested subgroup; collapsed by default, opens when a utility route is active. */
function UtilitiesSubgroupDetails({
  routeMatch,
  children
}: {
  routeMatch: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(routeMatch);
  useEffect(() => {
    setOpen(routeMatch);
  }, [routeMatch]);
  return (
    <details
      className="portfolios-workspace-sidebar__utilities-details"
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
  const pathname = usePathname() ?? "";
  const primaryActive =
    primaryHref != null && primaryHref.length > 0 && sublinkActive(pathname, primaryHref);
  const iconNode =
    icon != null ? (
      primaryHref ? (
        <Link
          aria-current={primaryActive ? "page" : undefined}
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

/** Phones: icon rail stays ≤ ~15–18% vw; expanded nav uses a fixed drawer so chat keeps full width. */
function subscribeMaxWidth767(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMaxWidth767Snapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
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
  const narrowMobile767 = useSyncExternalStore(subscribeMaxWidth767, getMaxWidth767Snapshot, () => false);
  const isXchatRoute = pathname.startsWith("/xchat");
  const isXoptionsRoute = pathname.startsWith("/xoptions");
  const isWatchlistRoute = pathname.startsWith("/watchlist");
  const isPortfolioAlertsRoute = pathname.startsWith("/portfolio/alerts");
  const isPortfoliosDeskRoute = pathname.startsWith("/portfolios");
  /** Same scope as the Account accordion’s `routeMatch` (excludes `/account/tasks` — that lives under Resources). */
  const isAccountOrLegalAppRoute =
    (pathname.startsWith("/account") && !pathname.startsWith("/account/tasks")) ||
    pathname.startsWith("/legal");
  /**
   * Narrow viewports: xChat, xOptions, desks, and account/legal use persisted expand/collapse so the
   * main column stays usable on phones. Landing on those routes (incl. xOptions from xChat) collapses the rail (see effect).
   */
  const narrowPersistedWorkspaceRail =
    narrowViewport &&
    (isXchatRoute ||
      isXoptionsRoute ||
      isPortfoliosDeskRoute ||
      isWatchlistRoute ||
      isPortfolioAlertsRoute ||
      isAccountOrLegalAppRoute);
  const xchatHistoryDeepLinkActive = isXchatRoute && searchParams.get("item") === "history";
  const xchatExamplePromptsDeepLinkActive =
    isXchatRoute && searchParams.get("item") === "example-prompts";
  const xchatAttachmentsDeepLinkActive = isXchatRoute && searchParams.get("item") === "attachments";

  /** User Collections utilities subgroup — only attachments deep link toggles it open. */
  const utilitiesAttachmentsRouteMatch = xchatAttachmentsDeepLinkActive;

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

  useEffect(() => {
    if (
      !isPortfoliosDeskRoute &&
      !isWatchlistRoute &&
      !isPortfolioAlertsRoute &&
      !isAccountOrLegalAppRoute &&
      !isXoptionsRoute
    ) {
      return;
    }
    persistExpanded(false);
  }, [
    isAccountOrLegalAppRoute,
    isPortfolioAlertsRoute,
    isPortfoliosDeskRoute,
    isWatchlistRoute,
    isXoptionsRoute,
    pathname,
    persistExpanded
  ]);

  /** Full labels + accordions; narrow routes without persisted rail stay expanded full-width without toggle. */
  const showExpandedUi = narrowPersistedWorkspaceRail ? expanded : narrowViewport || expanded;
  const showCollapseToggle = narrowPersistedWorkspaceRail ? true : !narrowViewport;

  const toggleRail = useCallback(() => persistExpanded(!expanded), [expanded, persistExpanded]);

  const railContextValue = useMemo(
    () => ({ expanded, showExpandedUi, toggle: toggleRail }),
    [expanded, showExpandedUi, toggleRail]
  );

  useEffect(() => {
    if (!showCollapseToggle || typeof window === "undefined") {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b") {
        return;
      }
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      persistExpanded(!expanded);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCollapseToggle, expanded, persistExpanded]);

  const workspaceBrandHref =
    isPathVisible("/portfolios") ? "/portfolios" : isPathVisible("/xchat") ? "/xchat" : "/xchat";

  const resourcesAccordionRouteMatch =
    pathname.startsWith("/resources") ||
    pathname.startsWith("/account/tasks") ||
    pathname.startsWith("/import-activity") ||
    pathname.startsWith("/account/billing") ||
    (pathname.startsWith("/account") && !pathname.startsWith("/account/tasks")) ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/admin/manage_account") ||
    xchatAttachmentsDeepLinkActive;

  const showXoptionsToggle = isXoptionsRoute;
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

  /** Books hub: keep "Portfolio desk" accordion closed on first paint; other desk routes still expand it. */
  const portfolioDeskAccordionSyncedOpen = portfolioRouteMatch && pathname !== "/portfolios";

  const fallbackXchatSection = (
    <RouteSyncedDetails
      className="portfolios-workspace-sidebar__accordion portfolios-workspace-sidebar__accordion--core-action"
      routeMatch={isXchatRoute}
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
        <SidebarLink href="/xchat?rail=xchat&item=example-prompts" nested title="Example prompts">
          <LucideListBulletsIcon className="portfolios-workspace-sidebar__glyph h-[1.1rem] w-[1.1rem]" />
          <span>Example prompts</span>
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
      isActive: isXchatRoute,
      icon: <RailSidebarZapIcon className="text-[var(--xf-lightning-yellow)]" size="disclosure" />
    }]
      : []),
    ...(isXchatRoute
      ? ([
          {
            key: "xchat-history",
            href: "/xchat?rail=xchat&item=history",
            label: "Chat history",
            isActive: xchatHistoryDeepLinkActive,
            icon: (
              <ChatHistoryRailIcon className="h-[1.15rem] w-[1.15rem] shrink-0 text-[var(--xf-text-200)]" />
            )
          },
          {
            key: "xchat-example-prompts",
            href: "/xchat?rail=xchat&item=example-prompts",
            label: "Example prompts",
            isActive: xchatExamplePromptsDeepLinkActive,
            icon: (
              <LucideListBulletsIcon className="h-[1.15rem] w-[1.15rem] shrink-0 text-[var(--xf-text-200)]" />
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
      href: "/resources/guides",
      label: "Resources",
      isActive: resourcesAccordionRouteMatch,
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

  const railWidthPx =
    narrowViewport && !narrowPersistedWorkspaceRail ? undefined : showExpandedUi ? 260 : 64;

  const mobilePersistedRailExpandedDrawer =
    narrowPersistedWorkspaceRail && expanded && narrowMobile767;

  /*
   * BEFORE: Collapse lived in the footer beside the avatar; nav had no explicit “main vs resources” grouping.
   * AFTER: Institutional header (aTx⚡Finance + obvious chevron toggle), grouped main desk nav, Resources divider,
   *        account chrome moved to the footer stack (appearance → profile disclosure → logout → legal micro-links).
   */
  const sidebarHeader = (
    <header className="workspace-product-sidebar__header">
      <div
        className={`workspace-product-sidebar__header-inner${showExpandedUi ? "" : " workspace-product-sidebar__header-inner--collapsed"}`}
      >
        <Link
          aria-label={showExpandedUi ? "Workspace home" : "aTx Finance — workspace home"}
          className="workspace-product-sidebar__brand"
          href={workspaceBrandHref}
          title="Workspace home"
        >
          <AtxFinanceMark className="shrink-0" size={showExpandedUi ? 22 : 20} />
          {showExpandedUi ? (
            <>
              <LightningBolt size={16} />
              <span className="workspace-product-sidebar__brand-finance">Finance</span>
            </>
          ) : null}
        </Link>
        {showCollapseToggle ? (
          <XfHoverHint hint={showExpandedUi ? "Collapse sidebar (⌘B / Ctrl+B)" : "Expand sidebar (⌘B / Ctrl+B)"}>
            <button
              aria-controls="workspace-product-sidebar-scroll"
              aria-expanded={showExpandedUi}
              aria-label="Toggle sidebar"
              className="workspace-product-sidebar__collapse-toggle xf-focus-ring--sidebar"
              type="button"
              onClick={() => persistExpanded(!expanded)}
            >
              {showExpandedUi ? (
                <LucideChevronLeftIcon className="workspace-product-sidebar__collapse-toggle-icon" />
              ) : (
                <LucideChevronRightIcon className="workspace-product-sidebar__collapse-toggle-icon" />
              )}
            </button>
          </XfHoverHint>
        ) : null}
      </div>
    </header>
  );

  const expandedNav = (
    <nav className="portfolios-workspace-sidebar portfolios-workspace-sidebar--rail-fill" aria-label="Workspace">
      <div className="workspace-product-sidebar__nav-main">
      {isPathVisible("/portfolios") || isPathVisible("/portfolio") || isPathVisible("/watchlist") || isPathVisible("/import-activity") ? (
      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion portfolios-workspace-sidebar__accordion--core-action"
        routeMatch={portfolioDeskAccordionSyncedOpen}
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
      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion portfolios-workspace-sidebar__accordion--core-action"
        routeMatch={pathname.startsWith("/xoptions")}
      >
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
      </div>

      <div className="portfolios-workspace-sidebar__spacer" aria-hidden />

      <div className="portfolios-workspace-sidebar__bottom workspace-product-sidebar__nav-secondary">
      <div className="workspace-product-sidebar__section-rule" aria-hidden />
      {isPathVisible("/resources") || showAttachmentsRail ? (
      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion portfolios-workspace-sidebar__accordion--secondary-nav"
        routeMatch={resourcesAccordionRouteMatch}
      >
        <summary
          className="portfolios-workspace-sidebar__accordion-summary"
          onClick={preventDetailsToggleForSidebarPrimaryLink}
        >
          <SidebarAccordionSummary
            icon={<ResourcesIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--resources" />}
            label="Resources"
            primaryHref={isPathVisible("/resources") ? "/resources/guides" : undefined}
            primaryNavTitle="Open Resources"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
          {showAttachmentsRail ? (
            <UtilitiesSubgroupDetails routeMatch={utilitiesAttachmentsRouteMatch}>
              <summary className="portfolios-workspace-sidebar__utilities-summary">
                <span className="portfolios-workspace-sidebar__utilities-summary-main">
                  <UtilitiesIcon className="portfolios-workspace-sidebar__glyph" />
                  <span className="portfolios-workspace-sidebar__utilities-summary-label">Utilities</span>
                </span>
                <RailSectionChevron />
              </summary>
              <div className="portfolios-workspace-sidebar__utilities-body">
                <div className="portfolios-workspace-sidebar__collections-block">
                  <p className="portfolios-workspace-sidebar__collections-label">User Collections</p>
                  <XchatAttachmentsPanel />
                </div>
              </div>
            </UtilitiesSubgroupDetails>
          ) : null}
          {isPathVisible("/resources") ? (
            <>
              <SidebarLink href={importHref} nested title="Merrill / Fidelity broker import">
                <LucideUploadIcon className="portfolios-workspace-sidebar__glyph h-[1.05rem] w-[1.05rem]" />
                Broker import
              </SidebarLink>
              <SidebarLink href="/account/tasks" nested title="Scheduled and saved user tasks">
                <LucideClipboardListIcon className="portfolios-workspace-sidebar__glyph h-[1.05rem] w-[1.05rem]" />
                Tasks
              </SidebarLink>
            </>
          ) : null}
          {isPathVisible("/resources") ? (
            <div aria-hidden className="portfolios-workspace-sidebar__collections-rule" />
          ) : null}
          {isPathVisible("/resources") ? (
            <>
              {isGlobalAdmin ? (
                <SidebarLink href="/admin/manage_account" nested title="Workspace and profile settings">
                  <LucideSettingsIcon className="portfolios-workspace-sidebar__glyph h-[1.05rem] w-[1.05rem]" />
                  Settings
                </SidebarLink>
              ) : (
                <XfHoverHint hint="Workspace settings are available from the Admin Hub for tenant admins.">
                  <span
                    className="portfolios-workspace-sidebar__link portfolios-workspace-sidebar__link--nested portfolios-workspace-sidebar__link--muted"
                    role="note"
                    tabIndex={0}
                  >
                    <LucideSettingsIcon className="portfolios-workspace-sidebar__glyph h-[1.05rem] w-[1.05rem]" />
                    Settings
                  </span>
                </XfHoverHint>
              )}
              <SidebarLink href="/account/billing" nested title="Plans and billing">
                Plans &amp; billing
              </SidebarLink>
              <SidebarLink href="/legal/terms" nested title="Legal terms and policies">
                Legal
              </SidebarLink>
            </>
          ) : null}
          {isPathVisible("/resources") ? (
            <div aria-hidden className="portfolios-workspace-sidebar__collections-rule" />
          ) : null}
          {isPathVisible("/resources") ? (
            <>
          <SidebarLink href="/resources/guides" nested title="Browse guides and resource articles">
            <LucideBookOpenIcon className="portfolios-workspace-sidebar__glyph h-[1.05rem] w-[1.05rem]" />
            Guides
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
            </>
          ) : null}
        </div>
      </RouteSyncedDetails>
      ) : null}
      </div>
    </nav>
  );

  const displayName =
    accountDetails?.displayName?.trim() ||
    accountDetails?.username?.trim() ||
    "Account";

  const railFooter = (
    <footer className="workspace-product-sidebar__footer flex shrink-0 flex-col border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-xchat-rail-bg)_94%,transparent)] transition-all duration-200 ease-out">
      <div className="workspace-product-sidebar__footer-account-rule" aria-hidden />
      <WorkspaceRailAppearance railExpanded={showExpandedUi} />
      {accountDetails ? (
        <details className="workspace-rail-account-disclosure">
          <summary
            className={`workspace-rail-account-disclosure__summary xf-focus-ring--sidebar${showExpandedUi ? "" : " workspace-rail-account-disclosure__summary--icon-only"}`}
          >
            <span className="workspace-rail-account-disclosure__avatar-wrap">
              {accountDetails.avatarUrl?.trim() ? (
                <Image
                  alt=""
                  aria-hidden
                  className="workspace-rail-account-disclosure__avatar"
                  height={36}
                  src={accountDetails.avatarUrl}
                  unoptimized
                  width={36}
                />
              ) : (
                <PersonIcon className="workspace-rail-account-disclosure__avatar-fallback" />
              )}
            </span>
            {showExpandedUi ? (
              <span className="workspace-rail-account-disclosure__identity">
                <span className="workspace-rail-account-disclosure__name">{displayName}</span>
                <span className="workspace-rail-account-disclosure__hint">Profile &amp; feedback</span>
              </span>
            ) : (
              <span className="sr-only">Open account menu</span>
            )}
            {showExpandedUi ? <RailSectionChevron /> : null}
          </summary>
          <div className="workspace-rail-account-disclosure__panel portfolios-workspace-sidebar__accordion-body--account">
            <AppUserRailAccountPanel
              details={accountDetails}
              feedbackPageLabel={accountFeedbackPageLabel}
              googleLinkHref={googleLinkHref}
              hideShortcutLinks
            />
          </div>
        </details>
      ) : null}
      {accountDetails ? <WorkspaceRailLogout railExpanded={showExpandedUi} /> : null}
      <nav aria-label="Legal references" className="workspace-product-sidebar__legal-micro">
        <Link href="/legal/imprint">Imprint</Link>
        <span aria-hidden className="workspace-product-sidebar__legal-sep">
          ·
        </span>
        <Link href="/legal/terms">Terms</Link>
        <span aria-hidden className="workspace-product-sidebar__legal-sep">
          ·
        </span>
        <Link href="/legal/privacy">Privacy</Link>
      </nav>
    </footer>
  );

  const sidebarShellClassName = `flex h-auto max-[767px]:self-start md:h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] shadow-sm backdrop-blur-sm transition-all duration-200 ease-out dark:shadow-md${narrowPersistedWorkspaceRail && narrowMobile767 ? " workspace-product-sidebar--xchat-mobile-compact" : ""}`;

  const sidebarShellStyle = {
    width:
      railWidthPx === undefined
        ? "100%"
        : narrowPersistedWorkspaceRail && narrowMobile767 && !expanded
          ? "clamp(2.65rem, 12vw, 3.75rem)"
          : `${railWidthPx}px`,
    boxSizing: "border-box" as const
  };

  if (mobilePersistedRailExpandedDrawer) {
    return (
      <WorkspaceProductRailProvider value={railContextValue}>
        <>
          <button
            aria-label="Close workspace sidebar"
            className="workspace-product-sidebar__mobile-drawer-backdrop fixed inset-0 z-[44] border-0 bg-[color-mix(in_srgb,var(--xf-bg-900)_58%,transparent)] p-0 backdrop-blur-[2px]"
            type="button"
            onClick={() => persistExpanded(false)}
          />
          <div
            aria-label="Workspace navigation"
            aria-modal="true"
            className="workspace-product-sidebar__mobile-drawer-panel fixed bottom-0 left-0 top-0 z-[45] flex min-h-0 w-[min(17.5rem,calc(100vw-1rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] flex-col border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] shadow-xl backdrop-blur-md max-[767px]:rounded-r-xl"
            role="dialog"
          >
            {sidebarHeader}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-0 py-1"
              id="workspace-product-sidebar-scroll"
            >
              {expandedNav}
            </div>
            {railFooter}
          </div>
        </>
      </WorkspaceProductRailProvider>
    );
  }

  return (
    <WorkspaceProductRailProvider value={railContextValue}>
      <motion.div
        className={sidebarShellClassName}
        layout
        style={sidebarShellStyle}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {sidebarHeader}
        <div
          className="flex min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-0 py-1 max-[767px]:flex-none md:flex-1"
          id="workspace-product-sidebar-scroll"
        >
          {showExpandedUi ? (
            expandedNav
          ) : (
            <nav aria-label="Workspace" className="flex flex-col items-center gap-1 px-1 pt-0.5">
              {collapsedIcons.map((item) => (
                <XfHoverHint hint={item.label} key={item.key} showDelayMs={150}>
                  <Link
                    aria-current={item.isActive ? "page" : undefined}
                    className={`flex h-11 w-11 min-h-[44px] min-w-[44px] min-[768px]:max-[980px]:h-12 min-[768px]:max-[980px]:w-12 min-[768px]:max-[980px]:min-h-[48px] min-[768px]:max-[980px]:min-w-[48px] shrink-0 items-center justify-center rounded-xl border border-transparent transition-[background-color,color,transform] duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_10%,transparent)] hover:text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] xf-focus-ring--sidebar ${
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

        {railFooter}
      </motion.div>
    </WorkspaceProductRailProvider>
  );
}
