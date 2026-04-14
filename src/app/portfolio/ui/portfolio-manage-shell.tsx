"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { EditIcon, ExternalLinkIcon, HomeIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { AccountHoldingsCrudCard } from "@/app/portfolio/ui/account-holdings-crud-card";
import {
    PortfolioAccountManageBar,
    type PortfolioAccountManageOption
} from "@/app/portfolio/ui/portfolio-account-manage-bar";
import {
    PortfolioAccountsSection,
    type PortfolioAccountTableRow
} from "@/app/portfolio/ui/portfolio-accounts-section";
import type { PortfolioDeskPrefetchStrip } from "@/app/portfolio/ui/portfolio-desk-prefetch";
import { PortfolioManageTabs } from "@/app/portfolio/ui/portfolio-manage-tabs";
import { PortfolioRefreshButton } from "@/app/portfolio/ui/portfolio-refresh-button";
import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import { PortfoliosWatchlistCompact } from "@/app/portfolios/portfolios-watchlist-compact";
import { PortfolioScoringFactorsReadonlyTable } from "@/app/ui/portfolio-scoring-factors-readonly";
import { WatchlistConsole } from "@/app/watchlist/ui/watchlist-console";
import { isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import { formatUsd2, formatUsdWhole, type PortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import {
    dispatchWorkspaceAccountChanged,
    writeStoredWorkspaceAccountId
} from "@/lib/workspace-account-selection";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";

export type PortfolioManageShellProps = {
  portfolioDisplayName: string;
  portfolioIdHex: string;
  admin: boolean;
  defaultAccountHex: string;
  manageOptions: PortfolioAccountManageOption[];
  rows: PortfolioAccountTableRow[];
  totalAccounts: number;
  metrics: PortfolioOverviewMetrics;
  positionsByAccount: Record<string, SerializablePosition[]>;
  scoringFactors: PortfolioScoringFactorApi[];
  deskPrefetch?: PortfolioDeskPrefetchStrip | null;
  /** Uppercased equity tickers that already have a stock lot anywhere in this portfolio (for watchlist “Add to holdings”). */
  portfolioStockSymbolsUpper: readonly string[];
};

export function PortfolioManageShell({
  portfolioDisplayName,
  portfolioIdHex,
  admin,
  defaultAccountHex,
  manageOptions,
  rows,
  totalAccounts,
  metrics,
  positionsByAccount,
  scoringFactors,
  deskPrefetch = null,
  portfolioStockSymbolsUpper
}: PortfolioManageShellProps) {
  const router = useRouter();
  const [selectedAccountHex, setSelectedAccountHex] = useState(defaultAccountHex);
  const [workspaceTab, setWorkspaceTab] = useState<
    "portfolios" | "holdings" | "activities" | "watchlist"
  >("portfolios");
  const [watchlistAsideRefreshKey, setWatchlistAsideRefreshKey] = useState(0);

  const bumpWatchlistAside = useCallback(() => {
    setWatchlistAsideRefreshKey((k) => k + 1);
  }, []);

  const setSelectedAccountHexSynced = useCallback(
    (id: string) => {
      setSelectedAccountHex(id);
      if (
        portfolioIdHex &&
        isLikelyMongoObjectIdHex(portfolioIdHex) &&
        id &&
        isLikelyMongoObjectIdHex(id)
      ) {
        writeStoredWorkspaceAccountId(portfolioIdHex, id);
        dispatchWorkspaceAccountChanged({ portfolioId: portfolioIdHex, accountId: id });
      }
    },
    [portfolioIdHex]
  );

  const resolvedSelectedHex = useMemo(() => {
    if (manageOptions.some((a) => a.id === selectedAccountHex)) return selectedAccountHex;
    return defaultAccountHex;
  }, [selectedAccountHex, defaultAccountHex, manageOptions]);

  const selectedAccountName =
    manageOptions.find((a) => a.id === resolvedSelectedHex)?.name ?? "Selected account";

  const allocationCharts = useMemo(() => {
    const classTotal = metrics.classAllocation.totalUsd > 0 ? metrics.classAllocation.totalUsd : 1;
    const pctStocks = (metrics.classAllocation.stocksUsd / classTotal) * 100;
    const pctCash = (metrics.classAllocation.cashUsd / classTotal) * 100;
    const pctOptions = (metrics.classAllocation.optionsUsd / classTotal) * 100;
    return (
      <div className="portfolio-top-band__charts-inner">
        <section className="portfolio-panel portfolio-panel--tight">
          <h3 className="portfolio-panel__title portfolio-panel__title--sub">By account</h3>
          <div className="portfolio-allocation">
            <div
              className="portfolio-allocation__bar portfolio-allocation__bar--accounts"
              role="presentation"
            >
              {metrics.allocationByAccount.map((s) => (
                <div
                  key={s.accountIdHex}
                  className="portfolio-allocation__segment"
                  style={{ flexGrow: Math.max(s.percent, 0.01) }}
                  title={`${s.label}: ${s.percent.toFixed(1)}%`}
                />
              ))}
            </div>
            <ul className="portfolio-allocation__legend portfolio-allocation__legend--plain">
              {metrics.allocationByAccount.map((s) => (
                <li key={s.accountIdHex}>
                  <span>{s.label}</span>
                  <span>{s.percent.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="portfolio-panel portfolio-panel--tight">
          <h3 className="portfolio-panel__title portfolio-panel__title--sub">By asset class</h3>
          <div className="portfolio-allocation">
            <div className="portfolio-allocation__bar" role="presentation">
              <div
                className="portfolio-allocation__segment portfolio-allocation__segment--stocks"
                style={{ flexGrow: Math.max(pctStocks, 0.01) }}
                title={`Stocks ${pctStocks.toFixed(1)}%`}
              />
              <div
                className="portfolio-allocation__segment portfolio-allocation__segment--cash"
                style={{ flexGrow: Math.max(pctCash, 0.01) }}
                title={`Cash ${pctCash.toFixed(1)}%`}
              />
              <div
                className="portfolio-allocation__segment portfolio-allocation__segment--options"
                style={{ flexGrow: Math.max(pctOptions, 0.01) }}
                title={`Options ${pctOptions.toFixed(1)}%`}
              />
            </div>
            <ul className="portfolio-allocation__legend">
              <li>
                <span>
                  <span className="portfolio-allocation__swatch portfolio-allocation__swatch--stocks" />
                  Stocks
                </span>
                <span>{formatUsdWhole(metrics.classAllocation.stocksUsd)}</span>
              </li>
              <li>
                <span>
                  <span className="portfolio-allocation__swatch portfolio-allocation__swatch--cash" />
                  Cash
                </span>
                <span>{formatUsdWhole(metrics.classAllocation.cashUsd)}</span>
              </li>
              <li>
                <span>
                  <span className="portfolio-allocation__swatch portfolio-allocation__swatch--options" />
                  Options
                </span>
                <span>{formatUsdWhole(metrics.classAllocation.optionsUsd)}</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    );
  }, [metrics]);

  const importActivitiesHref = `/import-activity?portfolioId=${encodeURIComponent(portfolioIdHex)}`;

  const activitiesPanelContent = (
    <section className="portfolio-panel portfolio-activity-placeholder" aria-labelledby="portfolio-activities-heading">
      <h2 className="portfolio-panel__title" id="portfolio-activities-heading">
        Activities
      </h2>
      <p className="portfolio-activity-placeholder__copy">
        Import broker CSV exports for <strong>{selectedAccountName}</strong> and the rest of this book. Account numbers
        in the file must match each account&apos;s external ref from Overview.
      </p>
      <div className="cta-row" style={{ marginTop: "0.75rem" }}>
        <Link className="cta cta-primary" href={importActivitiesHref}>
          Open import activities
        </Link>
        {resolvedSelectedHex ? (
          <Link className="cta cta-secondary" href={`/portfolio/accounts/${resolvedSelectedHex}`}>
            Account workspace
          </Link>
        ) : null}
      </div>
    </section>
  );

  const topBand = (
    <div className="portfolio-top-band">
      <header className="portfolio-top-band__head portfolio-manage-head portfolio-manage-head--compact xf-noise-overlay">
        <div className="portfolio-manage-head__row portfolio-manage-head__row--tight">
          <div className="portfolio-manage-head__intro">
            <p className="portfolio-hero__eyebrow">Portfolio</p>
            <h1 className="portfolio-manage-head__title portfolio-manage-head__title--compact">Your book</h1>
            <p className="portfolio-manage-head__sub portfolio-manage-head__sub--tight">
              Cost basis. <strong>Sync</strong> if your default portfolio changed.
            </p>
          </div>
          <div className="portfolio-manage-head__actions">
            <SyncDefaultPortfolioButton compact variant="secondary" className="portfolio-head-action-btn" />
            <PortfolioRefreshButton label="Refresh" className="portfolio-head-action-btn" />
          </div>
        </div>
        <div className="portfolio-manage-head__metrics portfolio-manage-head__metrics--inline">
          <div className="portfolio-manage-head__metric">
            <p className="portfolio-metric__label">Book name</p>
            <p className="portfolio-manage-head__portfolio-name">{portfolioDisplayName}</p>
          </div>
          <div className="portfolio-manage-head__metric">
            <p className="portfolio-metric__label">Book (excl. options)</p>
            <p className="portfolio-manage-head__metric-val">{formatUsdWhole(metrics.headlineBookUsd)}</p>
          </div>
          {metrics.optionLegCount > 0 ? (
            <div className="portfolio-manage-head__metric">
              <p className="portfolio-metric__label">Options (basis)</p>
              <p className="portfolio-manage-head__metric-val">{formatUsd2(metrics.optionBookValueUsd)}</p>
            </div>
          ) : null}
        </div>
        {deskPrefetch &&
        (deskPrefetch.watchlistSymbolCount > 0 ||
          deskPrefetch.activeAlertsCount > 0 ||
          deskPrefetch.ibkrLinkedAccountCount != null) ? (
          <p
            className="portfolio-manage-head__sub portfolio-manage-head__sub--tight"
            style={{ marginTop: "0.5rem", opacity: 0.85 }}
          >
            Workspace: {deskPrefetch.watchlistSymbolCount} watchlist symbol
            {deskPrefetch.watchlistSymbolCount === 1 ? "" : "s"} · {deskPrefetch.activeAlertsCount} active alert
            {deskPrefetch.activeAlertsCount === 1 ? "" : "s"}
            {deskPrefetch.ibkrLinkedAccountCount != null
              ? ` · IBKR ${deskPrefetch.ibkrLinkedAccountCount} linked account${
                  deskPrefetch.ibkrLinkedAccountCount === 1 ? "" : "s"
                }`
              : ""}
          </p>
        ) : null}
        <details className="portfolio-tech-details portfolio-tech-details--quiet">
          <summary>Scoring factors</summary>
          <pre className="portfolio-tech-details__id">ID {portfolioIdHex}</pre>
          <PortfolioScoringFactorsReadonlyTable factors={scoringFactors} variant="full" />
        </details>
      </header>

      <aside className="portfolio-top-band__charts xf-noise-overlay" aria-label="Allocations">
        {allocationCharts}
      </aside>
    </div>
  );

  const overviewPanel = (
    <>
      <PortfolioAccountsSection
        portfolioIdHex={portfolioIdHex}
        selectedAccountHex={resolvedSelectedHex}
        onSelectedAccountHexChange={setSelectedAccountHexSynced}
        manageOptions={manageOptions}
        rows={rows}
        totalAccounts={totalAccounts}
      />

      <nav className="portfolio-footer-nav" aria-label="Shortcuts">
        <Link className="portfolio-footer-nav__link" href="/">
          <HomeIcon className="crud-icon" aria-hidden />
          Home
        </Link>
        {resolvedSelectedHex ? (
          <Link className="portfolio-footer-nav__link" href={`/portfolio/accounts/${resolvedSelectedHex}`}>
            <EditIcon className="crud-icon" aria-hidden />
            Selected account
          </Link>
        ) : null}
        {admin ? (
          <Link className="portfolio-footer-nav__link portfolio-footer-nav__link--emph" href="/admin/portfolios">
            <ExternalLinkIcon className="crud-icon" aria-hidden />
            Hub
          </Link>
        ) : null}
      </nav>
    </>
  );

  const initialForSelected = positionsByAccount[resolvedSelectedHex] ?? [];

  const holdingsPanel = (
    <div className="stack-gap" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {resolvedSelectedHex ? (
        <AccountHoldingsCrudCard
          key={resolvedSelectedHex}
          accountIdHex={resolvedSelectedHex}
          embeddedInTab
          initialPositions={initialForSelected}
          portfolioIdHex={portfolioIdHex}
        />
      ) : (
        <p className="status-text">Select an account using the Account selector to add or edit holdings.</p>
      )}
    </div>
  );

  const watchlistPanel = (
    <WatchlistConsole
      addToHoldingsAccountIdHex={resolvedSelectedHex}
      isAdmin={admin}
      portfolioId={portfolioIdHex}
      portfolioStockSymbolsUpper={portfolioStockSymbolsUpper}
      variant="embedded"
      onBookMutated={() => router.refresh()}
      onWatchlistMutated={bumpWatchlistAside}
    />
  );

  return (
    <div className="portfolio-overview">
      <div className="portfolio-overview__grid">
        <div className="portfolio-overview__main" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {topBand}
          <PortfolioAccountManageBar
            accounts={manageOptions}
            portfolioIdHex={portfolioIdHex}
            selectedAccountId={resolvedSelectedHex}
            onSelectedAccountIdChange={setSelectedAccountHexSynced}
          />
          <PortfolioManageTabs
            activeTab={workspaceTab}
            activitiesPanel={activitiesPanelContent}
            holdingsPanel={holdingsPanel}
            onTabChange={setWorkspaceTab}
            portfoliosPanel={overviewPanel}
            watchlistPanel={watchlistPanel}
          />
        </div>
        <aside className="portfolio-overview__aside">
          <PortfoliosWatchlistCompact
            deskHints={deskPrefetch}
            portfolioId={portfolioIdHex}
            refreshKey={watchlistAsideRefreshKey}
            onOpenFullWatchlist={() => setWorkspaceTab("watchlist")}
          />
        </aside>
      </div>
    </div>
  );
}
