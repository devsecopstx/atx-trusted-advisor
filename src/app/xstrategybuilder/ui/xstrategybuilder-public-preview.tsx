"use client";

import { useCallback, useMemo, useState } from "react";

import type { XsbInitialWorkspace, XsbWorkspaceAccount, XsbWorkspacePortfolio } from "../workspace-types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; portfolio: XsbWorkspacePortfolio };

const WATCHLIST_CHIPS: { label: string }[] = [
  { label: "RDW IV 100%" },
  { label: "LUNR IV 100%" },
  { label: "TSLA IV 100%" }
];

function accountStableKey(account: XsbWorkspaceAccount): string {
  const id = account._id?.trim();
  if (id) {
    return `id:${id}`;
  }
  return `ref:${account.accountRef}:${account.name}`;
}

function initialToLoadState(initial: XsbInitialWorkspace): LoadState {
  if (initial.status === "ready") {
    return { status: "ready", portfolio: initial.portfolio };
  }
  return { status: "error", message: initial.message };
}

function parseDefaultPortfolioJson(raw: unknown): XsbWorkspacePortfolio | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as { data?: unknown };
  const d = o.data;
  if (!d || typeof d !== "object") {
    return null;
  }
  const row = d as {
    _id?: unknown;
    name?: unknown;
    accounts?: unknown;
    isDefault?: unknown;
  };
  if (typeof row._id !== "string" || row._id.length === 0) {
    return null;
  }
  const name = typeof row.name === "string" && row.name.length > 0 ? row.name : "Portfolio";
  const accountsRaw = Array.isArray(row.accounts) ? row.accounts : [];
  const accounts: XsbWorkspaceAccount[] = accountsRaw
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object")
    .map((a) => {
      const _id = typeof a._id === "string" ? a._id : undefined;
      const accName = typeof a.name === "string" && a.name.length > 0 ? a.name : "Account";
      const accountRef = typeof a.accountRef === "string" ? a.accountRef : "";
      const brokerType = typeof a.brokerType === "string" ? a.brokerType : "broker";
      const balance = typeof a.balance === "number" && Number.isFinite(a.balance) ? a.balance : 0;
      return { _id, name: accName, accountRef, brokerType, balance };
    });
  const isDefault = row.isDefault === true;
  return { _id: row._id, name, accounts, isDefault };
}

export type XstrategybuilderPublicPreviewProps = {
  initialWorkspace: XsbInitialWorkspace;
};

