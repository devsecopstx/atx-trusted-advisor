"use client";

import { useCallback, useEffect, useState } from "react";

import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "@/app/admin/lib/broker-import-description";
import { UploadIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type PortfolioOption = {
  _id: string;
  name: string;
  userId: string;
  accountCount: number;
  userDisplayName?: string;
};

type Account = {
  _id?: string;
  name: string;
  extAccountId: string;
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

type BrokerHoldingsImportPanelProps = {
  /** When set, fixes the target portfolio (e.g. accounts subpage). */
  lockedPortfolioId?: string;
};

export function BrokerHoldingsImportPanel({ lockedPortfolioId }: BrokerHoldingsImportPanelProps) {
  const [portfolios, setPortfolios] = useState<PortfolioOption[]>([]);
  const [portfolioId, setPortfolioId] = useState(lockedPortfolioId ?? "");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [brokerCsv, setBrokerCsv] = useState("");
  const [brokerKind, setBrokerKind] = useState<"merrill" | "fidelity">("merrill");
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreviewAccount[] | null>(null);
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [brokerMessage, setBrokerMessage] = useState<string | null>(null);
  const [brokerResults, setBrokerResults] = useState<BrokerApplyRow[] | null>(null);

  const loadPortfolios = useCallback(async () => {
    if (lockedPortfolioId) {
      setPortfolioId(lockedPortfolioId);
      return;
    }
    try {
      const payload = await parseJson<{ data: PortfolioOption[] }>(
        await fetch("/api/admin/portfolios", { cache: "no-store" })
      );
      setPortfolios(payload.data);
      setPortfolioId((prev) => prev || payload.data[0]?._id || "");
    } catch {
      setPortfolios([]);
    }
  }, [lockedPortfolioId]);

  const loadAccounts = useCallback(async () => {
    if (!portfolioId) {
      setAccounts([]);
      return;
    }
    try {
      const payload = await parseJson<{
        data: { accounts: Array<{ _id?: string; name: string; extAccountId: string }> };
      }>(await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`, { cache: "no-store" }));
      setAccounts(payload.data.accounts);
    } catch {
      setAccounts([]);
    }
  }, [portfolioId]);

  useEffect(() => {
    void loadPortfolios();
  }, [loadPortfolios]);

  useEffect(() => {
    if (lockedPortfolioId) {
      setPortfolioId(lockedPortfolioId);
    }
  }, [lockedPortfolioId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const findAccountByExternalRef = (accountRef: string): Account | undefined => {
    const ref = accountRef.trim();
    if (!ref) {
      return undefined;
    }
    return accounts.find((a) => (a.extAccountId || "").trim() === ref);
  };

  const runBrokerPreview = async () => {
    if (!portfolioId) {
      setBrokerMessage("Select a portfolio.");
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
            portfolioId,
            broker: brokerKind,
            exportType: "holdings",
            csv: brokerCsv,
            mappings: {},
            dryRun: true
          })
        })
      );
      if (!payload.accounts?.length) {
        throw new Error("No broker accounts in preview.");
      }
      setBrokerPreview(payload.accounts);
      setBrokerMessage(
        `Preview: ${payload.accounts.length} broker account(s). Map each to a core account, then run import.`
      );
    } catch (e) {
      setBrokerPreview(null);
      setBrokerMessage(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBrokerBusy(false);
    }
  };

  const runBrokerImport = async () => {
    if (!portfolioId) {
      setBrokerMessage("Select a portfolio.");
      return;
    }
    if (!brokerCsv.trim()) {
      setBrokerMessage("Paste a holdings CSV export.");
      return;
    }
    if (brokerPreview?.length) {
      const missing = brokerPreview
        .filter((row) => !findAccountByExternalRef(row.accountRef)?._id)
        .map((row) => row.accountRef || "(blank)");
      if (missing.length > 0) {
        setBrokerMessage(
          `Import blocked: ${missing.length} broker account ref(s) do not match any portfolio account ext_account_ref. ` +
            `Missing: ${missing.join(", ")}`
        );
        return;
      }
    }
    const mappings =
      brokerPreview?.length
        ? Object.fromEntries(
            brokerPreview.flatMap((row) => {
              const matched = findAccountByExternalRef(row.accountRef)?._id;
              return matched ? [[row.accountRef, matched] as const] : [];
            })
          )
        : {};
    setBrokerBusy(true);
    setBrokerMessage(null);
    setBrokerResults(null);
    try {
      const payload = await parseJson<{ results?: BrokerApplyRow[] }>(
        await fetch("/api/admin/import/broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            broker: brokerKind,
            exportType: "holdings",
            csv: brokerCsv,
            mappings,
            dryRun: false
          })
        })
      );
      setBrokerResults(payload.results ?? []);
      setBrokerMessage("Import finished — refresh accounts to verify.");
      void loadAccounts();
    } catch (e) {
      setBrokerMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBrokerBusy(false);
    }
  };

  return (
    <article className="surface-card xf-widget section-card">
      <h3>Broker import</h3>
      <p className="status-text" style={{ marginBottom: "0.75rem" }}>
        {ADMIN_BROKER_IMPORT_DESCRIPTION}
      </p>
      {lockedPortfolioId ? (
        <p className="status-text font-mono text-xs" style={{ marginBottom: "0.75rem" }}>
          Target portfolio: <strong>{lockedPortfolioId}</strong>
        </p>
      ) : (
        <label className="status-text" style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
          Target portfolio
          <select
            className="crud-input"
            value={portfolioId}
            onChange={(e) => {
              setPortfolioId(e.target.value);
              setBrokerPreview(null);
              setBrokerResults(null);
            }}
            disabled={brokerBusy}
          >
            <option value="">— Select —</option>
            {portfolios.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} · {p.userDisplayName ?? `${p.userId.slice(0, 8)}…`} ({p.accountCount} acct)
              </option>
            ))}
          </select>
        </label>
      )}
      {portfolioId ? (
        <div className="crud-table-wrap" style={{ marginBottom: "0.75rem" }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Portfolio account</th>
                <th>ext_account_ref (required match key)</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length > 0 ? (
                accounts.map((a) => (
                  <tr key={a._id ?? a.name}>
                    <td>{a.name}</td>
                    <td className="font-mono text-xs">{(a.extAccountId || "").trim() || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="status-text">
                    No accounts found for selected portfolio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
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
        <p className="status-text" style={{ flex: "1 1 280px", margin: 0 }}>
          Note: import account refs in the file must match portfolio account{" "}
          <code className="font-mono text-xs">ext_account_ref</code> values exactly, or rows will not sync.
        </p>
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
          placeholder="Merrill: Holdings export… Fidelity: Positions…"
        />
      </label>
      <div className="tool-row" style={{ marginTop: "0.75rem" }}>
        <button
          type="button"
          className="cta cta-secondary"
          disabled={brokerBusy}
          onClick={() => void runBrokerPreview()}
          aria-label="Preview broker CSV"
          title="Parse CSV and preview account mapping without saving"
        >
          <UploadIcon className="crud-icon" /> Preview CSV (dry run)
        </button>
        <button
          type="button"
          className="cta cta-primary"
          disabled={brokerBusy}
          onClick={() => void runBrokerImport()}
          aria-label="Import broker CSV"
          title="Parse CSV and import holdings to mapped core accounts"
        >
          <UploadIcon className="crud-icon" /> Import Broker
        </button>
      </div>
      <p className="status-text" style={{ marginTop: "0.4rem" }}>
        Actions: <strong>Preview CSV</strong> parses only (no writes). <strong>Import Broker</strong> parses + writes holdings.
      </p>
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
                <th>Matched portfolio account (by ext_account_ref)</th>
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
                    {(() => {
                      const matched = findAccountByExternalRef(row.accountRef);
                      if (!matched?._id) {
                        return <span className="status-text status-error">No ext_account_ref match</span>;
                      }
                      return (
                        <span className="status-text">
                          {matched.name}{" "}
                          <code className="font-mono text-xs">({matched.extAccountId || "—"})</code>
                        </span>
                      );
                    })()}
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
  );
}
