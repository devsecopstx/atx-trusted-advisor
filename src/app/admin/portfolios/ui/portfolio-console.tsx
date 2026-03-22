"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type Portfolio = {
  _id?: string;
  userId: string;
  name: string;
  isDefault: boolean;
  tenantPortfolioOrgKey?: string;
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

type BrokerPreviewAccount = {
  accountRef: string;
  label: string;
  positionCount: number;
  stockCount: number;
  optionCount: number;
  cashCount: number;
  sampleTickers: string[];
};

type BrokerApplyRow = {
  accountRef: string;
  label: string;
  imported: number;
  skippedNonStock: number;
  deletedPrior: number;
  error?: string;
};

export function PortfolioConsole() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);

  const [brokerCsv, setBrokerCsv] = useState("");
  const [brokerKind, setBrokerKind] = useState<"merrill" | "fidelity">("merrill");
  const [fidelityRef, setFidelityRef] = useState("");
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreviewAccount[] | null>(null);
  const [accountRefMap, setAccountRefMap] = useState<Record<string, string>>({});
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [brokerMessage, setBrokerMessage] = useState<string | null>(null);
  const [brokerResults, setBrokerResults] = useState<BrokerApplyRow[] | null>(null);

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

  useEffect(() => {
    if (!brokerPreview?.length || !accounts.length) return;
    setAccountRefMap((prev) => {
      const next = { ...prev };
      for (const row of brokerPreview) {
        if (next[row.accountRef]) continue;
        const ref = row.accountRef.trim();
        const byExt = accounts.find((a) => (a.extAccountId || "").trim() === ref);
        const byName = accounts.find((a) => (a.name || "").trim() === row.label.trim());
        const pick = byExt ?? byName;
        if (pick?._id) next[row.accountRef] = pick._id;
      }
      return next;
    });
  }, [brokerPreview, accounts]);

  const runBrokerPreview = async () => {
    if (!portfolio?._id) {
      setBrokerMessage("Load a portfolio first.");
      return;
    }
    if (!brokerCsv.trim()) {
      setBrokerMessage("Paste a holdings CSV export.");
      return;
    }
    setBrokerBusy(true);
    setBrokerMessage(null);
    setBrokerResults(null);
    try {
      const payload = await parseJson<{
        dryRun?: boolean;
        accounts?: BrokerPreviewAccount[];
      }>(
        await fetch("/api/admin/import/broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: portfolio._id,
            broker: brokerKind,
            exportType: "holdings",
            csv: brokerCsv,
            mappings: {},
            fidelityHoldingsDefaultAccountRef: fidelityRef.trim() || undefined,
            dryRun: true
          })
        })
      );
      if (!payload.accounts?.length) {
        throw new Error("No broker accounts in preview.");
      }
      setBrokerPreview(payload.accounts);
      setBrokerMessage(
        `Preview: ${payload.accounts.length} broker account(s). Map each to a core account, then run import. Stock rows become symbol/qty/avgCost; option/cash rows are skipped.`
      );
    } catch (e) {
      setBrokerPreview(null);
      setBrokerMessage(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBrokerBusy(false);
    }
  };

  const runBrokerImport = async () => {
    if (!portfolio?._id || !brokerPreview?.length) {
      setBrokerMessage("Run preview first.");
      return;
    }
    setBrokerBusy(true);
    setBrokerMessage(null);
    setBrokerResults(null);
    try {
      const payload = await parseJson<{ results?: BrokerApplyRow[] }>(
        await fetch("/api/admin/import/broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: portfolio._id,
            broker: brokerKind,
            exportType: "holdings",
            csv: brokerCsv,
            mappings: accountRefMap,
            fidelityHoldingsDefaultAccountRef: fidelityRef.trim() || undefined,
            dryRun: false
          })
        })
      );
      setBrokerResults(payload.results ?? []);
      setBrokerMessage("Import finished — refresh app portfolio or re-fetch accounts to verify.");
      void refresh();
    } catch (e) {
      setBrokerMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBrokerBusy(false);
    }
  };

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh portfolio
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Your default tenant portfolio</h3>
        {portfolio ? (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Tenant org key</th>
                  <th>Name</th>
                  <th>Default</th>
                  <th>User ID</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono text-xs">
                    {portfolio.tenantPortfolioOrgKey ?? "—"}
                  </td>
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

      <article className="surface-card xf-widget section-card">
        <h3>Broker holdings import</h3>
        <p className="status-text" style={{ marginBottom: "0.75rem" }}>
          Same contract as xfinance-strategy <code className="font-mono text-xs">POST /api/import/broker</code>{" "}
          (holdings only): CSV + broker + per-broker-account mappings. Parsed positions follow OpenAPI{" "}
          <code className="font-mono text-xs">Position</code> (<strong>ticker</strong>, <strong>shares</strong>,{" "}
          <strong>purchasePrice</strong>, <strong>type</strong> stock | option | cash). Core Mongo stores{" "}
          <strong>stock</strong> lots only (<code className="font-mono text-xs">symbol</code>,{" "}
          <code className="font-mono text-xs">qty</code>, <code className="font-mono text-xs">avgCost</code>
          ); option and cash lines are skipped. Import replaces existing lots for each mapped account.
        </p>
        <div className="stack-gap" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Broker
            <select
              className="crud-input"
              value={brokerKind}
              onChange={(e) => setBrokerKind(e.target.value as "merrill" | "fidelity")}
              disabled={brokerBusy}
            >
              <option value="merrill">Merrill Edge (holdings)</option>
              <option value="fidelity">Fidelity (positions, all accounts)</option>
            </select>
          </label>
          {brokerKind === "fidelity" ? (
            <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Map file to external ref
              <input
                className="crud-input"
                placeholder="Must match account extAccountId"
                value={fidelityRef}
                onChange={(e) => setFidelityRef(e.target.value)}
                disabled={brokerBusy}
              />
            </label>
          ) : null}
          <label className="status-text" style={{ flex: "1 1 240px", minWidth: "200px" }}>
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="crud-input"
              disabled={brokerBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then(setBrokerCsv);
              }}
            />
          </label>
        </div>
        <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.75rem" }}>
          Paste or load CSV
          <textarea
            className="crud-input font-mono text-xs"
            rows={8}
            value={brokerCsv}
            onChange={(e) => setBrokerCsv(e.target.value)}
            disabled={brokerBusy}
            placeholder="Merrill: Holdings export with Symbol, Quantity, Account #… Fidelity: Positions with Symbol header row…"
          />
        </label>
        <div className="tool-row" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="cta cta-secondary" disabled={brokerBusy} onClick={() => void runBrokerPreview()}>
            Preview (dry run)
          </button>
          <button type="button" className="cta cta-primary" disabled={brokerBusy} onClick={() => void runBrokerImport()}>
            Import holdings
          </button>
        </div>
        {brokerMessage ? <p className="status-text">{brokerMessage}</p> : null}
        {brokerPreview && brokerPreview.length > 0 ? (
          <div className="crud-table-wrap" style={{ marginTop: "1rem" }}>
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Broker key</th>
                  <th>Label</th>
                  <th>Rows</th>
                  <th>Stock / opt / cash</th>
                  <th>Sample tickers</th>
                  <th>Core account</th>
                </tr>
              </thead>
              <tbody>
                {brokerPreview.map((row) => (
                  <tr key={row.accountRef}>
                    <td className="font-mono text-xs">{row.accountRef || "—"}</td>
                    <td>{row.label}</td>
                    <td>{row.positionCount}</td>
                    <td>
                      {row.stockCount} / {row.optionCount} / {row.cashCount}
                    </td>
                    <td className="font-mono text-xs">{row.sampleTickers.join(", ") || "—"}</td>
                    <td>
                      <select
                        className="crud-input"
                        value={accountRefMap[row.accountRef] ?? ""}
                        onChange={(e) =>
                          setAccountRefMap((m) => ({ ...m, [row.accountRef]: e.target.value }))
                        }
                        disabled={brokerBusy}
                      >
                        <option value="">— Select —</option>
                        {accounts.map((a) => (
                          <option key={a._id ?? a.name} value={a._id ?? ""}>
                            {a.name} ({a.extAccountId})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {brokerResults && brokerResults.length > 0 ? (
          <div className="crud-table-wrap" style={{ marginTop: "1rem" }}>
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Broker key</th>
                  <th>Imported</th>
                  <th>Skipped (non-stock)</th>
                  <th>Deleted prior</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {brokerResults.map((r) => (
                  <tr key={`${r.accountRef}-${r.label}`}>
                    <td className="font-mono text-xs">{r.accountRef}</td>
                    <td>{r.imported}</td>
                    <td>{r.skippedNonStock}</td>
                    <td>{r.deletedPrior}</td>
                    <td className="text-xs">{r.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
