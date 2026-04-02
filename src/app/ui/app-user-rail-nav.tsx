"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode, type SVGProps } from "react";

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

function FindOptionsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M5 18h12M5 14h12M5 10h12M6 6h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.75}
      />
      <circle cx="8" cy="6" r="1.75" fill="currentColor" />
    </svg>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4V6z"
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
  children: ReactNode;
};

export function RailDisclosure({ title, icon, defaultOpen = false, children }: RailDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const btnId = useId();

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
          <span className="app-user-rail-disclosure__icon" aria-hidden>
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

type AccountSublinkProps = {
  href: string;
  children: ReactNode;
  title?: string;
};

function AccountSublink({ href, children, title }: AccountSublinkProps) {
  return <RailNavLink href={href} title={title}>{children}</RailNavLink>;
}

export type AppUserRailNavProps = {
  isGlobalAdmin: boolean;
  /** When true, disclosure starts expanded. Default collapsed across product + xChat rails. */
  railDisclosureDefaultOpen?: boolean;
  /** Hide non-resource shortcuts (used by guest/public shells). */
  showReferenceDocs?: boolean;
  /** Hide account settings row (used by guest/read-only shells). */
  showSettingsLink?: boolean;
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
  showReferenceDocs = true
}: AppUserRailNavProps) {
  return (
    <section className="app-user-rail-section" aria-label="Resources">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<BookIcon className="app-user-rail-disclosure__glyph" />}
        title="Resources"
      >
        <nav className="app-user-rail-sublinks" aria-label="Resource links">
          <RailNavLink href="/resources/about">About</RailNavLink>
          <RailNavLink href="/resources/decision-workflow">Decision workflow</RailNavLink>
          <RailNavLink href="/resources/secret-sauce">Secret sauce</RailNavLink>
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

export function AppUserOptionsRailSection({
  railDisclosureDefaultOpen = false
}: {
  railDisclosureDefaultOpen?: boolean;
}) {
  return (
    <section className="app-user-rail-section" aria-label="Options">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<FindOptionsGlyph className="app-user-rail-disclosure__glyph" />}
        title="Options"
      >
        <nav className="app-user-rail-sublinks" aria-label="Options links">
          <RailNavLink href="/resources/getting-started" title="Guide to investing with options">
            Getting started
          </RailNavLink>
          <RailNavLink href="/resources/building-wheel" title="Building a wheel strategy">
            Building a wheel
          </RailNavLink>
          <RailNavLink href="/resources/building-wheel/wheel-vs-iron-condor" title="Wheel vs iron condor">
            Wheel vs Iron Condor
          </RailNavLink>
          <RailNavLink href="/xoptions" title="xOptions — symbol, desk context, chain">
            xOptions
          </RailNavLink>
        </nav>
      </RailDisclosure>
    </section>
  );
}

export function AppUserXchatRailSection({ railDisclosureDefaultOpen = false }: { railDisclosureDefaultOpen?: boolean }) {
  return (
    <section className="app-user-rail-section" aria-label="xChat">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<ChatIcon className="app-user-rail-disclosure__glyph" />}
        title="xChat"
      >
        <nav className="app-user-rail-sublinks" aria-label="xChat links">
          <RailNavLink href="/xchat" title="Open xChat conversation workspace">
            Open xChat
          </RailNavLink>
          <RailNavLink href="/xchat" title="Use xChat example prompts from the left rail">
            Examples
          </RailNavLink>
          <RailNavLink href="/xchat" title="Use persona picker from xChat left rail">
            Personas
          </RailNavLink>
          <RailNavLink href="/xchat" title="Review your recent prompt history in xChat">
            Recent chats
          </RailNavLink>
        </nav>
      </RailDisclosure>
    </section>
  );
}

export function AppUserAccountRailSection({
  isGlobalAdmin,
  railDisclosureDefaultOpen = false,
  showSettingsLink = true
}: AppUserRailNavProps) {
  if (!showSettingsLink) {
    return null;
  }

  return (
    <section className="app-user-rail-section" aria-label="Account">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<PersonIcon className="app-user-rail-disclosure__glyph" />}
        title="Account"
      >
        <nav className="app-user-rail-sublinks" aria-label="Account links">
          {isGlobalAdmin ? (
            <AccountSublink href="/admin/manage_account" title="Workspace and account settings">
              Settings
            </AccountSublink>
          ) : (
            <XfHoverHint hint="Workspace settings are available from Hub (admin)">
              <span className="app-user-rail-sublink app-user-rail-sublink--muted" role="note" tabIndex={0}>
                Settings
              </span>
            </XfHoverHint>
          )}
        </nav>
      </RailDisclosure>
    </section>
  );
}

/** Manage workspace — user + portfolio/account pickers (when `railContext` is set) and workspace links */
export function AppUserManageWorkspaceRailSection({
  railDisclosureDefaultOpen = false,
  isGlobalAdmin = false,
  workspacePortfolioId = null,
  railContext = null,
  defaultBookLabels = null
}: {
  railDisclosureDefaultOpen?: boolean;
  isGlobalAdmin?: boolean;
  /** Prefer explicit id when `railContext` is not passed (e.g. xChat rail). */
  workspacePortfolioId?: string | null;
  /** When set (product shell), renders user name and portfolio/account pickers inside this group. */
  railContext?: AppUserPublicRailContext | null;
  /** xChat: resolved default portfolio + account labels; nested under this section, collapsed by default. */
  defaultBookLabels?: { portfolioName: string; accountName: string } | null;
}) {
  const rawPid =
    workspacePortfolioId?.trim() ||
    railContext?.book?.portfolioId?.trim() ||
    "";
  const portfolioQs =
    rawPid.length > 0 ? `?portfolioId=${encodeURIComponent(rawPid)}` : "";
  const watchlistHref = `/watchlist${portfolioQs}`;
  const alertsHref = `/portfolio/alerts${portfolioQs}`;

  return (
    <section className="app-user-rail-section" aria-label="Manage workspace">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<RailSidebarZapIcon className="app-user-rail-disclosure__glyph" size="disclosure" />}
        title="Manage workspace"
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
            <RailNavLink href={watchlistHref} title="Watchlist for the active workspace portfolio">
              Watchlist
            </RailNavLink>
            <RailNavLink href={alertsHref} title="Alerts for the active workspace portfolio">
              Alerts
            </RailNavLink>
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

export function AppUserAccountPublicRail({ isGlobalAdmin, railContext }: AppUserAccountPublicRailProps) {
  return (
    <aside className="app-user-public-rail xf-widget" aria-label="Account navigation">
      <AppUserManageWorkspaceRailSection isGlobalAdmin={isGlobalAdmin} railContext={railContext} />
      <AppUserXchatRailSection />
      <AppUserOptionsRailSection />
      <AppUserResourcesRailSection isGlobalAdmin={isGlobalAdmin} />
      <AppUserAccountRailSection isGlobalAdmin={isGlobalAdmin} />
    </aside>
  );
}
