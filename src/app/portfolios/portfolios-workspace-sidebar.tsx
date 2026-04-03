"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type SVGProps } from "react";

import { RailDisclosure } from "@/app/ui/app-user-rail-nav";

function sublinkActive(pathname: string, href: string): boolean {
  if (!href.startsWith("/") || href.includes("#")) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  href,
  children,
  title
}: {
  href: string;
  children: ReactNode;
  title?: string;
}) {
  const pathname = usePathname() ?? "";
  const active = sublinkActive(pathname, href);
  const cls = `portfolios-workspace-sidebar__link${active ? " portfolios-workspace-sidebar__link--active" : ""}`;
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

function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M4 19h16M7 16l3-6 4 3 5-8"
        stroke="currentColor"
        strokeLinecap="round"
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

type Props = {
  defaultPortfolioId: string | null;
  topSymbol: string | null;
};

export function PortfoliosWorkspaceSidebar({ defaultPortfolioId, topSymbol }: Props) {
  const chainHref =
    topSymbol !== null
      ? `/xoptions/full-chain?symbol=${encodeURIComponent(topSymbol)}`
      : "/xoptions/full-chain";

  return (
    <nav className="portfolios-workspace-sidebar" aria-label="Portfolio workspace">
      <SidebarLink href="/portfolios" title="Books overview">
        <GridIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Portfolios</span>
      </SidebarLink>
      <SidebarLink href="/portfolio" title="Accounts and positions">
        <WalletIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Accounts</span>
      </SidebarLink>
      <SidebarLink href="/xoptions" title="Options strategy builder">
        <OptionsGlyph className="portfolios-workspace-sidebar__glyph portfolios-workspace-sidebar__glyph--emph" />
        <span className="portfolios-workspace-sidebar__emph">Options strategies</span>
      </SidebarLink>
      <SidebarLink href="/portfolios#portfolios-watchlist" title="Watchlist table on this page">
        <StarIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Watchlist</span>
      </SidebarLink>
      <SidebarLink href={chainHref} title="Chains, IV and open interest">
        <ActivityIcon className="portfolios-workspace-sidebar__glyph" />
        <span>Holdings &amp; options</span>
      </SidebarLink>

      <div className="portfolios-workspace-sidebar__disclosure-wrap">
        <RailDisclosure
          defaultOpen={false}
          icon={<ActivityIcon className="app-user-rail-disclosure__glyph" />}
          title="Markets & news"
        >
          <div className="portfolios-workspace-sidebar__pulse-host">
            <MarketsNewsMiniClient />
          </div>
        </RailDisclosure>
      </div>

      <div className="portfolios-workspace-sidebar__spacer" />

      <SidebarLink
        href={
          defaultPortfolioId
            ? `/import-activity?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
            : "/import-activity"
        }
        title="Merrill / Fidelity CSV import"
      >
        <UploadGlyph className="portfolios-workspace-sidebar__glyph" />
        <span>Broker import</span>
      </SidebarLink>
    </nav>
  );
}

function MarketsNewsMiniClient() {
  const [lines, setLines] = useState<{ title: string; link: string }[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      try {
        const res = await fetch("/api/market/workspace-pulse", { credentials: "include" });
        const body = (await res.json()) as {
          data?: { news?: { title: string; link: string }[] };
        };
        const news = body.data?.news ?? [];
        if (!cancelled) {
          setLines(news.slice(0, 4).map((n) => ({ title: n.title, link: n.link })));
        }
      } catch {
        if (!cancelled) {
          setLines([]);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (busy && lines.length === 0) {
    return <p className="portfolios-workspace-sidebar__mini-muted">Loading…</p>;
  }
  if (lines.length === 0) {
    return <p className="portfolios-workspace-sidebar__mini-muted">No headlines.</p>;
  }
  return (
    <ul className="portfolios-workspace-sidebar__news-list">
      {lines.map((n) => (
        <li key={n.link}>
          <a href={n.link} rel="noopener noreferrer" target="_blank">
            {n.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
