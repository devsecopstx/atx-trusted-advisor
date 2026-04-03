"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { UploadIcon } from "@/app/admin/ui/crud-icons";
import { AppUserHeaderSession } from "@/app/ui/app_user-header-session";
import { AtxFinanceMark, LightningBolt } from "@/app/ui/atxfinance-logo";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { MarketDayContext } from "@/modules/scanner/us-market-day-context";
import { resolveUsMarketDayContext, usMarketSessionStatusLabel } from "@/modules/scanner/us-market-day-context";

export type PortfoliosWorkspaceHeaderSession = {
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  xUserId: string;
  mongoConnection: string;
};

type PulseIndex = { symbol: string; price?: number; changePercent?: number };

type Props = {
  totalBookUsd: number;
  defaultPortfolioId: string | null;
  topHoldingsKey: string;
  session: PortfoliosWorkspaceHeaderSession;
};

function formatChgPct(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) {
    return "—";
  }
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

export function PortfoliosWorkspaceHeader({
  totalBookUsd,
  defaultPortfolioId,
  topHoldingsKey,
  session
}: Props) {
  const [indices, setIndices] = useState<PulseIndex[]>([]);
  const [market, setMarket] = useState<MarketDayContext>(() => resolveUsMarketDayContext(new Date()));
  const [loading, setLoading] = useState(true);

  const importHref = defaultPortfolioId
    ? `/import-activity?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
    : "/import-activity";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = topHoldingsKey ? `?holdings=${encodeURIComponent(topHoldingsKey)}` : "";
        const res = await fetch(`/api/market/workspace-pulse${qs}`, { credentials: "include" });
        const body = (await res.json()) as {
          data?: { indices?: PulseIndex[]; market?: MarketDayContext };
        };
        if (!cancelled) {
          if (body.data?.indices) {
            setIndices(body.data.indices);
          }
          setMarket(body.data?.market ?? resolveUsMarketDayContext(new Date()));
        }
      } catch {
        if (!cancelled) {
          setIndices([]);
          setMarket(resolveUsMarketDayContext(new Date()));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    const t = setInterval(() => void load(), 180_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [topHoldingsKey]);

  const spy = useMemo(() => indices.find((i) => i.symbol === "SPY") ?? indices[0], [indices]);
  const sessionStatus = useMemo(() => usMarketSessionStatusLabel(market), [market]);

  return (
    <header className="portfolios-workspace-header xchat-header">
      <Link className="portfolios-workspace-header__brand xchat-header-brand" href="/portfolios">
        <span className="xf-logo-lockup-inline xf-logo-lockup-inline--header-single">
          <span className="xf-logo-row xf-logo-row--header-single">
            <AtxFinanceMark size={22} />
            <LightningBolt size={16} />
            <span className="xf-logo-text xf-logo-text--sm xf-logo-title-phrase portfolios-workspace-header__title">
              Portfolio Workspace
            </span>
          </span>
        </span>
      </Link>

      <div className="portfolios-workspace-header__center">
        <XfHoverHint hint="Book total: cash plus position cost basis across all portfolios. Not live marks; no portfolio day P&amp;L.">
          <div className="portfolios-workspace-header__total-block">
            <p className="portfolios-workspace-header__total-label">Total book value</p>
            <p className="portfolios-workspace-header__total-value font-mono tabular-nums">
              {formatUsdWhole(totalBookUsd)}
            </p>
            <p className="portfolios-workspace-header__total-delta">
              <span className="text-[var(--xf-text-300)]">Portfolio day Δ </span>
              <span className="text-[var(--xf-text-300)]">—</span>
            </p>
          </div>
        </XfHoverHint>
      </div>

      <div className="portfolios-workspace-header__trailing xchat-header-trailing">
        <div
          className="portfolios-workspace-header__market-cluster flex flex-wrap items-center gap-2"
          aria-live="polite"
          aria-busy={loading}
        >
          <XfHoverHint hint={`${market.marketDate} · ${market.timezone} · ${sessionStatus.detail}`}>
            <span
              className={
                sessionStatus.label === "Open"
                  ? "portfolios-workspace-header__market-status portfolios-workspace-header__market-status--open"
                  : "portfolios-workspace-header__market-status"
              }
            >
              {sessionStatus.label}
            </span>
          </XfHoverHint>
          <span className="portfolios-workspace-header__market-pill font-mono tabular-nums">
            {spy ? (
              <>
                <span className="text-[var(--xf-text-100)]">{spy.symbol}</span>{" "}
                {spy.price !== undefined && Number.isFinite(spy.price) ? (
                  <span className="text-[var(--xf-text-200)]">
                    {spy.price.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 2
                    })}
                  </span>
                ) : (
                  <span className="text-[var(--xf-text-300)]">—</span>
                )}{" "}
                <span
                  className={
                    (spy.changePercent ?? 0) > 0
                      ? "text-[var(--xf-gain-green)]"
                      : (spy.changePercent ?? 0) < 0
                        ? "text-red-300"
                        : "text-[var(--xf-text-300)]"
                  }
                >
                  {spy.changePercent !== undefined && spy.changePercent > 0 ? "▲ " : ""}
                  {spy.changePercent !== undefined && spy.changePercent < 0 ? "▼ " : ""}
                  {formatChgPct(spy.changePercent)}
                </span>
              </>
            ) : (
              <span className="text-[var(--xf-text-300)]">Markets —</span>
            )}
          </span>
        </div>

        <Link
          className="portfolios-workspace-header__import-btn xchat-header-cta"
          href={importHref}
        >
          <UploadIcon className="crud-icon h-4 w-4 shrink-0" aria-hidden />
          Import CSV
        </Link>

        <span aria-hidden className="xchat-header-divider" />

        <AppUserHeaderSession
          avatarUrl={session.avatarUrl}
          displayName={session.displayName}
          email={session.email}
          feedbackPageLabel="Portfolio workspace"
          mongoConnection={session.mongoConnection}
          username={session.username}
          xUserId={session.xUserId}
        />
      </div>
    </header>
  );
}
