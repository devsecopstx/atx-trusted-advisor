"use client";

import { useCallback, useEffect, useState } from "react";

import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "@/app/admin/lib/broker-import-description";
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
  const [fidelityRef, setFidelityRef] = useState("");
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreviewAccount[] | null>(null);
  const [accountRefMap, setAccountRefMap] = useState<Record<string, string>>({});
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
    if (!portfolioId || !brokerPreview?.length) {
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
            portfolioId,
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
          placeholder="Merrill: Holdings export… Fidelity: Positions…"
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
                        <option
                          key={a._id ?? a.name}
                          value={a._id ?? ""}
                          title={a.extAccountId ? `Ref: ${a.extAccountId}` : undefined}
                        >
                          {a.name}
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
  );
}
