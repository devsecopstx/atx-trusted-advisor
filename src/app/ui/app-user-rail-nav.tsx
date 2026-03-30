"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode, type SVGProps } from "react";

import { AppUserWorkspaceAccountPicker } from "@/app/ui/app-user-workspace-account-picker";
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

/** Hub / workspace tools — matches admin product chrome */
function ManageWorkspaceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.65}
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

export function RailDisclosure({ title, icon, defaultOpen = true, children }: RailDisclosureProps) {
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

function AccountLegalLink() {
  const pathname = usePathname() ?? "";
  const active = pathname.startsWith("/legal");
  return (
    <Link
      className={`app-user-rail-sublink${active ? " app-user-rail-sublink--active" : ""}`}
      href="/legal/terms"
    >
      Legal Agreements
    </Link>
  );
}

export type AppUserRailNavProps = {
  isGlobalAdmin: boolean;
  /** When false, disclosure starts collapsed (e.g. xChat first land). Default true elsewhere. */
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
  railDisclosureDefaultOpen = true,
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
          <RailNavLink href="/resources/getting-started">Getting Started</RailNavLink>
          <RailNavLink href="/resources/secret-sauce">Secret Sauce</RailNavLink>
          <RailNavLink href="/resources/building-wheel">Building a Wheel</RailNavLink>
          <RailNavLink href="/resources/building-wheel/wheel-vs-iron-condor">
            Wheel vs Iron Condor
          </RailNavLink>
          {showReferenceDocs
            ? isGlobalAdmin ? (
                <RailNavLink href="/admin/api-docs">Reference Docs</RailNavLink>
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

export function AppUserFindOptionsRailSection({
  railDisclosureDefaultOpen = true
}: {
  railDisclosureDefaultOpen?: boolean;
}) {
  return (
    <section className="app-user-rail-section" aria-label="Find options">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<FindOptionsGlyph className="app-user-rail-disclosure__glyph" />}
        title="Find Options"
      >
        <nav className="app-user-rail-sublinks" aria-label="Find options links">
          <RailNavLink href="/app_user/xoptions/strategy-builder" title="Strategy builder — symbol, outlook, chain filters">
            Strategy builder
          </RailNavLink>
          <RailNavLink href="/app_user/xoptions" title="xOptions pitch and follow-up">
            xOptions overview
          </RailNavLink>
        </nav>
      </RailDisclosure>
    </section>
  );
}

export function AppUserXchatRailSection({ railDisclosureDefaultOpen = true }: { railDisclosureDefaultOpen?: boolean }) {
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
  railDisclosureDefaultOpen = true,
  showSettingsLink = true
}: AppUserRailNavProps) {
  return (
    <section className="app-user-rail-section" aria-label="Account">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<PersonIcon className="app-user-rail-disclosure__glyph" />}
        title="Account"
      >
        <nav className="app-user-rail-sublinks" aria-label="Account links">
          <RailNavLink href="/account/billing" title="ATX plans and Stripe checkout">
            Plans &amp; billing
          </RailNavLink>
          <AccountLegalLink />
          {showSettingsLink
            ? isGlobalAdmin ? (
                <AccountSublink href="/admin/manage_account">Settings</AccountSublink>
              ) : (
                <XfHoverHint hint="Workspace settings are available from Hub (admin)">
                  <span className="app-user-rail-sublink app-user-rail-sublink--muted" role="note" tabIndex={0}>
                    Settings
                  </span>
                </XfHoverHint>
              )
            : null}
        </nav>
      </RailDisclosure>
    </section>
  );
}

/** Global admin only — tenant Hub and admin console entry from the same rail as product surfaces */
export function AppUserManageWorkspaceRailSection({
  railDisclosureDefaultOpen = true
}: {
  railDisclosureDefaultOpen?: boolean;
}) {
  return (
    <section className="app-user-rail-section" aria-label="Manage workspace">
      <RailDisclosure
        defaultOpen={railDisclosureDefaultOpen}
        icon={<ManageWorkspaceIcon className="app-user-rail-disclosure__glyph" />}
        title="Manage workspace"
      >
        <nav className="app-user-rail-sublinks" aria-label="Workspace administration">
          <RailNavLink href="/admin" title="Open Admin Hub (tenant tools, personas, portfolios)">
            Admin hub
          </RailNavLink>
        </nav>
      </RailDisclosure>
    </section>
  );
}

export function AppUserAccountPublicRail({ isGlobalAdmin, railContext }: AppUserAccountPublicRailProps) {
  return (
    <aside className="app-user-public-rail xf-widget" aria-label="Account navigation">
      <section className="app-user-rail-section app-user-rail-section--workspace" aria-label="Your workspace">
        <p className="app-user-rail-workspace-name">{railContext.userDisplayName}</p>
        {railContext.book ? (
          <div className="app-user-rail-workspace-card">
            <div className="app-user-rail-workspace-row">
              <span className="app-user-rail-workspace-k">Portfolio</span>
              <Link
                className="app-user-rail-workspace-v app-user-rail-workspace-v--link"
                href="/portfolio"
                title="Open portfolio"
              >
                {railContext.book.portfolioName}
              </Link>
            </div>
            <AppUserWorkspaceAccountPicker
              accounts={railContext.book.accounts}
              portfolioId={railContext.book.portfolioId}
              serverDefaultAccountId={railContext.book.accountId}
            />
          </div>
        ) : (
          <p className="app-user-rail-workspace-hint">
            Default portfolio isn&apos;t available yet.{" "}
            <Link className="app-user-rail-workspace-hint-link" href="/portfolio">
              Open Portfolio
            </Link>{" "}
            to sync or repair your book.
          </p>
        )}
      </section>
      <AppUserXchatRailSection />
      <AppUserFindOptionsRailSection />
      <AppUserResourcesRailSection isGlobalAdmin={isGlobalAdmin} />
      <AppUserAccountRailSection isGlobalAdmin={isGlobalAdmin} />
      {isGlobalAdmin ? <AppUserManageWorkspaceRailSection /> : null}
    </aside>
  );
}
