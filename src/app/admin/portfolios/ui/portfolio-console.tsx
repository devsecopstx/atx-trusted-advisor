"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type Portfolio = {
  _id?: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type Account = {
  _id?: string;
  userId: string;
  portfolioId: string;
  name: string;
  type: string;
  extAccountId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type Watchlist = {
  _id?: string;
  userId: string;
  portfolioId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export function PortfolioConsole() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading default portfolio...");
    try {
      const portfolioPayload = await parseJson<{ data: Portfolio }>(
        await fetch("/api/portfolios/default")
      );
      const p = portfolioPayload.data;
      setPortfolio(p);

      if (p._id) {
        const [accountsPayload, watchlistPayload] = await Promise.all([
          parseJson<{ data: Account[] }>(
            await fetch(`/api/portfolios/${encodeURIComponent(p._id)}/accounts`)
          ),
          parseJson<{ data: Watchlist }>(
            await fetch(`/api/portfolios/${encodeURIComponent(p._id)}/watchlist`)
          ).catch(() => ({ data: null }))
        ]);
        setAccounts(accountsPayload.data);
        setWatchlist(watchlistPayload.data);
      }

      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load portfolio data");
      setPortfolio(null);
      setAccounts([]);
      setWatchlist(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh portfolio
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Default Portfolio</h3>
        {portfolio ? (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Default</th>
                  <th>User ID</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{portfolio.name}</td>
                  <td>{portfolio.isDefault ? "Yes" : "No"}</td>
                  <td>{portfolio.userId}</td>
                  <td>{new Date(portfolio.createdAt).toLocaleString()}</td>
                  <td>{new Date(portfolio.updatedAt).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="status-text">No default portfolio found. Run seed:admin to create one.</p>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Accounts ({accounts.length})</h3>
        {accounts.length > 0 ? (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>External ID</th>
                  <th>Default</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account._id ?? account.name}>
                    <td>{account.name}</td>
                    <td>{account.type}</td>
                    <td>{account.extAccountId}</td>
                    <td>{account.isDefault ? "Yes" : "No"}</td>
                    <td>{new Date(account.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="status-text">No accounts found for this portfolio.</p>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Watchlist</h3>
        {watchlist ? (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Default</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{watchlist.name}</td>
                  <td>{watchlist.isDefault ? "Yes" : "No"}</td>
                  <td>{new Date(watchlist.createdAt).toLocaleString()}</td>
                  <td>{new Date(watchlist.updatedAt).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="status-text">No watchlist found for this portfolio.</p>
        )}
      </article>
    </section>
  );
}
