"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    useEffect,
    useState,
    useSyncExternalStore,
    type ReactNode,
    type SVGProps,
    type SyntheticEvent
} from "react";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserRailAccountPanel } from "@/app/ui/app-user-rail-account-panel";
import { LucideHouseIcon, LucideMonitorIcon, LucideSquarePenIcon } from "@/app/ui/lucide-product-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { WorkspacePortfolioAccountPickerCard } from "@/app/ui/workspace-portfolio-account-picker-card";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
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
        strokeWidth={1.65}
      />
      <path d="M12 6.5v11" stroke="currentColor" strokeWidth={1.65} />
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

function AccountSummaryIcon({
  avatarUrl
}: {
  avatarUrl?: string;
}) {
  if (avatarUrl?.trim()) {
    return (
      <Image
        alt=""
        aria-hidden
        className="portfolios-workspace-sidebar__summary-avatar"
        height={20}
        src={avatarUrl}
        unoptimized
        width={20}
      />
    );
  }
  return <PersonIcon className="portfolios-workspace-sidebar__glyph" />;
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

/**
 * Native `<details>` does not support React's `defaultOpen` (unknown DOM prop). Sync initial
 * open state from the route with controlled `open` + `onToggle`.
 */
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
  icon
}: {
  label: string;
  icon?: ReactNode;
}) {
  return (
    <>
      <span className="portfolios-workspace-sidebar__summary-main">
        {icon ? <span className="portfolios-workspace-sidebar__summary-icon">{icon}</span> : null}
        <span className="portfolios-workspace-sidebar__summary-label">{label}</span>
      </span>
      <RailSectionChevron />
    </>
  );
}

export type WorkspaceProductSidebarProps = {
  defaultPortfolioId: string | null;
  isGlobalAdmin: boolean;
  accountDetails: AppUserRailAccountPanelDetails | null;
  /** Optional “Link Google” in account panel (e.g. xChat when Google OAuth is configured). */
  googleLinkHref?: string | null;
  accountFeedbackPageLabel?: string;
  workspaceBook?: AppUserDefaultBook | null;
  showReferenceDocs?: boolean;
  xchatSection?: ReactNode;
};

export function WorkspaceProductSidebar({
  defaultPortfolioId,
  isGlobalAdmin,
  accountDetails,
  googleLinkHref = null,
  accountFeedbackPageLabel,
  workspaceBook = null,
  showReferenceDocs = true,
  xchatSection
}: WorkspaceProductSidebarProps) {
  const pathname = usePathname() ?? "";
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
  const fallbackXchatSection = (
    <RouteSyncedDetails
      className="portfolios-workspace-sidebar__accordion"
      routeMatch={pathname.startsWith("/xchat")}
    >
      <summary className="portfolios-workspace-sidebar__accordion-summary">
        <SidebarAccordionSummary
          icon={<RailSidebarZapIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--zap" size="disclosure" />}
          label="xChat"
        />
      </summary>
      <div className="portfolios-workspace-sidebar__accordion-body">
        <SidebarLink href="/xchat?rail=xchat&item=composer#xchat-composer" nested title="Open xChat composer">
          <LucideSquarePenIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--composer" />
          <span>Composer</span>
        </SidebarLink>
        <SidebarLink href="/xchat?rail=xchat&item=persona" nested title="Open xChat persona panel">
          Persona
        </SidebarLink>
        <SidebarLink href="/xchat?rail=xchat&item=examples" nested title="Open xChat examples panel">
          Examples
        </SidebarLink>
        <SidebarLink href="/xchat?rail=xchat&item=history" nested title="Open xChat history panel">
          Chat history
        </SidebarLink>
      </div>
    </RouteSyncedDetails>
  );

  return (
    <nav className="portfolios-workspace-sidebar" aria-label="Workspace">
      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion"
        routeMatch={
          pathname.startsWith("/portfolios") ||
          pathname.startsWith("/portfolio") ||
          pathname.startsWith("/import-activity")
        }
      >
        <summary className="portfolios-workspace-sidebar__accordion-summary">
          <SidebarAccordionSummary
            icon={
              <LucideMonitorIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--hero portfolios-workspace-sidebar__glyph--portfolio-workspace" />
            }
            label="Portfolio workspace"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
          <WorkspacePortfolioAccountPickerCard book={workspaceBook} />
          <SidebarLink href="/portfolios" nested title="Books overview">
            myPortfolios
          </SidebarLink>
        </div>
      </RouteSyncedDetails>

      {xchatSection ?? fallbackXchatSection}

      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion"
        routeMatch={pathname.startsWith("/xoptions")}
      >
        <summary className="portfolios-workspace-sidebar__accordion-summary">
          <SidebarAccordionSummary
            icon={
              <LucideHouseIcon className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--hero" />
            }
            label="xOptions"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
          <SidebarLink href="/xoptions" nested title="xOptions — strategy builder and chains">
            <span className="portfolios-workspace-sidebar__emph">Open xOptions</span>
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

      <RouteSyncedDetails
        className="portfolios-workspace-sidebar__accordion"
        routeMatch={pathname.startsWith("/resources")}
      >
        <summary className="portfolios-workspace-sidebar__accordion-summary">
          <SidebarAccordionSummary
            icon={<ResourcesIcon className="portfolios-workspace-sidebar__glyph" />}
            label="Resources"
          />
        </summary>
        <div className="portfolios-workspace-sidebar__accordion-body">
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
        </div>
      </RouteSyncedDetails>

      {isGlobalAdmin ? (
        <SidebarLink href="/admin" title="Admin Hub">
          <AdminHubIcon className="portfolios-workspace-sidebar__glyph" />
          <span>Admin hub</span>
        </SidebarLink>
      ) : null}

      <div className="portfolios-workspace-sidebar__spacer" />

      {accountDetails ? (
        <RouteSyncedDetails
          className="portfolios-workspace-sidebar__accordion"
          routeMatch={pathname.startsWith("/account") || pathname.startsWith("/legal")}
        >
          <summary className="portfolios-workspace-sidebar__accordion-summary">
            <SidebarAccordionSummary
              icon={<AccountSummaryIcon avatarUrl={accountDetails.avatarUrl} />}
              label="Account"
            />
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
    </nav>
  );
}
