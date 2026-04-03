"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, SVGProps } from "react";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserRailAccountPanel } from "@/app/ui/app-user-rail-account-panel";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

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
    <Link className={cls} href={href} title={title}>
      {children}
    </Link>
  );
}

function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4V6z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 7a3 3 0 013-3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a3 3 0 01-3-3V7z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path d="M4 10h16" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M12 3l2.1 4.26L18 8l-3.5 3.4.83 4.86L12 14.9 8.67 16.26 9.5 11.4 6 8l3.9-.74L12 3z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.4}
      />
    </svg>
  );
}

function OptionsGlyph(props: SVGProps<SVGSVGElement>) {
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

export type WorkspaceProductSidebarProps = {
  defaultPortfolioId: string | null;
  isGlobalAdmin: boolean;
  /** e.g. `/portfolios#portfolios-watchlist` on books page, or `/watchlist?portfolioId=` elsewhere */
  watchlistHref: string;
  accountDetails: AppUserRailAccountPanelDetails | null;
  /** Optional “Link Google” in account panel (e.g. xChat when Google OAuth is configured). */
  googleLinkHref?: string | null;
  accountFeedbackPageLabel?: string;
  defaultBookLabels?: { portfolioName: string; accountName: string } | null;
  showReferenceDocs?: boolean;
};

export function WorkspaceProductSidebar({
  defaultPortfolioId,
  isGlobalAdmin,
  watchlistHref,
  accountDetails,
  googleLinkHref = null,
  accountFeedbackPageLabel,
  defaultBookLabels = null,
  showReferenceDocs = true
}: WorkspaceProductSidebarProps) {
  const importHref =
    defaultPortfolioId !== null
      ? `/import-activity?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
      : "/import-activity";

  return (
    <nav className="portfolios-workspace-sidebar" aria-label="Workspace">
      <SidebarLink href="/portfolios" title="Books overview">
        <GridIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Portfolios</span>
      </SidebarLink>
      <SidebarLink href="/xchat" title="Open xChat">
        <ChatBubbleIcon className="portfolios-workspace-sidebar__glyph" />
        <span>xChat</span>
      </SidebarLink>
      <SidebarLink href="/portfolio" title="Accounts and positions">
        <WalletIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Accounts</span>
      </SidebarLink>
      <SidebarLink
        href={watchlistHref}
        title={
          watchlistHref.includes("#portfolios-watchlist")
            ? "Watchlist table on portfolios"
            : "Full watchlist"
        }
      >
        <StarIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Watchlist</span>
      </SidebarLink>
      <SidebarLink href="/xoptions" title="xOptions — strategy builder and chains">
        <OptionsGlyph className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--emph" />
        <span className="portfolios-workspace-sidebar__emph">xOptions</span>
      </SidebarLink>
      {isGlobalAdmin ? (
        <SidebarLink href="/admin" title="Admin Hub">
          <AdminHubIcon className="portfolios-workspace-sidebar__glyph" />
          <span>Admin hub</span>
        </SidebarLink>
      ) : null}

      <div className="portfolios-workspace-sidebar__spacer" />

      <SidebarLink href={importHref} title="Merrill / Fidelity broker import">
        <UploadGlyph className="portfolios-workspace-sidebar__glyph" />
        <span>Broker import</span>
      </SidebarLink>

      {defaultBookLabels ? (
        <details className="portfolios-workspace-sidebar__accordion">
          <summary className="portfolios-workspace-sidebar__accordion-summary">Default book</summary>
          <div className="portfolios-workspace-sidebar__accordion-body">
            <p className="portfolios-workspace-sidebar__accordion-meta">Portfolio</p>
            <SidebarLink href="/portfolio" nested title="Open portfolio">
              <span>{defaultBookLabels.portfolioName}</span>
            </SidebarLink>
            <p className="portfolios-workspace-sidebar__accordion-meta portfolios-workspace-sidebar__accordion-meta--mt">
              Account
            </p>
            <p className="portfolios-workspace-sidebar__accordion-static">{defaultBookLabels.accountName}</p>
          </div>
        </details>
      ) : null}

      <details className="portfolios-workspace-sidebar__accordion">
        <summary className="portfolios-workspace-sidebar__accordion-summary">Resources</summary>
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
        </div>
      </details>

      {accountDetails ? (
        <details className="portfolios-workspace-sidebar__accordion">
          <summary className="portfolios-workspace-sidebar__accordion-summary">Account</summary>
          <div className="portfolios-workspace-sidebar__accordion-body portfolios-workspace-sidebar__accordion-body--account">
            <AppUserRailAccountPanel
              details={accountDetails}
              feedbackPageLabel={accountFeedbackPageLabel}
              googleLinkHref={googleLinkHref}
            />
          </div>
        </details>
      ) : null}
    </nav>
  );
}
