import Link from "next/link";

import { PortfolioPositionQuickAdd } from "@/app/portfolio/ui/portfolio-position-quick-add";
import { PortfolioRefreshButton } from "@/app/portfolio/ui/portfolio-refresh-button";
import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import {
    formatUsd2,
    formatUsdWhole,
    type PortfolioOverviewMetrics
} from "@/lib/portfolio-overview-metrics";
import {
    INVESTMENT_STRATEGY_OPTIONS,
    RISK_LEVEL_OPTIONS
} from "@/modules/core-admin/portfolio-preference-labels";
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
};

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deskCaption(account: Account): string | null {
  const outlookTitle = account.outlook
    ? INVESTMENT_STRATEGY_OPTIONS.find((o) => o.value === account.outlook)?.title
    : undefined;
  const riskLabel = account.riskProfile
    ? RISK_LEVEL_OPTIONS.find((r) => r.riskProfile === account.riskProfile)?.label
    : undefined;
  if (outlookTitle && riskLabel) {
    return `${outlookTitle} · ${riskLabel} risk`;
  }
  if (outlookTitle) {
    return outlookTitle;
  }
  if (riskLabel) {
    return `${riskLabel} risk`;
  }
  return null;
}

function accountByHex(accounts: Account[], hex: string): Account | undefined {
  return accounts.find((a) => a._id?.toHexString() === hex);
}

export function PortfolioOverview({
  portfolioDisplayName,
  portfolioIdHex,
  accounts,
  metrics,
  admin,
  quickAddAccounts
}: PortfolioOverviewProps) {
  const defaultAccountHex =
    metrics.byAccount.find((r) => r.isDefault)?.accountIdHex ?? metrics.byAccount[0]?.accountIdHex ?? "";

  const classTotal = metrics.classAllocation.totalUsd > 0 ? metrics.classAllocation.totalUsd : 1;
  const pctStocks = (metrics.classAllocation.stocksUsd / classTotal) * 100;
  const pctCash = (metrics.classAllocation.cashUsd / classTotal) * 100;
  const pctOptions = (metrics.classAllocation.optionsUsd / classTotal) * 100;

  return (
    <div className="portfolio-overview">
      <header className="portfolio-hero xf-noise-overlay">
        <div className="portfolio-hero__top">
          <div className="portfolio-hero__title-block">
            <p className="portfolio-hero__eyebrow">Portfolio</p>
            <h1 className="portfolio-hero__title">Portfolio overview</h1>
            <p className="portfolio-hero__sub">
              {portfolioDisplayName} — linked accounts and holdings book (cost basis). Live marks are not shown
              here.
            </p>
          </div>
          <div className="portfolio-hero__toolbar">
            <PortfolioRefreshButton label="Refresh" />
            <SyncDefaultPortfolioButton variant="secondary" />
            {defaultAccountHex ? (
              <Link className="cta cta-secondary" href={`/portfolio/accounts/${defaultAccountHex}`}>
                Manage default
              </Link>
            ) : null}
          </div>
        </div>

        <div className="portfolio-metric">
          <p className="portfolio-metric__label">Book value (cost basis)</p>
          <p className="portfolio-metric__value">{formatUsdWhole(metrics.headlineBookUsd)}</p>
          <p className="portfolio-metric__note">
            Stocks and custodian cash balances plus recorded cash lots. Options excluded from this headline total.
          </p>
          {metrics.optionLegCount > 0 ? (
            <p className="portfolio-metric__options-hint">
              Options: {metrics.optionLegCount} leg{metrics.optionLegCount === 1 ? "" : "s"} · premium basis{" "}
              {formatUsd2(metrics.optionBookValueUsd)} (100× multiplier per contract).
            </p>
          ) : null}
        </div>

        <details className="portfolio-tech-details">
          <summary>Technical</summary>
          <pre>Portfolio ID: {portfolioIdHex}</pre>
        </details>
      </header>

      <div className="portfolio-overview__grid">
        <div className="portfolio-overview__main">
          <section className="portfolio-panel" aria-labelledby="portfolio-accounts-heading">
            <h2 className="portfolio-panel__title" id="portfolio-accounts-heading">
              Accounts
            </h2>
            <div className="portfolio-account-list">
              {metrics.byAccount.map((row) => {
                const acct = accountByHex(accounts, row.accountIdHex);
                const desk = acct ? deskCaption(acct) : null;
                const optHint =
                  row.optionLegCount > 0
                    ? ` · ${row.optionLegCount} option leg${row.optionLegCount === 1 ? "" : "s"}`
                    : "";
                return (
                  <Link
                    key={row.accountIdHex}
                    className="portfolio-account-card"
                    href={`/portfolio/accounts/${row.accountIdHex}`}
                  >
                    <div className="portfolio-account-card__main">
                      <span className="portfolio-account-card__name">
                        {row.name}
                        {row.isDefault ? (
                          <span className="portfolio-account-card__badge">Default</span>
                        ) : null}
                      </span>
                      {desk ? <div className="portfolio-account-card__desk">{desk}</div> : null}
                      <div className="portfolio-account-card__broker">
                        {formatBrokerType(row.brokerType)}
                        {row.extAccountId ? ` · ${row.extAccountId}` : ""}
                      </div>
                    </div>
                    <div className="portfolio-account-card__aside">
                      <div className="portfolio-account-card__stats">
                        <div className="portfolio-account-card__value">
                          {formatUsdWhole(row.valueExcludingOptions)}
                        </div>
                        <div className="portfolio-account-card__meta">
                          {row.positionRowCount} position{row.positionRowCount === 1 ? "" : "s"}
                          {optHint}
                        </div>
                      </div>
                      <span className="portfolio-account-card__chevron" aria-hidden>
                        ›
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {metrics.topHoldings.length > 0 ? (
            <section className="portfolio-panel" aria-labelledby="portfolio-holdings-heading">
              <h2 className="portfolio-panel__title" id="portfolio-holdings-heading">
                Top holdings
              </h2>
              <p className="hero-copy" style={{ margin: "0 0 0.65rem", fontSize: "0.82rem" }}>
                Stock lots only, ranked by book value.
              </p>
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

          <div className="cta-row">
            <Link className="cta cta-secondary" href="/">
              Home
            </Link>
            {admin ? (
              <Link className="cta cta-primary" href="/admin/portfolios">
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
    </div>
  );
}
