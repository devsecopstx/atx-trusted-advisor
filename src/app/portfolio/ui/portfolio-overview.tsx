import Link from "next/link";

import { EditIcon, ExternalLinkIcon, HomeIcon } from "@/app/admin/ui/crud-icons";
import { buildPortfolioAccountTableRows } from "@/app/portfolio/ui/build-portfolio-account-table-rows";
import { PortfolioAccountsSection } from "@/app/portfolio/ui/portfolio-accounts-section";
import { PortfolioHoldingsPanel } from "@/app/portfolio/ui/portfolio-holdings-panel";
import { PortfolioManageTabs } from "@/app/portfolio/ui/portfolio-manage-tabs";
import { PortfolioRefreshButton } from "@/app/portfolio/ui/portfolio-refresh-button";
import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import { PortfolioScoringFactorsReadonlyTable } from "@/app/ui/portfolio-scoring-factors-readonly";
import type { PortfolioHoldingRow } from "@/lib/portfolio-holding-rows";
import { formatUsd2, formatUsdWhole, type PortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";
import type { Account } from "@/modules/core-admin/types";

type PortfolioOverviewProps = {
  portfolioDisplayName: string;
  portfolioIdHex: string;
  accounts: Account[];
  metrics: PortfolioOverviewMetrics;
  admin: boolean;
  holdingsRows: PortfolioHoldingRow[];
  scoringFactors: PortfolioScoringFactorApi[];
};

export function PortfolioOverview({
  portfolioDisplayName,
  portfolioIdHex,
  accounts,
  metrics,
  admin,
  holdingsRows,
  scoringFactors
}: PortfolioOverviewProps) {
  const defaultAccountHex =
    metrics.byAccount.find((r) => r.isDefault)?.accountIdHex ?? metrics.byAccount[0]?.accountIdHex ?? "";

  const classTotal = metrics.classAllocation.totalUsd > 0 ? metrics.classAllocation.totalUsd : 1;
  const pctStocks = (metrics.classAllocation.stocksUsd / classTotal) * 100;
  const pctCash = (metrics.classAllocation.cashUsd / classTotal) * 100;
  const pctOptions = (metrics.classAllocation.optionsUsd / classTotal) * 100;

  const accountManageOptions = accounts
    .filter((account): account is Account & { _id: NonNullable<Account["_id"]> } => Boolean(account._id))
    .map((account) => ({
      id: account._id.toHexString(),
      name: account.name,
      isDefault: Boolean(account.isDefault)
    }));

  const tableRows = buildPortfolioAccountTableRows(accounts, metrics);

  const allocationCharts = (
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

  const activityPanel = (
    <section className="portfolio-panel portfolio-activity-placeholder" aria-labelledby="portfolio-activity-heading">
      <h2 className="portfolio-panel__title" id="portfolio-activity-heading">
        Activity
      </h2>
      <p className="portfolio-activity-placeholder__copy">
        Trades and alerts will show here when activity tracking is available.
      </p>
    </section>
  );

  const portfoliosPanel = (
    <>
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

      <PortfolioAccountsSection
        portfolioIdHex={portfolioIdHex}
        defaultAccountHex={defaultAccountHex}
        manageOptions={accountManageOptions}
        rows={tableRows}
        totalAccounts={accounts.length}
      />

      <nav className="portfolio-footer-nav" aria-label="Shortcuts">
        <Link className="portfolio-footer-nav__link" href="/">
          <HomeIcon className="crud-icon" aria-hidden />
          Home
        </Link>
        {defaultAccountHex ? (
          <Link className="portfolio-footer-nav__link" href={`/portfolio/accounts/${defaultAccountHex}`}>
            <EditIcon className="crud-icon" aria-hidden />
            Default account
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

  return (
    <div className="portfolio-overview">
      <PortfolioManageTabs
        activityPanel={activityPanel}
        holdingsPanel={<PortfolioHoldingsPanel rows={holdingsRows} />}
        portfoliosPanel={portfoliosPanel}
      />
    </div>
  );
}
