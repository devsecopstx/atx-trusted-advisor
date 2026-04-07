"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DeleteIcon, UploadIcon } from "@/app/admin/ui/crud-icons";
import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { brokerExportRefMatchesStoredExt } from "@/lib/broker-account-ref-match";
import { detectFidelityActivitiesCsv } from "@/modules/portfolio-import/fidelity-activities-csv";
import { detectFidelityPortfolioHoldingsCsv } from "@/modules/portfolio-import/fidelity-holdings-csv";

export type ImportActivityPortfolioOption = {
  id: string;
  name: string;
};

export type ImportActivityBrokerOption = {
  id: string;
  name: string;
  iconUrl: string;
};

type AccountRow = {
  _id?: string;
  name: string;
  extAccountId: string;
  /** Custodian slug; must match selected import broker. */
  type?: string;
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

/** Must match `parseBrokerHoldingsAccounts` / `applyBrokerHoldingsToMappedAccounts` mapping keys. */
function brokerImportPreviewRowKey(row: BrokerPreviewAccount): string {
  return row.accountRef || row.label || "default";
}

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
  brokers: ImportActivityBrokerOption[];
  /** When present and matches a portfolio id, preselect that book (e.g. from /portfolio Activities). */
  initialPortfolioId?: string;
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

const SUPPORTED_IMPORT_BROKERS = new Set(["merrill", "fidelity"]);
const BROKER_IMPORT_PREFERRED_ORDER = ["fidelity", "merrill", "etrade", "ibkr"] as const;

function orderBrokersForImport(brokers: ImportActivityBrokerOption[]): ImportActivityBrokerOption[] {
  const rank = new Map<string, number>(
    BROKER_IMPORT_PREFERRED_ORDER.map((id, index) => [id, index])
  );
  return [...brokers].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.POSITIVE_INFINITY;
    const rb = rank.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) {
      return ra - rb;
    }
    return a.name.localeCompare(b.name);
  });
}

function resolveDefaultBrokerId(brokers: ImportActivityBrokerOption[]): string {
  const ordered = orderBrokersForImport(brokers);
  return ordered[0]?.id ?? "fidelity";
}

function brokerCapabilityBadges(brokerId: string): string[] {
  switch (brokerId) {
    case "merrill":
      return ["Holdings"];
    case "fidelity":
      return ["Holdings", "Activities"];
    default:
      return ["Coming soon"];
  }
}

