"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { XfColumnHeaderHint } from "@/app/ui/xf-column-header-hint";
import { buildHotPickXchatPrompt } from "@/lib/portfolio/hot-picks-xchat-prompt";
import { writePortfolioDeskXchatHandoff } from "@/lib/portfolio/portfolio-desk-xchat-handoff";
import { buildXoptionsStrategyBuilderHref } from "@/lib/xoptions/xoptions-desk-deep-link";
import type { HotPickCard } from "@/modules/portfolios/hot-picks-types";

import { HOT_PICKS_METRIC_HINTS } from "./hot-picks-metric-hints";
import { PortfoliosHotPicksSparkline } from "./portfolios-hot-picks-sparkline";

type Props = {
  pick: HotPickCard;
  portfolioId: string | null;
  showGreeks: boolean;
  showIvSkew: boolean;
  onAddToWatchlist: (symbol: string) => Promise<void>;
  onAddAlert: (symbol: string) => void;
};

function outlookBadgeClass(outlook: string): string {
  if (outlook === "bullish") {
    return "portfolios-hot-picks-card__outlook portfolios-hot-picks-card__outlook--bullish";
  }
  if (outlook === "bearish") {
    return "portfolios-hot-picks-card__outlook portfolios-hot-picks-card__outlook--bearish";
  }
  return "portfolios-hot-picks-card__outlook portfolios-hot-picks-card__outlook--neutral";
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) {
    return "—";
  }
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) {
    return "—";
  }
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function PortfoliosHotPicksCard({
  pick,
  portfolioId,
  showGreeks,
  showIvSkew,
  onAddToWatchlist,
  onAddAlert
}: Props) {
  const router = useRouter();
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const xoptionsHref = buildXoptionsStrategyBuilderHref(portfolioId, pick.symbol);
  const rationaleLines = pick.rationale.split(/(?<=\.)\s+/).slice(0, 2);

  const askInXchat = useCallback(() => {
    writePortfolioDeskXchatHandoff(buildHotPickXchatPrompt(pick));
    const q = new URLSearchParams({ rail: "xchat", item: "composer", symbol: pick.symbol });
    if (portfolioId?.trim()) {
      q.set("portfolioId", portfolioId.trim());
    }
    router.push(`/xchat?${q.toString()}`);
  }, [pick, portfolioId, router]);

  return (
    <article className="portfolios-hot-picks-card">
      <header className="portfolios-hot-picks-card__head">
        <div className="portfolios-hot-picks-card__title-block">
          <h3 className="portfolios-hot-picks-card__contract">{pick.contractLabel}</h3>
          <p className="portfolios-hot-picks-card__strategy">{pick.strategyLabel}</p>
        </div>
        <span className={outlookBadgeClass(pick.outlook)}>{pick.outlook}</span>
        <div className="portfolios-hot-picks-card__edge-block">
          <div aria-label={`Edge score ${pick.edgeScore}`} className="portfolios-hot-picks-card__edge">
            <span className="portfolios-hot-picks-card__edge-value">{pick.edgeScore}</span>
          </div>
          <XfColumnHeaderHint
            showLabel={false}
            className="portfolios-hot-picks-card__edge-hint"
            hint={HOT_PICKS_METRIC_HINTS.edgeScore}
            label="Edge score"
          />
        </div>
      </header>

      <div className="portfolios-hot-picks-card__viz">
        <PortfoliosHotPicksSparkline
          maxGainPercent={pick.maxGainPercent}
          maxLossPercent={pick.maxLossPercent}
        />
        <p className="portfolios-hot-picks-card__payoff-caption font-mono text-xs tabular-nums">
          <span className="text-[var(--xf-gain-green)]">+{formatPct(pick.maxGainPercent)}</span>
          <span className="text-[var(--xf-text-400)]"> · </span>
          <span className="text-[var(--xf-chart-loss)]">{formatPct(pick.maxLossPercent)}</span>
        </p>
      </div>

      <dl className="portfolios-hot-picks-card__metrics">
        <div>
          <dt>
            <XfColumnHeaderHint hint={HOT_PICKS_METRIC_HINTS.entry} label="Entry" />
          </dt>
          <dd className="font-mono tabular-nums">{formatUsd(pick.entry)}</dd>
        </div>
        <div>
          <dt>
            <XfColumnHeaderHint hint={HOT_PICKS_METRIC_HINTS.breakeven} label="Breakeven" />
          </dt>
          <dd className="font-mono tabular-nums">{formatUsd(pick.breakeven)}</dd>
        </div>
        <div>
          <dt>
            <XfColumnHeaderHint hint={HOT_PICKS_METRIC_HINTS.pop} label="POP" />
          </dt>
          <dd className="font-mono tabular-nums">{pick.popPercent.toFixed(0)}%</dd>
        </div>
        <div>
          <dt>
            <XfColumnHeaderHint hint={HOT_PICKS_METRIC_HINTS.estRoi} label="Est. ROI" />
          </dt>
          <dd className="font-mono tabular-nums">{formatPct(pick.estRoiPercent)}</dd>
        </div>
        <div>
          <dt>
            <XfColumnHeaderHint hint={HOT_PICKS_METRIC_HINTS.ivRank} label="IV rank" />
          </dt>
          <dd className="font-mono tabular-nums">{pick.ivRankPercent.toFixed(0)}%</dd>
        </div>
      </dl>

      {showGreeks && pick.greeks ? (
        <div className="portfolios-hot-picks-card__greeks" aria-label="Greeks">
          <span className="portfolios-hot-picks-card__pill">Δ {pick.greeks.delta.toFixed(2)}</span>
          <span className="portfolios-hot-picks-card__pill">Γ {pick.greeks.gamma.toFixed(3)}</span>
          <span className="portfolios-hot-picks-card__pill">Θ {pick.greeks.theta.toFixed(3)}</span>
          <span className="portfolios-hot-picks-card__pill">ν {pick.greeks.vega.toFixed(3)}</span>
        </div>
      ) : null}

      {showIvSkew && pick.ivSkew ? (
        <div className="portfolios-hot-picks-card__skew">
          <p className="portfolios-hot-picks-card__skew-title">
            {pick.ivSkew.putSkewLabel}
            <span className="portfolios-hot-picks-card__skew-intensity"> · {pick.ivSkew.intensity}</span>
          </p>
          <div className="portfolios-hot-picks-card__skew-bars" aria-hidden>
            {pick.ivSkew.points.map((pt) => (
              <span
                key={`${pt.strike}-${pt.ivPercent}`}
                className="portfolios-hot-picks-card__skew-bar"
                style={{ height: `${Math.min(100, Math.max(8, pt.ivPercent))}%` }}
                title={`${pt.strike} @ ${pt.ivPercent.toFixed(1)}% IV`}
              />
            ))}
          </div>
          <p className="portfolios-hot-picks-card__skew-insight">{pick.ivSkew.insight}</p>
        </div>
      ) : null}

      <div className="portfolios-hot-picks-card__rationale">
        {rationaleLines.map((line) => (
          <p key={line.slice(0, 24)}>{line}</p>
        ))}
      </div>

      <footer className="portfolios-hot-picks-card__actions">
        <Link className="portfolios-hot-picks-card__action portfolios-hot-picks-card__action--primary" href={xoptionsHref}>
          Build in xOptions
        </Link>
        <button
          className="portfolios-hot-picks-card__action portfolios-hot-picks-card__action--xchat"
          type="button"
          title="Open xChat with this Hot Pick in the composer"
          onClick={askInXchat}
        >
          Ask in xChat
        </button>
        <button
          className="portfolios-hot-picks-card__action"
          type="button"
          onClick={() => onAddAlert(pick.symbol)}
        >
          Add alert
        </button>
        <button
          className="portfolios-hot-picks-card__action"
          disabled={watchBusy}
          type="button"
          onClick={() => {
            setWatchBusy(true);
            setWatchMsg(null);
            void onAddToWatchlist(pick.symbol)
              .then(() => setWatchMsg(`Added ${pick.symbol}`))
              .catch((e: Error) => setWatchMsg(e.message))
              .finally(() => setWatchBusy(false));
          }}
        >
          Save to watchlist
        </button>
      </footer>
      {watchMsg ? <p className="portfolios-hot-picks-card__status">{watchMsg}</p> : null}
    </article>
  );
}
