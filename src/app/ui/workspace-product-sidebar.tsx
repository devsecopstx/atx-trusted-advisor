"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
    type SVGProps,
    type SyntheticEvent
} from "react";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserRailAccountPanel } from "@/app/ui/app-user-rail-account-panel";
import { AppUserWorkspacePortfolioPicker } from "@/app/ui/app-user-workspace-portfolio-picker";
import { AtxFinanceMark, LightningBolt } from "@/app/ui/atxfinance-logo";
import { ChatHistoryRailIcon } from "@/app/ui/chat-history-rail-icon";
import {
    LucideBookOpenIcon,
    LucideChevronLeftIcon,
    LucideChevronRightIcon,
    LucideClipboardListIcon,
    LucideListBulletsIcon,
    LucideMenuIcon,
    LucideMonitorIcon,
    LucideSettingsIcon,
    LucideSquarePenIcon,
    LucideUploadIcon,
    LucideXIcon,
    XoptionsRocketIcon
} from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { useTenantShellBranding } from "@/app/ui/tenant-branding-context";
import { useTenantUxPolicy } from "@/app/ui/use-tenant-ux-policy";
import {
    WorkspaceMobileDrawerNavProvider,
    useWorkspaceMobileDrawerClose
} from "@/app/ui/workspace-mobile-drawer-nav-context";
import { WorkspacePortfolioAccountPickerCard } from "@/app/ui/workspace-portfolio-account-picker-card";
import { WorkspaceProductRailProvider } from "@/app/ui/workspace-product-rail-context";
import { WorkspaceRailLogout } from "@/app/ui/workspace-rail-logout";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatAttachmentsPanel } from "@/app/xchat/ui/xchat-attachments-panel";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import { useFocusTrap } from "@/lib/use-focus-trap";
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
import {
  getRailExpandedSnapshot,
  RAIL_EXPANDED_STORAGE_KEY,
  WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE
} from "@/lib/workspace-product-rail-storage";

export {
  WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE,
  collapseWorkspaceProductRail,
  expandWorkspaceProductRail
} from "@/lib/workspace-product-rail-storage";

/** Expanded desktop rail (`lg+`). Was 280px → 140px → +25% (175px) so desk labels (e.g. Portfolio desk) stay on one line. */
const WORKSPACE_PRODUCT_RAIL_EXPANDED_WIDTH_PX = 175;
const WORKSPACE_PRODUCT_RAIL_COLLAPSED_WIDTH_PX = 64;

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
  const closeDrawer = useWorkspaceMobileDrawerClose();
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
      onClick={() => {
        closeDrawer?.();
      }}
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
  const closeDrawer = useWorkspaceMobileDrawerClose();
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
          onClick={(e) => {
            e.stopPropagation();
            closeDrawer?.();
          }}
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

