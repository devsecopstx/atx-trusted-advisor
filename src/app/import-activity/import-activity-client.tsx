"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DeleteIcon, UploadIcon } from "@/app/admin/ui/crud-icons";
import { accountRefLastFourOnlyDisplay } from "@/lib/account-xref-display";
import { brokerExportRefMatchesStoredExt } from "@/lib/broker-account-ref-match";
import { detectFidelityActivitiesCsv } from "@/modules/portfolio-import/fidelity-activities-csv";
import { detectFidelityPortfolioHoldingsCsv } from "@/modules/portfolio-import/fidelity-holdings-csv";

import { importActivityWorkflowCopy } from "./import-activity-copy";

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
  estimatedBalanceUsd: number;
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

function formatUsdDryRun(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

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
  /** Per portfolio account (`_id`): when false, that account is ignored for CSV→account mapping and import. */
  const [accountUseForImport, setAccountUseForImport] = useState<Record<string, boolean>>({});
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
    setAccountUseForImport((prev) => {
      const validIds = new Set(
        accounts.map((a) => a._id).filter((id): id is string => Boolean(id && id.trim()))
      );
      const next: Record<string, boolean> = {};
      for (const id of validIds) {
        next[id] = prev[id] !== false;
      }
      return next;
    });
  }, [accounts]);

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

  const somePortfolioAccountEligible = useMemo(
    () => accounts.some((a) => Boolean(a._id?.trim()) && accountUseForImport[a._id!] !== false),
    [accounts, accountUseForImport]
  );

  const findAccountByExternalRef = (accountRef: string): AccountRow | undefined => {
    const ref = accountRef.trim();
    if (!ref) {
      return undefined;
    }
    return accounts.find(
      (a) =>
        Boolean(a._id?.trim()) &&
        accountUseForImport[a._id!] !== false &&
        brokerExportRefMatchesStoredExt(ref, (a.extAccountId || "").trim()) &&
        (a.type ?? "") === brokerKind
    );
  };

  const formatRefForUserMessage = (ref: string): string => {
    const t = ref.trim();
    if (!t) {
      return "(blank)";
    }
    return accountRefLastFourOnlyDisplay(t);
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
        `Preview complete: ${payload.accounts.length} broker account(s). Each row shows stocks / options / cash to import, estimated balance (dry run), and account mapping. Toggle Import, then run import.`
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
      if (!somePortfolioAccountEligible) {
        setMessage(
          'Turn on "Use for import" for at least one portfolio account in the list above, or run preview again.'
        );
        return;
      }
      const enabledRows = brokerPreview.filter((row) => importRowSelected[brokerImportPreviewRowKey(row)] === true);
      if (enabledRows.length === 0) {
        setMessage("Turn on Import for at least one account row in the preview table, or run preview again.");
        return;
      }
      const missing = enabledRows
        .filter((row) => !findAccountByExternalRef(row.accountRef)?._id)
        .map((row) => formatRefForUserMessage(row.accountRef || ""));
      if (missing.length > 0) {
        setMessage(
          `Import blocked: ${missing.length} selected broker row(s) do not match an eligible portfolio account (last 4 shown): ${missing.join(", ")}`
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
    <div className="import-activity grid w-full gap-3">
      <section
        className="import-activity__workflow-card mt-1 mb-0 text-xs leading-snug import-activity__text-secondary"
        aria-label="Import workflow guidance"
      >
        <h2 className="m-0 text-xs font-semibold text-[var(--xf-text-100)]">
          {importActivityWorkflowCopy.supportedFilesHeading}
        </h2>
        <ul className="mt-1 mb-3 list-disc space-y-1 pl-5 text-xs import-activity__text-secondary">
          {importActivityWorkflowCopy.supportedFiles.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h2 className="m-0 text-xs font-semibold text-[var(--xf-text-100)]">
          {importActivityWorkflowCopy.howToHeading}
        </h2>
        <div className="mt-1 mb-3 space-y-1.5 text-xs leading-snug import-activity__text-secondary">
          {importActivityWorkflowCopy.howToSteps.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>
        <h2 className="m-0 text-xs font-semibold text-[var(--xf-text-100)]">
          {importActivityWorkflowCopy.optionsHeading}
        </h2>
        <p className="mt-1 mb-0 text-xs leading-snug import-activity__text-secondary">
          {importActivityWorkflowCopy.optionsBody}
        </p>
      </section>

      {portfolios.length === 0 ? (
        <p className="text-sm import-activity__text-secondary">No portfolios yet — create one from Portfolios first.</p>
      ) : (
        <label className="flex flex-col gap-1 text-sm text-[var(--xf-text-100)]">
          <span>Portfolio</span>
          <select
            className="import-activity__select crud-input rounded-md px-3 py-2 text-sm"
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
        <div className="import-activity__panel">
          <table className="import-activity__table">
            <thead className="import-activity__thead">
              <tr>
                <th className="p-2 w-24 text-center" scope="col">
                  Use for import
                </th>
                <th className="p-2">Account</th>
                <th className="p-2 font-mono">Broker ref (last 4 — full id must match CSV)</th>
              </tr>
            </thead>
            <tbody className="import-activity__tbody">
              {accounts.length > 0 ? (
                accounts.map((a) => {
                  const aid = a._id?.trim() ?? "";
                  const eligible = aid ? accountUseForImport[aid] !== false : true;
                  return (
                    <tr key={a._id ?? a.name} className="import-activity__tr">
                      <td className="p-2 text-center align-middle">
                        {aid ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--xf-gain-green)]"
                            checked={eligible}
                            onChange={(e) => {
                              setAccountUseForImport((prev) => ({ ...prev, [aid]: e.target.checked }));
                            }}
                            aria-label={`Use account ${a.name} for broker import mapping`}
                          />
                        ) : (
                          <span className="import-activity__text-tertiary">—</span>
                        )}
                      </td>
                      <td className="p-2">{a.name}</td>
                      <td
                        className="p-2 font-mono tabular-nums"
                        title="Matching uses your full external ref; only the last four characters are shown here."
                      >
                        {accountRefLastFourOnlyDisplay((a.extAccountId || "").trim())}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="import-activity__tr import-activity__tr--empty">
                  <td colSpan={3} className="p-2 import-activity__text-secondary">
                    No accounts — add accounts under Portfolio for this book.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {portfolioId ? (
        <div className="import-activity__danger" role="region" aria-label="Destructive clean before import">
          <p className="import-activity__danger-title">{importActivityWorkflowCopy.cleanTitle}</p>
          <p className="mt-1.5 mb-2 text-xs leading-snug import-activity__text-secondary">
            {importActivityWorkflowCopy.cleanBody}
          </p>
          <button
            type="button"
            className="import-activity__danger-btn"
            disabled={busy || cleanBusy}
            onClick={() => void runCleanFirstThenImport()}
          >
            <DeleteIcon className="crud-icon h-4 w-4" aria-hidden />
            {cleanBusy ? "Cleaning…" : importActivityWorkflowCopy.cleanTitle}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-[var(--xf-text-100)]">
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
                  className={`import-activity__broker-tile ${active ? "import-activity__broker-tile--active" : ""}`}
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
                    <img alt="" className="import-activity__broker-icon" src={broker.iconUrl} />
                  ) : (
                    <span className="import-activity__broker-fallback">{broker.id.slice(0, 2)}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold text-[var(--xf-text-100)]">{broker.name}</span>
                    <span className="block truncate font-mono text-[9px] import-activity__text-secondary">
                      {broker.id}
                      {!supported ? " · coming soon" : ""}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-0.5">
                      {capabilityBadges.map((badge) => (
                        <span key={`${broker.id}-${badge}`} className="import-activity__broker-badge">
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
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm text-[var(--xf-text-100)]">
          <span>CSV file</span>
          <span className="import-activity__file-shell">
            <input
              type="file"
              accept=".csv,text/csv"
              className="import-activity__file-input text-xs"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then(setBrokerCsv);
              }}
            />
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-[var(--xf-text-100)]">
        <span>CSV contents</span>
        <textarea
          className="import-activity__textarea"
          value={brokerCsv}
          onChange={(e) => setBrokerCsv(e.target.value)}
          disabled={busy}
          placeholder="Paste or load CSV…"
        />
      </label>

      {!brokerImportSupported ? (
        <p className="text-xs import-activity__text-secondary">
          {selectedBroker?.name ?? brokerKind} imports are not enabled yet for app-user CSV ingest. Current supported
          brokers: Merrill and Fidelity.
        </p>
      ) : null}

      {brokerKind === "fidelity" ? (
        <div className="import-activity__note" role="note">
          <p className="m-0">
            <strong className="text-[var(--xf-text-100)]">Fidelity workflow:</strong> export and import{" "}
            <strong>Portfolio holdings</strong> (positions snapshot) first, then <strong>Accounts History</strong> when you
            need trades merged into existing holdings. The server chooses the parser from the CSV header (
            <code className="font-mono">Account Number</code> + <code className="font-mono">Symbol</code> for positions vs{" "}
            <code className="font-mono">Run Date</code> for activities).
          </p>
          {fidelityDetectedFileKind === "portfolio_holdings" ? (
            <p className="import-activity__detect-ok">
              Detected: Portfolio holdings — account numbers in the file map to each account&apos;s ext ref.
            </p>
          ) : null}
          {fidelityDetectedFileKind === "activities" ? (
            <p className="import-activity__detect-ok">
              Detected: Accounts History — on import, transactions replay onto current positions (import portfolio holdings
              first for a full baseline).
            </p>
          ) : null}
          {fidelityDetectedFileKind === "legacy_positions" ? (
            <p className="mt-2 mb-0 import-activity__text-secondary">
              Detected: legacy Positions export (Symbol is the first column). If there is no account column, set a default
              account ref for the book.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="import-activity__actions-row">
        <button
          type="button"
          className="import-activity__btn-secondary"
          disabled={busy || !portfolioId || !brokerImportSupported}
          onClick={() => void runPreview()}
        >
          <UploadIcon className="crud-icon h-4 w-4" /> Preview (dry run)
        </button>
        <button
          type="button"
          className="import-activity__btn-primary"
          disabled={
            busy ||
            !portfolioId ||
            !brokerPreview?.length ||
            !brokerImportSupported ||
            !someImportRowSelected ||
            !somePortfolioAccountEligible
          }
          onClick={() => void runImport()}
        >
          <UploadIcon className="crud-icon h-4 w-4" /> Run import now
        </button>
      </div>

      {message ? <p className="import-activity__status-msg">{message}</p> : null}

      {brokerPreview && brokerPreview.length > 0 ? (
        <div className="import-activity__panel">
          <table className="import-activity__table">
            <thead className="import-activity__thead">
              <tr>
                <th className="p-2 w-16 text-center" scope="col">
                  Import
                </th>
                <th className="p-2">Broker ref</th>
                <th className="p-2" scope="col" title="Position rows to import by type">
                  Stocks / opt / cash
                </th>
                <th className="p-2 text-right" scope="col">
                  Est. value
                  <span className="block font-normal import-activity__text-tertiary">(dry run)</span>
                </th>
                <th className="p-2">Sample</th>
                <th className="p-2">Maps to</th>
              </tr>
            </thead>
            <tbody className="import-activity__tbody">
              {brokerPreview.map((row, idx) => {
                const m = findAccountByExternalRef(row.accountRef);
                const rowKey = brokerImportPreviewRowKey(row);
                return (
                  <tr key={`${rowKey}-${idx}`} className="import-activity__tr">
                    <td className="p-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--xf-gain-green)]"
                        checked={importRowSelected[rowKey] === true}
                        onChange={(e) => {
                          setImportRowSelected((prev) => ({ ...prev, [rowKey]: e.target.checked }));
                        }}
                        aria-label={`Include broker file row ${row.label || accountRefLastFourOnlyDisplay(row.accountRef) || "row"} in import`}
                      />
                    </td>
                    <td
                      className="p-2 font-mono tabular-nums"
                      title="Matching uses the full broker account id from your file; only the last four characters are shown."
                    >
                      {accountRefLastFourOnlyDisplay(row.accountRef)}
                    </td>
                    <td className="p-2 font-mono tabular-nums text-xs" title="Stock rows / option rows / cash (sweep) rows">
                      {row.stockCount} / {row.optionCount} / {row.cashCount}
                    </td>
                    <td
                      className="p-2 text-right font-mono tabular-nums"
                      title="Sum of CSV Current Value per imported row (Fidelity Portfolio); cost/qty fallback otherwise."
                    >
                      {formatUsdDryRun(row.estimatedBalanceUsd)}
                    </td>
                    <td className="p-2 font-mono">{row.sampleTickers.join(", ")}</td>
                    <td className="p-2">
                      {m ? (
                        <>
                          {m.name}
                          <span className="ml-1 font-mono import-activity__text-tertiary tabular-nums">
                            {accountRefLastFourOnlyDisplay(m.extAccountId)}
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
        <div className="import-activity__panel">
          <table className="import-activity__table">
            <thead className="import-activity__thead">
              <tr>
                <th className="p-2">Account</th>
                <th className="p-2">Imported</th>
                <th className="p-2">Skipped</th>
                <th className="p-2">Cleared prior</th>
                <th className="p-2">Error</th>
              </tr>
            </thead>
            <tbody className="import-activity__tbody">
              {results.map((r) => (
                <tr key={r.accountRef} className="import-activity__tr">
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">{r.imported}</td>
                  <td className="p-2">{r.skippedNonStock}</td>
                  <td className="p-2">{r.deletedPrior}</td>
                  <td className="p-2 import-activity__error-cell">{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {taskOutput ? (
        <details className="import-activity__details">
          <summary>Task output</summary>
          <pre>{taskOutput}</pre>
        </details>
      ) : null}
    </div>
  );
}
