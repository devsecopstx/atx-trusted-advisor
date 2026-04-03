"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { UploadIcon } from "@/app/admin/ui/crud-icons";

export type ImportActivityPortfolioOption = {
  id: string;
  name: string;
};

type AccountRow = {
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

type ImportActivityClientProps = {
  portfolios: ImportActivityPortfolioOption[];
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export function ImportActivityClient({ portfolios }: ImportActivityClientProps) {
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [brokerCsv, setBrokerCsv] = useState("");
  const [brokerKind, setBrokerKind] = useState<"merrill" | "fidelity">("merrill");
  const [fidelityDefaultRef, setFidelityDefaultRef] = useState("");
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreviewAccount[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<BrokerApplyRow[] | null>(null);
  const [taskOutput, setTaskOutput] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!portfolioId) {
      setAccounts([]);
      return;
    }
    try {
      const payload = await parseJson<{ data: AccountRow[] }>(
        await fetch(`/api/portfolios/${encodeURIComponent(portfolioId)}/accounts`, { cache: "no-store" })
      );
      setAccounts(payload.data);
    } catch {
      setAccounts([]);
    }
  }, [portfolioId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const findAccountByExternalRef = (accountRef: string): AccountRow | undefined => {
    const ref = accountRef.trim();
    if (!ref) {
      return undefined;
    }
    return accounts.find((a) => (a.extAccountId || "").trim() === ref);
  };

  const runPreview = async () => {
    if (!portfolioId) {
      setMessage("Select a portfolio.");
      return;
    }
    if (!brokerCsv.trim()) {
      setMessage("Choose or paste a holdings CSV export.");
      return;
    }
    if (brokerKind === "fidelity" && !fidelityDefaultRef.trim()) {
      setMessage("Fidelity imports require the default account ref (must match a portfolio account ext ref).");
      return;
    }
    setBusy(true);
    setMessage(null);
    setResults(null);
    setTaskOutput(null);
    try {
      const payload = await parseJson<{
        dryRun?: boolean;
        accounts?: BrokerPreviewAccount[];
      }>(
        await fetch("/api/import/broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            broker: brokerKind,
            exportType: "holdings",
            csv: brokerCsv,
            mappings: {},
            fidelityHoldingsDefaultAccountRef:
              brokerKind === "fidelity" ? fidelityDefaultRef.trim() : undefined,
            dryRun: true
          })
        })
      );
      if (!payload.accounts?.length) {
        throw new Error("No broker accounts in preview.");
      }
      setBrokerPreview(payload.accounts);
      setMessage(
        `Preview: ${payload.accounts.length} broker account(s). Confirm each maps to a portfolio account below, then run import.`
      );
    } catch (e) {
      setBrokerPreview(null);
      setMessage(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!portfolioId) {
      setMessage("Select a portfolio.");
      return;
    }
    if (!brokerCsv.trim()) {
      setMessage("Choose or paste a holdings CSV export.");
      return;
    }
    if (brokerPreview?.length) {
      const missing = brokerPreview
        .filter((row) => !findAccountByExternalRef(row.accountRef)?._id)
        .map((row) => row.accountRef || "(blank)");
      if (missing.length > 0) {
        setMessage(
          `Import blocked: ${missing.length} broker account ref(s) do not match any portfolio account ext ref. Missing: ${missing.join(", ")}`
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
    setBusy(true);
    setMessage(null);
    setResults(null);
    setTaskOutput(null);
    try {
      const payload = await parseJson<{
        data: {
          results: BrokerApplyRow[] | null;
          taskOutput: string;
          status: string;
          runId: string;
        };
      }>(
        await fetch("/api/import/broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            broker: brokerKind,
            exportType: "holdings",
            csv: brokerCsv,
            mappings,
            fidelityHoldingsDefaultAccountRef:
              brokerKind === "fidelity" ? fidelityDefaultRef.trim() : undefined,
            dryRun: false
          })
        })
      );
      setResults(payload.data.results ?? []);
      setTaskOutput(payload.data.taskOutput);
      setMessage(
        payload.data.status === "success"
          ? "Import finished — positions updated for mapped accounts."
          : "Import completed with errors — see summary below."
      );
      void loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid w-full gap-2">
      <p className="text-sm text-[var(--xf-text-300)]">
        Import Merrill Edge or Fidelity <strong>holdings</strong> CSV into your portfolio accounts. Broker account refs in
        the file must match each account&apos;s <code className="font-mono text-xs">ext ref</code> on the{" "}
        <Link className="underline text-[var(--xf-text-100)]" href="/portfolio">
          Portfolio
        </Link>{" "}
        workspace. Runs as an immediate <code className="font-mono text-xs">sync-broker</code> job; a short summary is shown
        when done.
      </p>

      {portfolios.length === 0 ? (
        <p className="text-sm text-[var(--xf-text-300)]">No portfolios yet — create one from Portfolios first.</p>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span>Portfolio</span>
          <select
            className="crud-input rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            value={portfolioId}
            onChange={(e) => {
              setPortfolioId(e.target.value);
              setBrokerPreview(null);
              setResults(null);
              setTaskOutput(null);
            }}
            disabled={busy}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {portfolioId ? (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-[var(--xf-text-300)]">
              <tr>
                <th className="p-2">Account</th>
                <th className="p-2 font-mono">ext ref (CSV must match)</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length > 0 ? (
                accounts.map((a) => (
                  <tr key={a._id ?? a.name} className="border-b border-white/5">
                    <td className="p-2">{a.name}</td>
                    <td className="p-2 font-mono">{(a.extAccountId || "").trim() || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="p-2 text-[var(--xf-text-300)]">
                    No accounts — add accounts under Portfolio for this book.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Broker</span>
          <select
            className="crud-input rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            value={brokerKind}
            onChange={(e) => {
              setBrokerKind(e.target.value as "merrill" | "fidelity");
              setBrokerPreview(null);
            }}
            disabled={busy}
          >
            <option value="merrill">Merrill Edge (holdings)</option>
            <option value="fidelity">Fidelity (positions)</option>
          </select>
        </label>
        {brokerKind === "fidelity" ? (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
            <span>Fidelity default account ref</span>
            <input
              className="crud-input rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs"
              value={fidelityDefaultRef}
              onChange={(e) => setFidelityDefaultRef(e.target.value)}
              placeholder="Matches portfolio account ext ref"
              disabled={busy}
            />
          </label>
        ) : null}
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm">
          <span>CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="crud-input text-xs min-w-0 max-w-full"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void f.text().then(setBrokerCsv);
            }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>CSV contents</span>
        <textarea
          className="min-h-[80px] rounded-md border border-white/10 bg-black/20 p-2 font-mono text-xs"
          value={brokerCsv}
          onChange={(e) => setBrokerCsv(e.target.value)}
          disabled={busy}
          placeholder="Paste or load CSV…"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--xf-radius-sm)] border border-[color:color-mix(in_srgb,var(--xf-text-100)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--xf-text-100)] transition hover:bg-[color:color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] disabled:pointer-events-none disabled:opacity-50"
          disabled={busy || !portfolioId}
          onClick={() => void runPreview()}
        >
          <UploadIcon className="crud-icon h-4 w-4" /> Preview (dry run)
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--xf-gain-green)] px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
          disabled={busy || !portfolioId || !brokerPreview?.length}
          onClick={() => void runImport()}
        >
          <UploadIcon className="crud-icon h-4 w-4" /> Run import now
        </button>
      </div>

      {message ? <p className="text-sm text-[var(--xf-text-200)]">{message}</p> : null}

      {brokerPreview && brokerPreview.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-[var(--xf-text-300)]">
              <tr>
                <th className="p-2">Broker ref</th>
                <th className="p-2">Stocks</th>
                <th className="p-2">Sample</th>
                <th className="p-2">Maps to</th>
              </tr>
            </thead>
            <tbody>
              {brokerPreview.map((row) => {
                const m = findAccountByExternalRef(row.accountRef);
                return (
                  <tr key={row.accountRef} className="border-b border-white/5">
                    <td className="p-2 font-mono">{row.accountRef}</td>
                    <td className="p-2">{row.stockCount}</td>
                    <td className="p-2 font-mono">{row.sampleTickers.join(", ")}</td>
                    <td className="p-2">{m?.name ?? "— no match —"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {results && results.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-[var(--xf-text-300)]">
              <tr>
                <th className="p-2">Account</th>
                <th className="p-2">Imported</th>
                <th className="p-2">Skipped</th>
                <th className="p-2">Cleared prior</th>
                <th className="p-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.accountRef} className="border-b border-white/5">
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">{r.imported}</td>
                  <td className="p-2">{r.skippedNonStock}</td>
                  <td className="p-2">{r.deletedPrior}</td>
                  <td className="p-2 text-red-300">{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {taskOutput ? (
        <details className="rounded-md border border-white/10 p-3 text-xs">
          <summary className="cursor-pointer text-[var(--xf-text-200)]">Task output</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[var(--xf-text-300)]">
            {taskOutput}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