export function ImportActivityClient({ portfolios, brokers, initialPortfolioId }: ImportActivityClientProps) {
  const initialPick =
    initialPortfolioId && portfolios.some((p) => p.id === initialPortfolioId)
      ? initialPortfolioId
      : (portfolios[0]?.id ?? "");
  const [portfolioId, setPortfolioId] = useState(initialPick);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [brokerCsv, setBrokerCsv] = useState("");
  const [brokerKind, setBrokerKind] = useState<string>(() => resolveDefaultBrokerId(brokers));
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreviewAccount[] | null>(null);
  /** Per preview row: whether to include this broker account when running import (default all true after preview). */
  const [importRowSelected, setImportRowSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<BrokerApplyRow[] | null>(null);
  const [taskOutput, setTaskOutput] = useState<string | null>(null);
  const [cleanBusy, setCleanBusy] = useState(false);

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

  useEffect(() => {
    if (!brokers.some((broker) => broker.id === brokerKind)) {
      setBrokerKind(resolveDefaultBrokerId(brokers));
    }
  }, [brokers, brokerKind]);
  const orderedBrokers = useMemo(() => orderBrokersForImport(brokers), [brokers]);

  const fidelityDetectedFileKind = useMemo((): "activities" | "portfolio_holdings" | "legacy_positions" | null => {
    if (brokerKind !== "fidelity" || !brokerCsv.trim()) {
      return null;
    }
    if (detectFidelityActivitiesCsv(brokerCsv)) {
      return "activities";
    }
    if (detectFidelityPortfolioHoldingsCsv(brokerCsv)) {
      return "portfolio_holdings";
    }
    return "legacy_positions";
  }, [brokerKind, brokerCsv]);
  const selectedBroker = useMemo(
    () => brokers.find((broker) => broker.id === brokerKind) ?? null,
    [brokers, brokerKind]
  );
  const brokerImportSupported = SUPPORTED_IMPORT_BROKERS.has(brokerKind);

  const someImportRowSelected = useMemo(() => {
    if (!brokerPreview?.length) {
      return false;
    }
    return brokerPreview.some((row) => importRowSelected[brokerImportPreviewRowKey(row)] === true);
  }, [brokerPreview, importRowSelected]);

  const findAccountByExternalRef = (accountRef: string): AccountRow | undefined => {
    const ref = accountRef.trim();
    if (!ref) {
      return undefined;
    }
    return accounts.find(
      (a) =>
        brokerExportRefMatchesStoredExt(ref, (a.extAccountId || "").trim()) &&
        (a.type ?? "") === brokerKind
    );
  };

  const runPreview = async () => {
    if (!portfolioId) {
      setMessage("Select a portfolio before running preview.");
      return;
    }
    if (!brokerCsv.trim()) {
      setMessage("Add a broker CSV file before running preview.");
      return;
    }
    if (!brokerImportSupported) {
      setMessage(
        `${selectedBroker?.name ?? brokerKind} import is not available yet. Choose Merrill or Fidelity for now.`
      );
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
            dryRun: true
          })
        })
      );
      if (!payload.accounts?.length) {
        throw new Error("No broker accounts were detected in this file.");
      }
      setBrokerPreview(payload.accounts);
      setImportRowSelected(
        Object.fromEntries(payload.accounts.map((row) => [brokerImportPreviewRowKey(row), true]))
      );
      setMessage(
        `Preview complete: ${payload.accounts.length} broker account(s) detected. Toggle Import for each row, then run import.`
      );
    } catch (e) {
      setBrokerPreview(null);
      setImportRowSelected({});
      setMessage(e instanceof Error ? e.message : "Preview failed. Review file format and try again.");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!portfolioId) {
      setMessage("Select a portfolio before running import.");
      return;
    }
    if (!brokerCsv.trim()) {
      setMessage("Add a broker CSV file before running import.");
      return;
    }
    if (!brokerImportSupported) {
      setMessage(
        `${selectedBroker?.name ?? brokerKind} import is not available yet. Choose Merrill or Fidelity for now.`
      );
      return;
    }
    if (brokerPreview?.length) {
      const enabledRows = brokerPreview.filter((row) => importRowSelected[brokerImportPreviewRowKey(row)] === true);
      if (enabledRows.length === 0) {
        setMessage("Turn on Import for at least one account row in the preview table, or run preview again.");
        return;
      }
      const missing = enabledRows
        .filter((row) => !findAccountByExternalRef(row.accountRef)?._id)
        .map((row) => row.accountRef || "(blank)");
      if (missing.length > 0) {
        setMessage(
          `Import blocked: ${missing.length} selected broker account ref(s) do not match account external refs in this portfolio. Missing: ${missing.join(", ")}`
        );
        return;
      }
    }
    const mappings =
      brokerPreview?.length
        ? Object.fromEntries(
            brokerPreview.flatMap((row) => {
              if (importRowSelected[brokerImportPreviewRowKey(row)] !== true) {
                return [];
              }
              const key = brokerImportPreviewRowKey(row);
              const matched = findAccountByExternalRef(row.accountRef)?._id;
              return matched ? [[key, matched] as const] : [];
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
            dryRun: false
          })
        })
      );
      setResults(payload.data.results ?? []);
      setTaskOutput(payload.data.taskOutput);
      setMessage(
        payload.data.status === "success"
          ? "Import complete. Positions were updated for mapped accounts."
          : "Import completed with exceptions. Review the summary below."
      );
      void loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed. Review input and retry.");
    } finally {
      setBusy(false);
    }
  };

  const runCleanFirstThenImport = async () => {
    if (!portfolioId) {
      setMessage("Select a portfolio before running clean.");
      return;
    }
    const bookName = portfolios.find((p) => p.id === portfolioId)?.name ?? "this portfolio";
    const warn1 = [
      `Clean "${bookName}" before a fresh import?`,
      "",
      "This permanently deletes:",
      "• Every stock, option, and cash position in ALL accounts in this portfolio",
      "• All broker import job records (staged CSVs and results) for this portfolio",
      "• Any pending sync-broker import tasks tied to this portfolio",
      "",
      "Your accounts, watchlists, and the portfolio itself are NOT removed.",
      "",
      "This action cannot be undone."
    ].join("\n");
    if (!window.confirm(warn1)) {
      return;
    }
    if (
      !window.confirm(
        "Final confirmation: delete all holdings and import activity for the selected portfolio now."
      )
    ) {
      return;
    }
    setCleanBusy(true);
    setMessage(null);
    try {
      const payload = await parseJson<{
        data: {
          positionsDeleted: number;
          importJobsDeleted: number;
          syncTasksDeleted: number;
        };
      }>(
        await fetch("/api/import/broker/clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ portfolioId })
        })
      );
      const d = payload.data;
      setBrokerPreview(null);
      setImportRowSelected({});
      setResults(null);
      setTaskOutput(null);
      setMessage(
        `Clean completed. Removed ${d.positionsDeleted} position row(s), ${d.importJobsDeleted} import job(s), and ${d.syncTasksDeleted} sync task(s). You can now upload CSV and run preview/import.`
      );
      void loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Clean failed. Retry after confirming portfolio scope.");
    } finally {
      setCleanBusy(false);
    }
  };

  return (
    <div className="grid w-full gap-2">
      <section
        className="mt-2 mb-0 text-xs leading-snug text-[var(--xf-text-300)]"
        aria-label="Import workflow guidance"
      >
        <p className="m-0 font-semibold text-[var(--xf-text-100)]">Import broker holdings and activities</p>
        <p className="mt-1.5 mb-2 text-xs leading-snug text-[var(--xf-text-300)]">
          Upload CSV exports from your broker to refresh your workspace portfolio. This flow updates
          portfolio-level risk context used by xOptions scanners and desk monitoring.
        </p>
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--xf-text-300)]">
          Supported files
        </p>
        <ul className="mt-1 mb-2 list-disc space-y-1 pl-5 text-xs text-[var(--xf-text-300)]">
          <li>Portfolio holdings (multi-account positions export)</li>
          <li>Accounts History (activity ledger)</li>
          <li>Legacy single-account Positions CSV</li>
        </ul>
        <p className="m-0 text-xs leading-snug text-[var(--xf-text-300)]">
          Account numbers in the broker file must exactly match each account&apos;s external ref in this portfolio.
          After preview, use the <strong className="text-[var(--xf-text-100)]">Import</strong> checkboxes to choose which
          broker accounts to load; only selected rows are written. Preview shows file impact only.
        </p>
        <p className="mt-2 mb-0 text-xs leading-snug text-[var(--xf-text-300)]">
          <strong className="text-[var(--xf-text-100)]">Options note:</strong> only net-long option legs are imported
          right now; net-short legs are skipped until short modeling is enabled.
        </p>
      </section>

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
              setImportRowSelected({});
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
                    <td className="p-2 font-mono">{maskAccountXrefForDisplay((a.extAccountId || "").trim())}</td>
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

      {portfolioId ? (
        <div
          className="rounded-md border border-red-500/40 bg-red-950/25 p-3 text-sm text-[var(--xf-text-200)]"
          role="region"
          aria-label="Destructive clean before import"
        >
          <p className="m-0 font-semibold text-red-200/95">Clean first, then import</p>
          <p className="mt-1.5 mb-2 text-xs leading-snug text-[var(--xf-text-300)]">
            Use this when you want an empty book before loading a new broker file. It removes{" "}
            <strong className="text-[var(--xf-text-100)]">all positions</strong> in every account in the selected
            portfolio and clears <strong className="text-[var(--xf-text-100)]">broker import jobs</strong> (import
            activity) for that book. Accounts are kept.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-red-500/50 bg-red-900/40 px-3 py-2 text-sm font-medium text-red-100 hover:bg-red-900/55 disabled:pointer-events-none disabled:opacity-50"
            disabled={busy || cleanBusy}
            onClick={() => void runCleanFirstThenImport()}
          >
            <DeleteIcon className="crud-icon h-4 w-4" aria-hidden />
            {cleanBusy ? "Cleaning…" : "Clean first, then import"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <legend className="text-sm">Broker</legend>
          <div className="grid gap-1.5 grid-cols-2 md:grid-cols-4">
            {orderedBrokers.map((broker) => {
              const active = broker.id === brokerKind;
              const supported = SUPPORTED_IMPORT_BROKERS.has(broker.id);
              const capabilityBadges = brokerCapabilityBadges(broker.id);
              return (
                <button
                  key={broker.id}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition ${
                    active
                      ? "border-[var(--xf-gain-green)] bg-[color:color-mix(in_srgb,var(--xf-gain-green)_14%,transparent)]"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                  disabled={busy}
                  onClick={() => {
                    setBrokerKind(broker.id);
                    setBrokerPreview(null);
                    setImportRowSelected({});
                  }}
                  aria-pressed={active}
                  aria-label={`Select broker ${broker.name}`}
                >
                  {broker.iconUrl.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-managed broker icon URL/path
                    <img
                      alt=""
                      className="h-4 w-4 rounded border border-white/10 object-contain"
                      src={broker.iconUrl}
                    />
                  ) : (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-white/10 font-mono text-[8px] uppercase text-[var(--xf-text-300)]">
                      {broker.id.slice(0, 2)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold text-[var(--xf-text-100)]">{broker.name}</span>
                    <span className="block truncate font-mono text-[9px] text-[var(--xf-text-300)]">
                      {broker.id}
                      {!supported ? " · coming soon" : ""}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-0.5">
                      {capabilityBadges.map((badge) => (
                        <span
                          key={`${broker.id}-${badge}`}
                          className="inline-flex items-center rounded border border-white/10 bg-black/25 px-1 py-0 text-[8px] font-medium text-[var(--xf-text-300)]"
                        >
                          {badge}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
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

      {!brokerImportSupported ? (
        <p className="text-xs text-[var(--xf-text-300)]">
          {selectedBroker?.name ?? brokerKind} imports are not enabled yet for app-user CSV ingest. Current supported
          brokers: Merrill and Fidelity.
        </p>
      ) : null}

      {brokerKind === "fidelity" ? (
        <div
          className="rounded-md border border-white/10 bg-black/15 p-3 text-xs leading-relaxed text-[var(--xf-text-200)]"
          role="note"
        >
          <p className="m-0">
            <strong className="text-[var(--xf-text-100)]">Fidelity workflow:</strong> export and import{" "}
            <strong>Portfolio holdings</strong> (positions snapshot) first, then <strong>Accounts History</strong> when you
            need trades merged into existing holdings. The server chooses the parser from the CSV header (
            <code className="font-mono">Account Number</code> + <code className="font-mono">Symbol</code> for positions vs{" "}
            <code className="font-mono">Run Date</code> for activities).
          </p>
          {fidelityDetectedFileKind === "portfolio_holdings" ? (
            <p className="mt-2 mb-0 text-[var(--xf-gain-green)]">
              Detected: Portfolio holdings — account numbers in the file map to each account&apos;s ext ref.
            </p>
          ) : null}
          {fidelityDetectedFileKind === "activities" ? (
            <p className="mt-2 mb-0 text-[var(--xf-gain-green)]">
              Detected: Accounts History — on import, transactions replay onto current positions (import portfolio holdings
              first for a full baseline).
            </p>
          ) : null}
          {fidelityDetectedFileKind === "legacy_positions" ? (
            <p className="mt-2 mb-0 text-[var(--xf-text-300)]">
              Detected: legacy Positions export (Symbol is the first column). If there is no account column, set a default
              account ref for the book.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--xf-radius-sm)] border border-[color:color-mix(in_srgb,var(--xf-text-100)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--xf-text-100)] transition hover:bg-[color:color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] disabled:pointer-events-none disabled:opacity-50"
          disabled={busy || !portfolioId || !brokerImportSupported}
          onClick={() => void runPreview()}
        >
          <UploadIcon className="crud-icon h-4 w-4" /> Preview (dry run)
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--xf-gain-green)] px-3 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
          disabled={
            busy || !portfolioId || !brokerPreview?.length || !brokerImportSupported || !someImportRowSelected
          }
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
                <th className="p-2 w-16 text-center" scope="col">
                  Import
                </th>
                <th className="p-2">Broker ref</th>
                <th className="p-2">Stocks</th>
                <th className="p-2">Sample</th>
                <th className="p-2">Maps to</th>
              </tr>
            </thead>
            <tbody>
              {brokerPreview.map((row, idx) => {
                const m = findAccountByExternalRef(row.accountRef);
                const rowKey = brokerImportPreviewRowKey(row);
                return (
                  <tr key={`${rowKey}-${idx}`} className="border-b border-white/5">
                    <td className="p-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--xf-gain-green)]"
                        checked={importRowSelected[rowKey] === true}
                        onChange={(e) => {
                          setImportRowSelected((prev) => ({ ...prev, [rowKey]: e.target.checked }));
                        }}
                        aria-label={`Include broker account ${row.label || row.accountRef || "row"} in import`}
                      />
                    </td>
                    <td
                      className="p-2 font-mono"
                      title="Matching uses the full broker account id from your file; preview shows last four digits only."
                    >
                      {maskAccountXrefForDisplay(row.accountRef)}
                    </td>
                    <td className="p-2">{row.stockCount}</td>
                    <td className="p-2 font-mono">{row.sampleTickers.join(", ")}</td>
                    <td className="p-2">
                      {m ? (
                        <>
                          {m.name}
                          <span className="ml-1 font-mono text-[var(--xf-text-400)]">
                            {maskAccountXrefForDisplay(m.extAccountId)}
                          </span>
                        </>
                      ) : (
                        "— no match —"
                      )}
                    </td>
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
