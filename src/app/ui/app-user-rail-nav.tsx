"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode, type SVGProps } from "react";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserRailAccountPanel } from "@/app/ui/app-user-rail-account-panel";
import { AppUserWorkspaceAccountPicker } from "@/app/ui/app-user-workspace-account-picker";
import { AppUserWorkspacePortfolioPicker } from "@/app/ui/app-user-workspace-portfolio-picker";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";

function RailSectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`app-user-rail-chevron${open ? "" : " app-user-rail-chevron--collapsed"}`}
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

function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5zm0 0v14a2 2 0 012-2h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

type RailDisclosureProps = {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  /** Merged onto the icon wrapper span (e.g. size modifiers). Keeps leaf SVG `className` stable for SSR/hydration. */
  iconWrapClassName?: string;
  children: ReactNode;
};

export function RailDisclosure({
  title,
  icon,
  defaultOpen = false,
  iconWrapClassName,
  children
}: RailDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const btnId = useId();
  const iconWrapCls = ["app-user-rail-disclosure__icon", iconWrapClassName].filter(Boolean).join(" ");

  return (
    <div className="app-user-rail-disclosure">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="app-user-rail-disclosure__trigger"
        id={btnId}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="app-user-rail-disclosure__trigger-main">
          <span className={iconWrapCls} aria-hidden>
            {icon}
          </span>
          <span className="app-user-rail-disclosure__title">{title}</span>
        </span>
        <RailSectionChevron open={open} />
      </button>
      {open ? (
        <div className="app-user-rail-disclosure__panel" id={panelId} role="region" aria-labelledby={btnId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function sublinkActive(pathname: string, href: string): boolean {
  if (!href.startsWith("/")) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailNavLink({ href, children, title }: { href: string; children: ReactNode; title?: string }) {
  const pathname = usePathname() ?? "";
  const active = sublinkActive(pathname, href);
  const cls = `app-user-rail-sublink${active ? " app-user-rail-sublink--active" : ""}`;
  const link = (
    <Link className={cls} href={href}>
      {children}
    </Link>
  );
  const t = title?.trim();
  if (t) {
    return <XfHoverHint hint={t}>{link}</XfHoverHint>;
  }
  return link;
}

export type AppUserRailNavProps = {
  isGlobalAdmin: boolean;
  /** When true, disclosure starts expanded. Default collapsed across product + xChat rails. */
  railDisclosureDefaultOpen?: boolean;
  /** Hide non-resource shortcuts (used by guest/public shells). */
  showReferenceDocs?: boolean;
  /** Hide account settings row (used by guest/read-only shells). */
  showSettingsLink?: boolean;
  /** Active workspace portfolio for import-activity deep link; omit for `/import-activity` only. */
  workspacePortfolioId?: string | null;
};

export type AppUserPublicRailContext = {
  userDisplayName: string;
  book: AppUserDefaultBook | null;
};

export type AppUserAccountPublicRailProps = AppUserRailNavProps & {
  railContext: AppUserPublicRailContext;
};

export function AppUserResourcesRailSection({
  isGlobalAdmin,
  railDisclosureDefaultOpen = false,
  showReferenceDocs = true,
  workspacePortfolioId = null
}: AppUserRailNavProps) {
  const pid = workspacePortfolioId?.trim() ?? "";
  const importHref =
    pid.length > 0 ? `/import-activity?portfolioId=${encodeURIComponent(pid)}` : "/import-activity";

  return (
    <section className="app-user-rail-section" aria-label="Resources">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<BookIcon className="app-user-rail-disclosure__glyph" />}
        iconWrapClassName="app-user-rail-disclosure__icon--resources"
        title="Resources"
      >
        <nav className="app-user-rail-sublinks" aria-label="Resource links">
          <RailNavLink href="/resources/about">About</RailNavLink>
          <RailNavLink href="/resources/decision-workflow">Decision workflow</RailNavLink>
          <RailNavLink href="/resources/secret-sauce">Secret sauce</RailNavLink>
          <RailNavLink href="/resources/getting-started" title="Guide to investing with options">
            Getting started
          </RailNavLink>
          <RailNavLink href="/resources/building-wheel" title="Building a wheel strategy">
            Building a wheel
          </RailNavLink>
          <RailNavLink href="/resources/building-wheel/wheel-vs-iron-condor" title="Wheel vs iron condor">
            Wheel vs Iron Condor
          </RailNavLink>
          <RailNavLink href={importHref} title="Upload broker CSV exports (Merrill, Fidelity, …)">
            Broker import
          </RailNavLink>
          {showReferenceDocs
            ? isGlobalAdmin ? (
                <RailNavLink href="/admin/api-docs">Reference docs</RailNavLink>
              ) : (
                <XfHoverHint hint="Open API reference from Hub when you have admin access">
                  <span className="app-user-rail-sublink app-user-rail-sublink--muted" role="note" tabIndex={0}>
                    Reference Docs
                  </span>
                </XfHoverHint>
              )
            : null}
        </nav>
      </RailDisclosure>
    </section>
  );
}

export function AppUserAccountRailSection({
  railDisclosureDefaultOpen = false,
  showSettingsLink = true,
  accountDetails = null,
  accountFeedbackPageLabel
}: {
  railDisclosureDefaultOpen?: boolean;
  showSettingsLink?: boolean;
  accountDetails?: AppUserRailAccountPanelDetails | null;
  accountFeedbackPageLabel?: string;
}) {
  if (!showSettingsLink) {
    return null;
  }

  if (!accountDetails) {
    return null;
  }

  return (
    <section className="app-user-rail-section" aria-label="Account">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<PersonIcon className="app-user-rail-disclosure__glyph" />}
        title="Account"
      >
        <AppUserRailAccountPanel details={accountDetails} feedbackPageLabel={accountFeedbackPageLabel} />
      </RailDisclosure>
    </section>
  );
}

/** Manage workspace — user + portfolio/account pickers (when `railContext` is set) and workspace links */
export function AppUserManageWorkspaceRailSection({
  railDisclosureDefaultOpen = false,
  isGlobalAdmin = false,
  railContext = null,
  defaultBookLabels = null,
  includeProductLinks = false
}: {
  railDisclosureDefaultOpen?: boolean;
  isGlobalAdmin?: boolean;
  /** When set (product shell), renders user name and portfolio/account pickers inside this group. */
  railContext?: AppUserPublicRailContext | null;
  /** xChat: resolved default portfolio + account labels; nested under this section, collapsed by default. */
  defaultBookLabels?: { portfolioName: string; accountName: string } | null;
  /** When true, show xChat/xOptions under Manage Workspace. */
  includeProductLinks?: boolean;
}) {
  return (
    <section className="app-user-rail-section" aria-label="Manage Workspace">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<RailSidebarZapIcon className="app-user-rail-disclosure__glyph app-user-rail-disclosure__glyph--zap" size="disclosure" />}
        title="Manage Workspace"
      >
        <>
          {railContext ? (
            <div className="app-user-rail-section--workspace">
              <p className="app-user-rail-workspace-name">{railContext.userDisplayName}</p>
              {railContext.book ? (
                <div className="app-user-rail-workspace-card">
                  <AppUserWorkspacePortfolioPicker
                    portfolios={railContext.book.workspacePortfolios}
                    selectedPortfolioId={railContext.book.portfolioId}
                  />
                  <AppUserWorkspaceAccountPicker
                    accounts={railContext.book.accounts}
                    portfolioId={railContext.book.portfolioId}
                    serverDefaultAccountId={railContext.book.accountId}
                  />
                </div>
              ) : (
                <p className="app-user-rail-workspace-hint">
                  Default portfolio isn&apos;t available yet.{" "}
                  <Link className="app-user-rail-workspace-hint-link" href="/portfolios">
                    Portfolios
                  </Link>{" "}
                  to add a portfolio, or use <span className="text-[var(--xf-text-200)]">Portfolio</span> in the nav
                  for positions.
                </p>
              )}
            </div>
          ) : null}
          <nav className="app-user-rail-sublinks" aria-label="Workspace administration">
            <RailNavLink href="/portfolios" title="Portfolios — workspace, accounts, allocation">
              myPortfolios
            </RailNavLink>
            {includeProductLinks ? (
              <RailNavLink href="/xchat" title="Open xChat">
                xChat
              </RailNavLink>
            ) : null}
            {includeProductLinks ? (
              <RailNavLink href="/xoptions" title="xOptions — symbol, desk context, chain">
                xOptions
              </RailNavLink>
            ) : null}
            {isGlobalAdmin ? (
              <RailNavLink href="/admin" title="Open Admin Hub (global admin only)">
                Admin hub
              </RailNavLink>
            ) : null}
          </nav>
          {defaultBookLabels ? (
            <div className="app-user-manage-workspace__nested-default-book">
              <RailDisclosure
                defaultOpen={false}
                icon={<BookIcon className="app-user-rail-disclosure__glyph" />}
                title="Default book"
              >
                <div className="xchat-rail-book-card" aria-label="Default portfolio and account">
                  <div className="xchat-rail-book-row">
                    <span className="xchat-rail-book-k">Portfolio</span>
                    <XfHoverHint hint="Open portfolio">
                      <Link
                        className="xchat-rail-book-v xchat-rail-book-v--link"
                        href="/portfolio"
                      >
                        {defaultBookLabels.portfolioName}
                      </Link>
                    </XfHoverHint>
                  </div>
                  <div className="xchat-rail-book-row">
                    <span className="xchat-rail-book-k">Account</span>
                    <span className="xchat-rail-book-v">{defaultBookLabels.accountName}</span>
                  </div>
                </div>
              </RailDisclosure>
            </div>
          ) : null}
        </>
      </RailDisclosure>
    </section>
  );
}

export type AppUserAccountPublicRailExtendedProps = AppUserAccountPublicRailProps & {
  accountDetails: AppUserRailAccountPanelDetails;
  accountFeedbackPageLabel?: string;
};

export function AppUserAccountPublicRail({
  isGlobalAdmin,
  railContext,
  accountDetails,
  accountFeedbackPageLabel
}: AppUserAccountPublicRailExtendedProps) {
  return (
    <aside className="app-user-public-rail xf-widget" aria-label="Account navigation">
      <AppUserManageWorkspaceRailSection
        includeProductLinks
        isGlobalAdmin={isGlobalAdmin}
        railContext={railContext}
      />
      <AppUserResourcesRailSection
        isGlobalAdmin={isGlobalAdmin}
        workspacePortfolioId={railContext.book?.portfolioId ?? null}
      />
      <AppUserAccountRailSection
        accountDetails={accountDetails}
        accountFeedbackPageLabel={accountFeedbackPageLabel}
      />
    </aside>
  );
}