export function XstrategybuilderPublicPreview({ initialWorkspace }: XstrategybuilderPublicPreviewProps) {
  const [loadState, setLoadState] = useState<LoadState>(() => initialToLoadState(initialWorkspace));
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(null);

  const fetchDefault = useCallback(async () => {
    setLoadState({ status: "loading" });
    setSelectedPortfolioId(null);
    setSelectedAccountKey(null);
    try {
      const res = await fetch("/api/portfolios/default", { credentials: "include" });
      const j: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const err =
          j && typeof j === "object" && "error" in j && typeof (j as { error: unknown }).error === "string"
            ? (j as { error: string }).error
            : "Could not load portfolio";
        setLoadState({ status: "error", message: err });
        return;
      }
      const portfolio = parseDefaultPortfolioJson(j);
      if (!portfolio) {
        setLoadState({ status: "error", message: "Unexpected portfolio response" });
        return;
      }
      setLoadState({ status: "ready", portfolio });
    } catch {
      setLoadState({ status: "error", message: "Network error" });
    }
  }, []);

  const portfolio = loadState.status === "ready" ? loadState.portfolio : null;
  const accounts = portfolio?.accounts ?? [];

  const selectedPortfolio = useMemo(() => {
    if (!portfolio || !selectedPortfolioId) {
      return null;
    }
    return portfolio._id === selectedPortfolioId ? portfolio : null;
  }, [portfolio, selectedPortfolioId]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }),
    []
  );

  return (
    <div
      aria-label="xStrategyBuilder — workspace and order preview"
      className="xsb-builder-preview xsb-builder-preview--friendly"
      role="region"
    >
      <div className="xsb-builder-preview-head">
        <h2 className="xsb-builder-title">xStrategyBuilder</h2>
        <p className="xsb-builder-sub">
          Build sophisticated option strategies with real-time data and P/L analysis — plain language first, then
          precise legs.
        </p>
      </div>

      <label className="xsb-builder-nl-label" htmlFor="xsb-nl-preview">
        Describe your order
      </label>
      <input
        readOnly
        className="xsb-builder-nl-input"
        id="xsb-nl-preview"
        placeholder="Describe your order in plain language"
        tabIndex={-1}
        type="text"
        value=""
      />

      <div className="xsb-friendly-workspace">
        <p className="xsb-friendly-section-label">Portfolio</p>
        {loadState.status === "loading" ? (
          <p className="xsb-friendly-hint">Loading your workspace…</p>
        ) : null}
        {loadState.status === "error" ? (
          <div className="xsb-friendly-error">
            <p>{loadState.message}</p>
            <button className="xsb-friendly-retry" onClick={() => void fetchDefault()} type="button">
              Retry
            </button>
          </div>
        ) : null}
        {portfolio ? (
          <div className="xsb-portfolio-picker" role="listbox" aria-label="Choose a portfolio">
            <button
              aria-selected={selectedPortfolioId === portfolio._id}
              className={
                selectedPortfolioId === portfolio._id
                  ? "xsb-portfolio-option xsb-portfolio-option--active"
                  : "xsb-portfolio-option"
              }
              onClick={() => {
                setSelectedPortfolioId(portfolio._id);
                setSelectedAccountKey(null);
              }}
              role="option"
              type="button"
            >
              <span className="xsb-portfolio-option-name">{portfolio.name}</span>
              <span className="xsb-portfolio-option-meta">
                {portfolio.isDefault ? "Default workspace" : "Portfolio"}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {selectedPortfolio ? (
        <div className="xsb-friendly-accounts">
          <p className="xsb-friendly-section-label" id="xsb-account-heading">
            Account
          </p>
          {accounts.length === 0 ? (
            <p className="xsb-friendly-hint">
              No accounts in this portfolio yet. Add one from{" "}
              <a className="xsb-friendly-link" href="/portfolio">
                Portfolio
              </a>
              .
            </p>
          ) : (
            <ul aria-labelledby="xsb-account-heading" className="xsb-account-list" role="list">
              {accounts.map((acc) => {
                const key = accountStableKey(acc);
                const active = selectedAccountKey === key;
                return (
                  <li key={key}>
                    <button
                      aria-pressed={active}
                      className={active ? "xsb-account-row xsb-account-row--active" : "xsb-account-row"}
                      onClick={() => setSelectedAccountKey(key)}
                      type="button"
                    >
                      <span className="xsb-account-row-name">{acc.name}</span>
                      <span className="xsb-account-row-meta">
                        {acc.brokerType}
                        {acc.accountRef ? ` · ${acc.accountRef}` : ""}
                      </span>
                      <span className="xsb-account-row-balance">{money.format(acc.balance)} cash</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {selectedPortfolio && selectedAccountKey ? (
        <p className="xsb-friendly-selection-summary" role="status">
          Order context: <strong>{selectedPortfolio.name}</strong>
          {" · "}
          <strong>{accounts.find((a) => accountStableKey(a) === selectedAccountKey)?.name ?? "Account"}</strong>
        </p>
      ) : null}

      <div className="xsb-builder-panel xsb-builder-panel--friendly">
        <h3 className="xsb-builder-step-heading">Select a symbol</h3>
        <div className="xsb-builder-search">
          <span aria-hidden className="xsb-builder-search-icon">
            ⌕
          </span>
          <span className="xsb-builder-search-placeholder">Search symbol (e.g. TSLA, AAPL)</span>
        </div>
        <div className="xsb-builder-actions">
          <span className="xsb-builder-next">Next</span>
        </div>
      </div>

      <p className="xsb-builder-watchlist-label">Top from watchlist (CSP / CC volatility)</p>
      <div className="xsb-builder-chips" role="list">
        {WATCHLIST_CHIPS.map((c) => (
          <span key={c.label} className="xsb-builder-chip" role="listitem">
            {c.label}
          </span>
        ))}
      </div>

      <p className="xsb-builder-contract-note">
        Session tool contract: <code className="xsb-inline-code">symbol</code>, optional{" "}
        <code className="xsb-inline-code">outlook</code>, <code className="xsb-inline-code">strategyId</code>,{" "}
        <code className="xsb-inline-code">contractType</code>, <code className="xsb-inline-code">expiration</code>,{" "}
        <code className="xsb-inline-code">maxRows</code> → symbol snapshot, option chain rows (call/put per strike),
        and a recommendation block (action, strikes, breakeven, rationale) — see xfinance-strategy{" "}
        <code className="xsb-inline-code">xstrategy-builder-service</code>.
      </p>

      <p className="xsb-occ-foot">
        Options involve risk and are not suitable for all investors. Review OCC disclosures before trading.
      </p>
    </div>
  );
}