/** Viewports below Tailwind `lg` (1024px): overlay drawer + top workspace chrome, full-width content. */
function subscribeMaxWidth1023(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia("(max-width: 1023px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMaxWidth1023Snapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Phones: drawer width cap + quick-action pills in top chrome. */
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

type WorkspaceTopChromeBarProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  workspaceBrandHref: string;
  watchlistHref: string;
  /** `<768px`: show xOptions · Watchlist · xChat pills */
  showQuickPills: boolean;
  isPathVisible: (pathPrefix: string) => boolean;
  workspaceBook: AppUserDefaultBook | null;
  accountDetails: AppUserRailAccountPanelDetails | null;
};

function WorkspaceTopChromeBar({
  drawerOpen,
  onToggleDrawer,
  workspaceBrandHref,
  watchlistHref,
  showQuickPills,
  isPathVisible,
  workspaceBook,
  accountDetails
}: WorkspaceTopChromeBarProps) {
  const branding = useTenantShellBranding();
  const deskLabel = branding?.displayName?.trim() || null;

  return (
    <header className="workspace-top-chrome">
      <div className="workspace-top-chrome__leading">
        <button
          aria-controls="workspace-drawer-panel"
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? "Close workspace navigation" : "Open workspace navigation"}
          className="workspace-top-chrome__icon-btn xf-focus-ring--sidebar"
          type="button"
          onClick={onToggleDrawer}
        >
          {drawerOpen ? (
            <LucideXIcon className="h-5 w-5 text-[var(--xf-text-100)]" />
          ) : (
            <LucideMenuIcon className="h-5 w-5 text-[var(--xf-text-100)]" />
          )}
        </button>
        <Link
          aria-label="Workspace home"
          className="workspace-top-chrome__brand-lockup xf-focus-ring--sidebar"
          href={workspaceBrandHref}
          title="Workspace home"
        >
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant CDN / data URLs
            <img
              alt=""
              className="workspace-top-chrome__tenant-logo"
              height={28}
              src={branding.logoUrl}
              width={28}
            />
          ) : (
            <AtxFinanceMark className="shrink-0" size={20} />
          )}
        </Link>
        {deskLabel ? (
          <span className="workspace-top-chrome__tenant-name min-w-0 truncate font-medium text-[var(--xf-text-200)]">
            {deskLabel}
          </span>
        ) : null}
      </div>

      <div className="workspace-top-chrome__center min-w-0">
        {workspaceBook?.workspacePortfolios?.length ? (
          <div className="workspace-top-chrome__portfolio workspace-top-chrome__portfolio--compact">
            <AppUserWorkspacePortfolioPicker
              portfolios={workspaceBook.workspacePortfolios}
              selectedPortfolioId={workspaceBook.portfolioId}
            />
          </div>
        ) : null}
      </div>

      <div className="workspace-top-chrome__trailing">
        {showQuickPills ? (
          <nav aria-label="Workspace shortcuts" className="workspace-top-chrome__pills">
            {isPathVisible("/xoptions") ? (
              <Link className="workspace-top-chrome__pill" href="/xoptions">
                xOptions
              </Link>
            ) : null}
            {isPathVisible("/watchlist") ? (
              <Link className="workspace-top-chrome__pill" href={watchlistHref}>
                Watchlist
              </Link>
            ) : null}
            {isPathVisible("/xchat") ? (
              <Link className="workspace-top-chrome__pill" href="/xchat">
                xChat
              </Link>
            ) : null}
          </nav>
        ) : null}
        {accountDetails ? (
          <Link
            aria-label="Account and feedback"
            className="workspace-top-chrome__avatar-btn xf-focus-ring--sidebar"
            href="/account/billing"
          >
            {accountDetails.avatarUrl?.trim() ? (
              <Image
                alt=""
                aria-hidden
                className="workspace-top-chrome__avatar-img"
                height={32}
                src={accountDetails.avatarUrl}
                unoptimized
                width={32}
              />
            ) : (
              <PersonIcon className="h-7 w-7 text-[var(--xf-text-300)]" />
            )}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

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
  const belowLg = useSyncExternalStore(subscribeMaxWidth1023, getMaxWidth1023Snapshot, () => false);
  const belowMd = useSyncExternalStore(subscribeMaxWidth767, getMaxWidth767Snapshot, () => false);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
  const isDesktopLg = !belowLg;
  const isXchatRoute = pathname.startsWith("/xchat");
  const isXoptionsRoute = pathname.startsWith("/xoptions");
  const isWatchlistRoute = pathname.startsWith("/watchlist");
  const isPortfolioAlertsRoute = pathname.startsWith("/portfolio/alerts");
  const isPortfoliosDeskRoute = pathname.startsWith("/portfolios");
  /** Same scope as the Account accordion’s `routeMatch` (excludes `/account/tasks` — that lives under Resources). */
  const isAccountOrLegalAppRoute =
    (pathname.startsWith("/account") && !pathname.startsWith("/account/tasks")) ||
    pathname.startsWith("/legal");
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
    if (!belowLg) {
      return;
    }
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
    belowLg,
    isAccountOrLegalAppRoute,
    isPortfolioAlertsRoute,
    isPortfoliosDeskRoute,
    isWatchlistRoute,
    isXoptionsRoute,
    pathname,
    persistExpanded
  ]);

  useEffect(() => {
    if (!belowLg || typeof document === "undefined") {
      return;
    }
    document.documentElement.setAttribute("data-xf-workspace-top-chrome", "");
    return () => document.documentElement.removeAttribute("data-xf-workspace-top-chrome");
  }, [belowLg]);

  useEffect(() => {
    if (!belowLg || !expanded) {
      return;
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        persistExpanded(false);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [belowLg, expanded, persistExpanded]);

  /** Desktop lg+: full labels when expanded; icon rail when collapsed. Drawer / top chrome always use full labels. */
  const showWideSidebarChrome = belowLg || expanded;

  const toggleRail = useCallback(() => persistExpanded(!expanded), [expanded, persistExpanded]);

  const railContextValue = useMemo(
    () => ({ expanded, showExpandedUi: showWideSidebarChrome, toggle: toggleRail }),
    [expanded, showWideSidebarChrome, toggleRail]
  );

  useEffect(() => {
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
  }, [expanded, persistExpanded]);

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

  const railWidthPx = isDesktopLg
    ? expanded
      ? WORKSPACE_PRODUCT_RAIL_EXPANDED_WIDTH_PX
      : WORKSPACE_PRODUCT_RAIL_COLLAPSED_WIDTH_PX
    : 0;

  const drawerOpen = belowLg && expanded;
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerOpen, drawerPanelRef);

  /*
   * BEFORE: Collapse lived in the footer beside the avatar; nav had no explicit “main vs resources” grouping.
   * AFTER: Institutional header (aTx⚡Finance + obvious chevron toggle), grouped main desk nav, Resources divider,
   *        account chrome moved to the footer stack (appearance → profile disclosure → logout → legal micro-links).
   */
  const sidebarHeader = (
    <header className="workspace-product-sidebar__header">
      <div
        className={`workspace-product-sidebar__header-inner${showWideSidebarChrome ? "" : " workspace-product-sidebar__header-inner--collapsed"}`}
      >
        <Link
          aria-label={showWideSidebarChrome ? "Workspace home" : "aTx Finance — workspace home"}
          className="workspace-product-sidebar__brand"
          href={workspaceBrandHref}
          title="Workspace home"
        >
          <AtxFinanceMark className="shrink-0" size={showWideSidebarChrome ? 22 : 20} />
          {showWideSidebarChrome ? (
            <>
              <LightningBolt size={16} />
              <span className="workspace-product-sidebar__brand-finance">Finance</span>
            </>
          ) : null}
        </Link>
        {belowLg ? (
          <button
            aria-label="Close workspace navigation"
            className="workspace-product-sidebar__drawer-close xf-focus-ring--sidebar"
            type="button"
            onClick={() => persistExpanded(false)}
          >
            <LucideXIcon className="workspace-product-sidebar__collapse-toggle-icon" />
          </button>
        ) : null}
        {isDesktopLg ? (
          <XfHoverHint hint={expanded ? "Collapse sidebar (⌘B / Ctrl+B)" : "Expand sidebar (⌘B / Ctrl+B)"}>
            <button
              aria-controls="workspace-product-sidebar-scroll"
              aria-expanded={expanded}
              aria-label="Toggle sidebar"
              className="workspace-product-sidebar__collapse-toggle xf-focus-ring--sidebar"
              type="button"
              onClick={() => persistExpanded(!expanded)}
            >
              {expanded ? (
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
      {accountDetails ? (
        <details className="workspace-rail-account-disclosure">
          <summary
            className={`workspace-rail-account-disclosure__summary xf-focus-ring--sidebar${showWideSidebarChrome ? "" : " workspace-rail-account-disclosure__summary--icon-only"}`}
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
            {showWideSidebarChrome ? (
              <span className="workspace-rail-account-disclosure__identity">
                <span className="workspace-rail-account-disclosure__name">{displayName}</span>
                <span className="workspace-rail-account-disclosure__hint">Profile &amp; feedback</span>
              </span>
            ) : (
              <span className="sr-only">Open account menu</span>
            )}
            {showWideSidebarChrome ? <RailSectionChevron /> : null}
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
      {accountDetails ? <WorkspaceRailLogout railExpanded={showWideSidebarChrome} /> : null}
    </footer>
  );

  const sidebarShellClassName =
    "workspace-product-sidebar--desktop-rail flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] shadow-sm backdrop-blur-sm transition-[width] duration-200 ease-out dark:shadow-md";

  const sidebarShellStyle = {
    width: `${railWidthPx}px`,
    boxSizing: "border-box" as const
  };

  const drawerTransitionClass = reduceMotion
    ? ""
    : "workspace-product-sidebar__drawer-panel--motion workspace-rail-drawer-transition";

  const mobileDrawerClose = belowLg ? () => persistExpanded(false) : null;

  return (
    <WorkspaceProductRailProvider value={railContextValue}>
      <WorkspaceMobileDrawerNavProvider closeDrawer={mobileDrawerClose}>
        {belowLg ? (
          <WorkspaceTopChromeBar
            accountDetails={accountDetails}
            drawerOpen={drawerOpen}
            isPathVisible={isPathVisible}
            showQuickPills={belowMd}
            watchlistHref={watchlistHref}
            workspaceBook={workspaceBook}
            workspaceBrandHref={workspaceBrandHref}
            onToggleDrawer={() => persistExpanded(!expanded)}
          />
        ) : null}

        {drawerOpen ? (
          <>
            <button
              aria-label="Close workspace navigation"
              className="workspace-product-sidebar__drawer-backdrop workspace-rail-drawer-backdrop fixed inset-0 z-[1040] border-0 p-0"
              type="button"
              onClick={() => persistExpanded(false)}
            />
            <div
              ref={drawerPanelRef}
              aria-labelledby="workspace-drawer-title"
              aria-modal="true"
              className={`workspace-product-sidebar__drawer-panel workspace-rail-drawer-panel fixed bottom-0 left-0 top-0 z-[1045] flex min-h-0 flex-col border border-[var(--xf-xchat-rail-border)] bg-[var(--xf-xchat-rail-bg)] pt-[calc(env(safe-area-inset-top)+3.25rem)] pl-[env(safe-area-inset-left)] shadow-xl backdrop-blur-md max-[767px]:rounded-r-xl ${drawerTransitionClass}`}
              id="workspace-drawer-panel"
              role="dialog"
              style={{
                width: `min(100vw, ${WORKSPACE_PRODUCT_RAIL_EXPANDED_WIDTH_PX}px)`
              }}
            >
              <span className="sr-only" id="workspace-drawer-title">
                Workspace navigation
              </span>
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
        ) : null}

        {isDesktopLg ? (
          <motion.div
            className={sidebarShellClassName}
            layout={!reduceMotion}
            style={sidebarShellStyle}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {sidebarHeader}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-0 py-1"
              id="workspace-product-sidebar-scroll"
            >
              {expanded ? (
                expandedNav
              ) : (
                <nav aria-label="Workspace" className="flex flex-col items-center gap-1 px-1 pt-0.5">
                  {collapsedIcons.map((item) => (
                    <XfHoverHint hint={item.label} key={item.key} showDelayMs={150}>
                      <Link
                        aria-current={item.isActive ? "page" : undefined}
                        className={`flex h-11 w-11 min-h-[44px] min-w-[44px] min-[1024px]:h-12 min-[1024px]:w-12 min-[1024px]:min-h-[48px] min-[1024px]:min-w-[48px] shrink-0 items-center justify-center rounded-xl border border-transparent transition-[background-color,color,transform] duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_10%,transparent)] hover:text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] xf-focus-ring--sidebar ${
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
        ) : null}
      </WorkspaceMobileDrawerNavProvider>
    </WorkspaceProductRailProvider>
  );
}
