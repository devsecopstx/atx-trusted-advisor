"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { fetchHotPicks } from "@/lib/react-query/hot-picks-api";
import { hotPicksQueryKeys } from "@/lib/react-query/query-keys";
import type { HotPicksBias, HotPicksScope } from "@/modules/portfolios/hot-picks-types";

import { PortfoliosHotPicksCard } from "./portfolios-hot-picks-card";

type Props = {
  portfolioId: string | null;
  defaultPortfolioId: string | null;
};

const BIAS_OPTIONS: Array<{ id: HotPicksBias; label: string }> = [
  { id: "conservative", label: "Conservative" },
  { id: "balanced", label: "Balanced" },
  { id: "aggressive", label: "Aggressive" }
];

const SCOPE_OPTIONS: Array<{ id: HotPicksScope; label: string }> = [
  { id: "portfolio", label: "Portfolio-linked" },
  { id: "watchlist", label: "Watchlist" },
  { id: "market", label: "All market" }
];

export function PortfoliosHotPicksView({ portfolioId, defaultPortfolioId }: Props) {
  const [bias, setBias] = useState<HotPicksBias>("balanced");
  const [scope, setScope] = useState<HotPicksScope>("portfolio");
  const [minEdgeScore, setMinEdgeScore] = useState(60);
  const [showGreeks, setShowGreeks] = useState(false);
  const [showIvSkew, setShowIvSkew] = useState(false);

  const effectivePortfolioId = scope === "portfolio" ? portfolioId ?? defaultPortfolioId : null;

  const queryKey = useMemo(
    () =>
      hotPicksQueryKeys.list({
        scope,
        bias,
        portfolioId: effectivePortfolioId,
        minEdgeScore
      }),
    [scope, bias, effectivePortfolioId, minEdgeScore]
  );

  const hotQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchHotPicks({
        scope,
        bias,
        portfolioId: effectivePortfolioId,
        minEdgeScore,
        maxEdgeScore: 90,
        showGreeks,
        showIvSkew
      }),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const refresh = useCallback(() => {
    void hotQuery.refetch();
  }, [hotQuery]);

  const picks = hotQuery.data?.picks ?? [];
  const meta = hotQuery.data?.meta;

  const alertsHref =
    effectivePortfolioId != null
      ? `/portfolio/alerts?portfolioId=${encodeURIComponent(effectivePortfolioId)}`
      : "/portfolio/alerts";

  const addToWatchlist = async (symbol: string) => {
    const pid = effectivePortfolioId ?? defaultPortfolioId;
    if (!pid) {
      throw new Error("Select a portfolio first");
    }
    const res = await fetch(`/api/portfolios/${encodeURIComponent(pid)}/watchlist`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addSymbols: [symbol] })
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Could not update watchlist");
    }
  };

  const onAddAlert = (symbol: string) => {
    const q = new URLSearchParams({ symbol });
    if (effectivePortfolioId) {
      q.set("portfolioId", effectivePortfolioId);
    }
    window.location.href = `${alertsHref}?${q.toString()}`;
  };

  return (
    <div className="portfolios-hot-picks">
      <header className="portfolios-hot-picks__header">
        <div>
          <h1 className="portfolios-hot-picks__title">Hot Picks · Next 7–21 DTE</h1>
          <p className="portfolios-hot-picks__sub">
            Conservative-first income structures with POP and edge-score filters. Not financial advice.
          </p>
        </div>
        <button
          className="portfolios-hot-picks__refresh"
          disabled={hotQuery.isFetching}
          type="button"
          onClick={refresh}
        >
          {hotQuery.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="portfolios-hot-picks__toolbar" role="region" aria-label="Hot picks filters">
        <div className="portfolios-hot-picks__seg-group" role="group" aria-label="Risk bias">
          {BIAS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              aria-pressed={bias === opt.id}
              className={`portfolios-hot-picks__seg${bias === opt.id ? " portfolios-hot-picks__seg--active" : ""}`}
              type="button"
              onClick={() => setBias(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="portfolios-hot-picks__seg-group" role="group" aria-label="Symbol universe">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              aria-pressed={scope === opt.id}
              className={`portfolios-hot-picks__seg${scope === opt.id ? " portfolios-hot-picks__seg--active" : ""}`}
              type="button"
              onClick={() => setScope(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="portfolios-hot-picks__edge">
          <span>Edge score ≥ {minEdgeScore}</span>
          <input
            aria-label="Minimum edge score"
            max={90}
            min={60}
            step={5}
            type="range"
            value={minEdgeScore}
            onChange={(e) => setMinEdgeScore(Number(e.target.value))}
          />
        </label>
        <div className="portfolios-hot-picks__toggles">
          <button
            aria-pressed={showGreeks}
            className={`portfolios-hot-picks__seg${showGreeks ? " portfolios-hot-picks__seg--active" : ""}`}
            type="button"
            onClick={() => setShowGreeks((v) => !v)}
          >
            Greeks
          </button>
          <button
            aria-pressed={showIvSkew}
            className={`portfolios-hot-picks__seg${showIvSkew ? " portfolios-hot-picks__seg--active" : ""}`}
            type="button"
            onClick={() => setShowIvSkew((v) => !v)}
          >
            IV skew
          </button>
        </div>
      </div>

      {hotQuery.isError ? (
        <p className="portfolios-hot-picks__error" role="alert">
          {(hotQuery.error as Error).message}
        </p>
      ) : null}

      {meta ? (
        <p className="portfolios-hot-picks__meta text-xs text-[var(--xf-text-400)]">
          {picks.length} pick{picks.length === 1 ? "" : "s"} · {meta.symbolCount} symbols scanned
          {meta.cacheHit ? " · cached" : ""}
          {meta.cachedAt ? ` · ${new Date(meta.cachedAt).toLocaleTimeString()}` : ""}
        </p>
      ) : null}

      {hotQuery.isLoading ? (
        <p className="portfolios-hot-picks__loading">Scanning forward expirations…</p>
      ) : picks.length === 0 ? (
        <div className="portfolios-hot-picks__empty">
          <p>No structures met your filters for this universe. Try Balanced bias, lower edge floor, or Watchlist scope.</p>
          <Link className="portfolios-hot-picks__link" href="/watchlist">
            Open watchlist
          </Link>
        </div>
      ) : (
        <div className="portfolios-hot-picks__grid">
          {picks.map((pick) => (
            <PortfoliosHotPicksCard
              key={pick.id}
              pick={pick}
              portfolioId={effectivePortfolioId}
              showGreeks={showGreeks}
              showIvSkew={showIvSkew}
              onAddAlert={onAddAlert}
              onAddToWatchlist={addToWatchlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
