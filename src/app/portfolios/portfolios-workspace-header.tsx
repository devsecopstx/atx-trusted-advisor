"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PortfoliosMacroTape, type MacroTapeIndex } from "@/app/portfolios/portfolios-macro-tape";
import { PortfoliosMacroTapeWellness } from "@/app/portfolios/portfolios-macro-tape-wellness";
import { PortfoliosBooksDayMarkUI } from "@/app/portfolios/portfolios-workspace-books-day-mark";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceBooksDayMarkSummary } from "@/lib/workspace-dashboard-metrics";
import type { MarketDayContext } from "@/modules/scanner/us-market-day-context";
import { resolveUsMarketDayContext, usMarketSessionStatusLabel } from "@/modules/scanner/us-market-day-context";

type PulseIndex = { symbol: string; price?: number; changePercent?: number };

type Props = {
  totalBookUsd: number;
  topHoldingsKey: string;
  visiblePathPrefixes?: string[];
  deskPortfolioId?: string | null;
  booksDayMark: WorkspaceBooksDayMarkSummary;
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
  topHoldingsKey,
  visiblePathPrefixes,
  deskPortfolioId = null,
  booksDayMark
}: Props) {
  const [indices, setIndices] = useState<PulseIndex[]>([]);
  const [market, setMarket] = useState<MarketDayContext>(() => resolveUsMarketDayContext(new Date()));
  const [loading, setLoading] = useState(true);

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
  const sessionTapeActive = market.marketWindowOpen && sessionStatus.label === "Open";

  const macroTapeIndices: MacroTapeIndex[] = useMemo(
    () => indices.map((i) => ({ symbol: i.symbol, price: i.price, changePercent: i.changePercent })),
    [indices]
  );

  const showLiveTape = sessionTapeActive && macroTapeIndices.length > 0;
  const showWellnessTape = !sessionTapeActive;

  return (
    <header
      className={`portfolios-workspace-header xchat-header${showLiveTape || showWellnessTape ? " portfolios-workspace-header--tape" : ""}`}
    >
      <div className="portfolios-workspace-header__primary-row">
        <div className="xchat-header-leading min-w-0">
          <Link
            className="portfolios-workspace-header__crumb"
            href="/portfolios"
            title="Portfolios workspace"
          >
            Books overview
          </Link>
        </div>

        <div className="portfolios-workspace-header__center">
          <XfHoverHint hint="Total book: cash plus position cost basis across all portfolios (not live marks). Portfolio day Δ: stock leaf day P&amp;L from Yahoo (Σ qty × change on quoted symbols, largest books first, capped); excludes options, cash, and unquoted tickers.">
            <div className="portfolios-workspace-header__total-block">
              <p className="portfolios-workspace-header__total-label">Total book value</p>
              <p className="portfolios-workspace-header__total-value font-mono tabular-nums">
                {formatUsdWhole(totalBookUsd)}
              </p>
              <p className="portfolios-workspace-header__total-delta">
                <PortfoliosBooksDayMarkUI summary={booksDayMark} variant="header" />
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
                          ? "text-[var(--xf-chart-loss)]"
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
        </div>
      </div>

      {showLiveTape ? (
        <PortfoliosMacroTape
          deskPortfolioId={deskPortfolioId}
          indices={macroTapeIndices}
          visiblePathPrefixes={visiblePathPrefixes}
        />
      ) : showWellnessTape ? (
        <PortfoliosMacroTapeWellness
          deskPortfolioId={deskPortfolioId}
          visiblePathPrefixes={visiblePathPrefixes}
        />
      ) : null}
    </header>
  );
}
