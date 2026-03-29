import Link from "next/link";

import { EditIcon, ExternalLinkIcon, HomeIcon } from "@/app/admin/ui/crud-icons";
import { PortfolioAccountManageBar } from "@/app/portfolio/ui/portfolio-account-manage-bar";
import { PortfolioAccountsExportButton, type PortfolioAccountCsvRow } from "@/app/portfolio/ui/portfolio-accounts-export-button";
import { PortfolioHoldingsPanel } from "@/app/portfolio/ui/portfolio-holdings-panel";
import { PortfolioManageTabs } from "@/app/portfolio/ui/portfolio-manage-tabs";
import { PortfolioPositionQuickAdd } from "@/app/portfolio/ui/portfolio-position-quick-add";
import { PortfolioRefreshButton } from "@/app/portfolio/ui/portfolio-refresh-button";
import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import { IconEditLink } from "@/app/ui/icon-edit-control";
import { PortfolioScoringFactorsReadonlyTable } from "@/app/ui/portfolio-scoring-factors-readonly";
import type { PortfolioHoldingRow } from "@/lib/portfolio-holding-rows";
import {
    formatUsd2,
    formatUsdWhole,
    type PortfolioOverviewMetrics
} from "@/lib/portfolio-overview-metrics";
import {
    INVESTMENT_STRATEGY_OPTIONS,
    RISK_LEVEL_OPTIONS
} from "@/modules/core-admin/portfolio-preference-labels";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";
import type { Account } from "@/modules/core-admin/types";

type QuickAcct = {
  id: string;
  name: string;
  brokerType: string;
};

type PortfolioOverviewProps = {
  portfolioDisplayName: string;
  portfolioIdHex: string;
  accounts: Account[];
  metrics: PortfolioOverviewMetrics;
  admin: boolean;
  quickAddAccounts: QuickAcct[];
  holdingsRows: PortfolioHoldingRow[];
  scoringFactors: PortfolioScoringFactorApi[];
};

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function accountByHex(accounts: Account[], hex: string): Account | undefined {
  return accounts.find((a) => a._id?.toHexString() === hex);
}

function riskDotClass(account: Account | undefined): string {
  const rp = account?.riskProfile;
  if (rp === "conservative") return "portfolio-risk-dot portfolio-risk-dot--low";
  if (rp === "balanced") return "portfolio-risk-dot portfolio-risk-dot--medium";
  if (rp === "growth") return "portfolio-risk-dot portfolio-risk-dot--high";
  return "portfolio-risk-dot portfolio-risk-dot--unset";
}

function strategyPillClass(outlook: Account["outlook"]): string {
  const v = outlook ?? "";
  if (v === "growth") return "portfolio-strategy-pill portfolio-strategy-pill--growth";
  if (v === "income") return "portfolio-strategy-pill portfolio-strategy-pill--income";
  if (v === "balanced") return "portfolio-strategy-pill portfolio-strategy-pill--balanced";
  if (v === "aggressive") return "portfolio-strategy-pill portfolio-strategy-pill--aggressive";
  return "portfolio-strategy-pill portfolio-strategy-pill--none";
}

export function PortfolioOverview({
  portfolioDisplayName,
  portfolioIdHex,
  accounts,
  metrics,
  admin,
  quickAddAccounts,
  holdingsRows,
  scoringFactors
}: PortfolioOverviewProps) {
  const defaultAccountHex =
    metrics.byAccount.find((r) => r.isDefault)?.accountIdHex ?? metrics.byAccount[0]?.accountIdHex ?? "";

  const classTotal = metrics.classAllocation.totalUsd > 0 ? metrics.classAllocation.totalUsd : 1;
  const pctStocks = (metrics.classAllocation.stocksUsd / classTotal) * 100;
  const pctCash = (metrics.classAllocation.cashUsd / classTotal) * 100;
  const pctOptions = (metrics.classAllocation.optionsUsd / classTotal) * 100;

  const csvRows: PortfolioAccountCsvRow[] = metrics.byAccount.map((row) => {
    const acct = accountByHex(accounts, row.accountIdHex);
    const riskLabel =
      acct?.riskProfile != null
        ? (RISK_LEVEL_OPTIONS.find((r) => r.riskProfile === acct.riskProfile)?.label ?? "")
        : "";
    const outlookTitle =
      acct?.outlook != null
        ? (INVESTMENT_STRATEGY_OPTIONS.find((o) => o.value === acct.outlook)?.title ?? "")
        : "";
    const costBasis = row.valueExcludingOptions + row.optionBookValue;
    return {
      account: row.name,
      broker: formatBrokerType(row.brokerType),
      accountRef: row.extAccountId || "—",
      positions: row.positionRowCount,
      costBasisUsd: costBasis,
      marketValue: "— (live quotes not shown)",
      dayChange: "—",
      pl: "—",
      risk: riskLabel || "—",
      outlook: outlookTitle || "—"
    };
  });

  const accountManageOptions = accounts
    .filter((account): account is Account & { _id: NonNullable<Account["_id"]> } => Boolean(account._id))
    .map((account) => ({
      id: account._id.toHexString(),
      name: account.name,
      isDefault: Boolean(account.isDefault)
    }));

  const activityPanel = (
    <section className="portfolio-panel portfolio-activity-placeholder" aria-labelledby="portfolio-activity-heading">
      <h2 className="portfolio-panel__title" id="portfolio-activity-heading">
        My activity
      </h2>
      <p className="portfolio-activity-placeholder__copy">
        Trades, syncs, and alerts will show here when activity tracking ships. For now, use{" "}
        <strong>Refresh</strong> on the portfolios tab to reload book values.
      </p>
    </section>
  );

  const portfoliosPanel = (
    <>
      <header className="portfolio-manage-head xf-noise-overlay">
        <div className="portfolio-manage-head__row">
          <div>
            <p className="portfolio-hero__eyebrow">Portfolio</p>
            <h1 className="portfolio-manage-head__title">My accounts</h1>
            <p className="portfolio-manage-head__sub">
              Manage linked custodian accounts, risk, and outlook. Values are <strong>cost basis</strong> unless noted;
              live market marks are not shown yet.
            </p>
          </div>
          <div className="portfolio-manage-head__actions">
            <SyncDefaultPortfolioButton compact variant="secondary" className="portfolio-head-action-btn" />
            <PortfolioRefreshButton label="Refresh" className="portfolio-head-action-btn" />
          </div>
        </div>
        <div className="portfolio-manage-head__metrics">
          <div>
            <p className="portfolio-metric__label">Portfolio</p>
            <p className="portfolio-manage-head__portfolio-name">{portfolioDisplayName}</p>
          </div>
          <div>
            <p className="portfolio-metric__label">Book value (excl. options)</p>
            <p className="portfolio-manage-head__metric-val">{formatUsdWhole(metrics.headlineBookUsd)}</p>
          </div>
          {metrics.optionLegCount > 0 ? (
            <div>
              <p className="portfolio-metric__label">Options (premium basis)</p>
              <p className="portfolio-manage-head__metric-val">{formatUsd2(metrics.optionBookValueUsd)}</p>
            </div>
          ) : null}
        </div>
        <details className="portfolio-tech-details">
          <summary>SE Scoring Factors</summary>
          <pre>Portfolio ID: {portfolioIdHex}</pre>
          <PortfolioScoringFactorsReadonlyTable factors={scoringFactors} variant="full" />
        </details>
      </header>

      <div className="portfolio-overview__grid">
        <div className="portfolio-overview__main">
          <div className="portfolio-manage-table-card portfolio-panel">
            <div className="portfolio-manage-table-card__bar">
              <h2 className="portfolio-panel__title portfolio-manage-table-card__title" id="accounts-table-heading">
                Accounts
              </h2>
              <PortfolioAccountsExportButton rows={csvRows} filename="xfinance-accounts.csv" />
            </div>
            <PortfolioAccountManageBar accounts={accountManageOptions} />
            <div className="portfolio-table-wrap">
              <table className="portfolio-manage-table" aria-labelledby="accounts-table-heading">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Broker / ref</th>
                    <th scope="col">Positions</th>
                    <th scope="col">Cost basis</th>
                    <th scope="col">Market value</th>
                    <th scope="col">Day change</th>
                    <th scope="col">P&amp;L</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byAccount.map((row) => {
                    const acct = accountByHex(accounts, row.accountIdHex);
                    const riskLabel =
                      acct?.riskProfile != null
                        ? RISK_LEVEL_OPTIONS.find((r) => r.riskProfile === acct.riskProfile)?.label
                        : null;
                    const outlookTitle =
                      acct?.outlook != null
                        ? INVESTMENT_STRATEGY_OPTIONS.find((o) => o.value === acct.outlook)?.title
                        : null;
                    const costBasis = row.valueExcludingOptions + row.optionBookValue;
                    const posLabel =
                      row.positionRowCount +
                      (row.optionLegCount > 0
                        ? ` (${row.optionLegCount} opt. leg${row.optionLegCount === 1 ? "" : "s"})`
                        : "");
                    return (
                      <tr key={row.accountIdHex}>
                        <td>
                          <div className="portfolio-manage-table__account-cell">
                            <span className={riskDotClass(acct)} title={riskLabel ?? "Risk not set"} aria-hidden />
                            <div>
                              <div className="portfolio-manage-table__account-name">
                                {row.name}
                                {row.isDefault ? (
                                  <span className="portfolio-account-card__badge">Default</span>
                                ) : null}
                              </div>
                              {riskLabel ? (
                                <div className="portfolio-manage-table__account-meta">{riskLabel} risk</div>
                              ) : (
                                <div className="portfolio-manage-table__account-meta">Risk not set</div>
                              )}
                              {outlookTitle ? (
                                <span className={strategyPillClass(acct?.outlook ?? null)}>{outlookTitle}</span>
                              ) : (
                                <span className={strategyPillClass(null)}>Outlook not set</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="portfolio-manage-table__mono">
                          {formatBrokerType(row.brokerType)}
                          <div className="portfolio-manage-table__ref">{row.extAccountId || "—"}</div>
                        </td>
                        <td className="portfolio-manage-table__num">{posLabel}</td>
                        <td className="portfolio-manage-table__num portfolio-manage-table__emph">
                          {formatUsdWhole(costBasis)}
                        </td>
                        <td className="portfolio-manage-table__muted" title="Live quotes not wired in this view">
                          —
                        </td>
                        <td className="portfolio-manage-table__muted">—</td>
                        <td className="portfolio-manage-table__muted">—</td>
                        <td>
                          <IconEditLink
                            href={`/portfolio/accounts/${row.accountIdHex}`}
                            label={`Edit ${row.name}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {metrics.topHoldings.length > 0 ? (
            <section className="portfolio-panel" aria-labelledby="portfolio-holdings-heading">
              <h2 className="portfolio-panel__title" id="portfolio-holdings-heading">
                Top holdings
              </h2>
              <p className="portfolio-holdings-panel__hint">Stock lots only, ranked by book value.</p>
              <div className="portfolio-holdings-grid">
                {metrics.topHoldings.map((h) => (
                  <article key={h.symbol} className="portfolio-holding-tile">
                    <h3 className="portfolio-holding-tile__sym">{h.symbol}</h3>
                    <p className="portfolio-holding-tile__shares">
                      {h.shares.toLocaleString("en-US", { maximumFractionDigits: 4 })} shares
                    </p>
                    <p className="portfolio-holding-tile__book">{formatUsdWhole(h.bookValue)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <PortfolioPositionQuickAdd portfolioId={portfolioIdHex} accounts={quickAddAccounts} />

          <div className="cta-row portfolio-manage-footer-cta">
            <Link className="cta cta-secondary" href="/">
              <HomeIcon className="crud-icon" />
              Home
            </Link>
            {defaultAccountHex ? (
              <Link className="cta cta-secondary" href={`/portfolio/accounts/${defaultAccountHex}`}>
                <EditIcon className="crud-icon" />
                Manage default account
              </Link>
            ) : null}
            {admin ? (
              <Link className="cta cta-primary" href="/admin/portfolios">
                <ExternalLinkIcon className="crud-icon" />
                Open in Hub
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="portfolio-overview__aside" aria-label="Allocations">
          <section className="portfolio-panel">
            <h2 className="portfolio-panel__title">By account</h2>
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

          <section className="portfolio-panel">
            <h2 className="portfolio-panel__title">By asset class</h2>
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
                    Options (basis)
                  </span>
                  <span>{formatUsdWhole(metrics.classAllocation.optionsUsd)}</span>
                </li>
              </ul>
            </div>
          </section>
        </aside>
      </div>
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
