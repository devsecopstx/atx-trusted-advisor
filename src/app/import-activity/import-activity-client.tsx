"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UploadIcon } from "@/app/admin/ui/crud-icons";
import { accountRefLastFourOnlyDisplay } from "@/lib/account-xref-display";
import { brokerExportRefMatchesStoredExt } from "@/lib/broker-account-ref-match";
import type { BrokerImportCsvStats, BrokerImportPreviewSampleRow } from "@/modules/portfolio-import/broker-import-dry-run-preview";
import { countCsvNonEmptyLines } from "@/modules/portfolio-import/broker-import-dry-run-preview";
import { brokerImportDryRunResponseSchema } from "@/modules/portfolio-import/broker-import-dry-run-schema";
import { detectFidelityActivitiesCsv } from "@/modules/portfolio-import/fidelity-activities-csv";
import { detectFidelityPortfolioHoldingsCsv } from "@/modules/portfolio-import/fidelity-holdings-csv";

import { importActivityWorkflowCopy } from "./import-activity-copy";
import { brokerImportPreviewRowKey, type BrokerPreviewAccount } from "./import-activity-types";

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
  type?: string;
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
  brokers: ImportActivityBrokerOption[];
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
const PREVIEW_ROW_HEIGHT = 36;

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
      return ["Soon"];
  }
}

function fidelityExportKindLabel(
  brokerKind: string,
  kind: "activities" | "portfolio_holdings" | "legacy_positions" | null
): string {
  if (brokerKind !== "fidelity") {
    return "Holdings";
  }
  if (kind === "activities") {
    return "Accounts History (activity)";
  }
  if (kind === "portfolio_holdings") {
    return "Portfolio holdings";
  }
  if (kind === "legacy_positions") {
    return "Legacy positions";
  }
  return "Holdings";
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
  const [importRowSelected, setImportRowSelected] = useState<Record<string, boolean>>({});
  const [accountUseForImport, setAccountUseForImport] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<BrokerApplyRow[] | null>(null);
  const [taskOutput, setTaskOutput] = useState<string | null>(null);
  const [deleteExistingHoldingsFirst, setDeleteExistingHoldingsFirst] = useState(true);
  const [previewSectionOpen, setPreviewSectionOpen] = useState(false);
  const [previewSampleRows, setPreviewSampleRows] = useState<BrokerImportPreviewSampleRow[]>([]);
  const [previewCsvStats, setPreviewCsvStats] = useState<BrokerImportCsvStats | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [csvZoneFocused, setCsvZoneFocused] = useState(false);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [selectedCsvFileName, setSelectedCsvFileName] = useState("");

  const previewSectionRef = useRef<HTMLDivElement>(null);
  const previewRowsScrollRef = useRef<HTMLDivElement>(null);

  /* eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual */
  const previewRowsVirtualizer = useVirtualizer({
    count: previewSampleRows.length,
    getScrollElement: () => previewRowsScrollRef.current,
    estimateSize: () => PREVIEW_ROW_HEIGHT,
    overscan: 8
  });

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

  const findAccountByExternalRef = useCallback(
    (accountRef: string): AccountRow | undefined => {
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
    },
    [accounts, accountUseForImport, brokerKind]
  );

  const formatRefForUserMessage = (ref: string): string => {
    const t = ref.trim();
    if (!t) {
      return "(blank)";
    }
    return accountRefLastFourOnlyDisplay(t);
  };

  const selectedBrokerAccountCount = useMemo(
    () => accounts.filter((a) => Boolean(a._id?.trim()) && accountUseForImport[a._id!] !== false).length,
    [accounts, accountUseForImport]
  );

  const mappingDiagnostics = useMemo(() => {
    if (!brokerPreview?.length) {
      return { healthy: true, issueLabels: [] as string[] };
    }
    const enabledRows = brokerPreview.filter((row) => importRowSelected[brokerImportPreviewRowKey(row)] === true);
    const issueLabels: string[] = [];
    for (const row of enabledRows) {
      if (!findAccountByExternalRef(row.accountRef)?._id) {
        issueLabels.push(row.label || formatRefForUserMessage(row.accountRef || ""));
      }
    }
    return { healthy: issueLabels.length === 0, issueLabels };
  }, [brokerPreview, importRowSelected, findAccountByExternalRef]);

  const selectedPositionsEstimate = useMemo(() => {
    if (!brokerPreview?.length) {
      return 0;
    }
    return brokerPreview.reduce((sum, row) => {
      if (importRowSelected[brokerImportPreviewRowKey(row)] === true) {
        return sum + row.positionCount;
      }
      return sum;
    }, 0);
  }, [brokerPreview, importRowSelected]);

  const totalPositionsParsed = previewCsvStats?.totalPositionsParsed ?? 0;

  const summaryHeadline = useMemo(() => {
    const brokerName = selectedBroker?.name ?? brokerKind;
    const exportLbl = fidelityExportKindLabel(brokerKind, fidelityDetectedFileKind);
    const replace = deleteExistingHoldingsFirst ? "Full replace (Delete existing holdings = ON)" : "Merge (delete existing = OFF)";
    return `${selectedBrokerAccountCount} account${selectedBrokerAccountCount === 1 ? "" : "s"} mapped • ${brokerName} · ${exportLbl} • ${replace}`;
  }, [
    selectedBroker?.name,
    brokerKind,
    fidelityDetectedFileKind,
    deleteExistingHoldingsFirst,
    selectedBrokerAccountCount
  ]);

  const csvStatusLine = useMemo(() => {
    const lines = previewCsvStats?.nonEmptyLines ?? countCsvNonEmptyLines(brokerCsv);
    const brokerName = selectedBroker?.name ?? brokerKind;
    if (!brokerCsv.trim()) {
      return `Drop or paste a ${brokerName} CSV to continue`;
    }
    if (previewCsvStats && brokerPreview?.length) {
      return `${brokerName} export ready • ${lines} lines • ${previewCsvStats.totalPositionsParsed} positions parsed`;
    }
    return `${brokerName} file loaded • ${lines} lines — run Preview (dry run)`;
  }, [brokerCsv, brokerKind, selectedBroker?.name, previewCsvStats, brokerPreview]);

  const resetPreviewState = useCallback(() => {
    setBrokerPreview(null);
    setImportRowSelected({});
    setPreviewSampleRows([]);
    setPreviewCsvStats(null);
    setPreviewWarnings([]);
    setPreviewSectionOpen(false);
  }, []);

  const executeDryRun = useCallback(
    async (csvText: string, options?: { openPanel?: boolean; silent?: boolean }): Promise<boolean> => {
      const openPanel = options?.openPanel ?? true;
      const silent = options?.silent ?? false;
      if (!portfolioId) {
        if (!silent) {
          setMessage("Select a portfolio before running preview.");
        }
        return false;
      }
      if (!csvText.trim()) {
        if (!silent) {
          setMessage("Add a broker CSV file before running preview.");
        }
        return false;
      }
      if (!brokerImportSupported) {
        if (!silent) {
          setMessage(
            `${selectedBroker?.name ?? brokerKind} import is not available yet. Choose Merrill or Fidelity for now.`
          );
        }
        return false;
      }
      setBusy(true);
      if (!silent) {
        setMessage(null);
      }
      setResults(null);
      setTaskOutput(null);
      try {
        const raw = await parseJson<unknown>(
          await fetch("/api/import/broker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              portfolioId,
              broker: brokerKind,
              exportType: "holdings",
              csv: csvText,
              mappings: {},
              dryRun: true
            })
          })
        );
        const parsed = brokerImportDryRunResponseSchema.safeParse(raw);
        if (!parsed.success) {
          throw new Error("Unexpected preview response from server.");
        }
        const payload = parsed.data;
        if (!payload.accounts?.length) {
          throw new Error("No broker accounts were detected in this file.");
        }
        setBrokerPreview(payload.accounts);
        setImportRowSelected(
          Object.fromEntries(payload.accounts.map((row) => [brokerImportPreviewRowKey(row), true]))
        );
        setPreviewSampleRows(payload.sampleRows);
        setPreviewCsvStats(payload.csvStats);
        setPreviewWarnings(payload.previewWarnings);
        if (openPanel) {
          setPreviewSectionOpen(true);
          queueMicrotask(() => previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
        if (!silent) {
          setMessage(`Preview ready — ${payload.accounts.length} broker account(s). Review the sheet, then apply.`);
        }
        return true;
      } catch (e) {
        resetPreviewState();
        setMessage(e instanceof Error ? e.message : "Preview failed. Review file format and try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      portfolioId,
      brokerImportSupported,
      brokerKind,
      selectedBroker?.name,
      resetPreviewState
    ]
  );

  const runPreview = async () => {
    await executeDryRun(brokerCsv, { openPanel: true, silent: false });
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
        setMessage("Turn on Import for at least one account in the preview sheet, or run preview again.");
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

    if (deleteExistingHoldingsFirst) {
      const bookName = portfolios.find((p) => p.id === portfolioId)?.name ?? "this portfolio";
      const ok = window.confirm(
        [
          `Remove all existing positions and broker-import records for "${bookName}" before applying this file?`,
          "",
          "This deletes every stock, option, and cash position in all accounts in this portfolio.",
          "Accounts, watchlists, and the portfolio itself are not removed.",
          "",
          "This cannot be undone."
        ].join("\n")
      );
      if (!ok) {
        return;
      }
    }

    setBusy(true);
    setMessage(null);
    setResults(null);
    setTaskOutput(null);
    setPreviewSectionOpen(false);
    try {
      if (deleteExistingHoldingsFirst) {
        await parseJson<{
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
        void loadAccounts();
      }

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

  const csvExpanded = csvZoneFocused || brokerCsv.trim().length > 0;
  const hasSelectedCsvFile = selectedCsvFileName.trim().length > 0;
  const hasPreviewRows = previewSampleRows.length > 0;
  const csvRawPreview = useMemo(() => {
    if (!brokerCsv.trim()) {
      return "";
    }
    return brokerCsv.split(/\r?\n/).slice(0, 80).join("\n");
  }, [brokerCsv]);
  const parsedPositionCount = previewCsvStats?.totalPositionsParsed ?? 0;
  const previewHeaderCount = parsedPositionCount > 0 ? parsedPositionCount : previewSampleRows.length;
  const previewCollapsibleLabel = previewSectionOpen ? "Hide parsed positions" : "Show parsed positions";
  const canRunImport =
    !busy &&
    Boolean(
      hasSelectedCsvFile &&
      portfolioId &&
        brokerPreview?.length &&
        brokerImportSupported &&
        someImportRowSelected &&
        somePortfolioAccountEligible &&
        mappingDiagnostics.healthy
    );
  const canRunPreview =
    !busy && Boolean(portfolioId) && brokerImportSupported && hasSelectedCsvFile && brokerCsv.trim().length > 0;

  return (
    <div className="import-activity import-activity--compact flex w-full min-w-0 flex-col gap-3">
      <div className="import-activity__layout-grid">
        <div className="import-activity__primary flex min-w-0 flex-col gap-2.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <section className="import-activity__panel p-2.5 md:p-3" aria-label="Portfolio selection and accounts">
              {portfolios.length === 0 ? (
                <p className="text-xs import-activity__text-secondary mb-2">
                  No portfolios yet — create one from Portfolios first.
                </p>
              ) : (
                <label className="import-activity__inline-field mb-2">
                  <span className="import-activity__section-label">Portfolio</span>
                  <select
                    className="import-activity__select crud-input rounded-md px-2 py-1.5 text-xs"
                    value={portfolioId}
                    onChange={(e) => {
                      setPortfolioId(e.target.value);
                      resetPreviewState();
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
                <div className="import-activity__panel import-activity__panel--tight">
                  <table className="import-activity__table import-activity__table--compact">
                    <thead className="import-activity__thead">
                      <tr>
                        <th className="p-1.5 w-16 text-center text-[0.65rem]" scope="col" title="Use for import">
                          Use
                        </th>
                        <th className="p-1.5 text-[0.65rem]">Account</th>
                        <th className="p-1.5 font-mono text-[0.65rem]">Broker ref (last 4)</th>
                      </tr>
                    </thead>
                    <tbody className="import-activity__tbody">
                      {accounts.length > 0 ? (
                        accounts.map((a) => {
                          const aid = a._id?.trim() ?? "";
                          const eligible = aid ? accountUseForImport[aid] !== false : true;
                          return (
                            <tr key={a._id ?? a.name} className="import-activity__tr">
                              <td className="p-1.5 text-center align-middle">
                                {aid ? (
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-[var(--xf-gain-green)]"
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
                              <td className="p-1.5 text-[0.72rem]">{a.name}</td>
                              <td
                                className="p-1.5 font-mono tabular-nums text-[0.68rem]"
                                title="Matching uses your full external ref; only the last four characters are shown here."
                              >
                                {accountRefLastFourOnlyDisplay((a.extAccountId || "").trim())}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="import-activity__tr import-activity__tr--empty">
                          <td colSpan={3} className="p-1.5 import-activity__text-secondary text-[0.72rem]">
                            No accounts — add accounts under Portfolio for this book.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section className="import-activity__source-panel mb-1.5" aria-label="Broker and CSV import">
            <label className="import-activity__inline-field import-activity__source-panel-broker">
              <span className="import-activity__section-label">Broker</span>
              <select
                className="import-activity__select crud-input w-full rounded-md px-2 py-1.5 text-xs"
                value={brokerKind}
                disabled={busy}
                aria-label="Broker for CSV import"
                onChange={(e) => {
                  setBrokerKind(e.target.value);
                  resetPreviewState();
                }}
              >
                {orderedBrokers.map((broker) => {
                  const supported = SUPPORTED_IMPORT_BROKERS.has(broker.id);
                  const caps = brokerCapabilityBadges(broker.id).join(", ");
                  return (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                      {supported ? ` (${caps})` : " — coming soon"}
                    </option>
                  );
                })}
              </select>
            </label>

            {!brokerImportSupported ? (
              <p className="import-activity__source-panel-warn">
                {selectedBroker?.name ?? brokerKind} import is not enabled yet. Choose Merrill or Fidelity.
              </p>
            ) : null}

            <div
              className={`import-activity__csv-zone import-activity__csv-zone--in-panel ${csvExpanded ? "import-activity__csv-zone--expanded" : ""}`}
              onFocusCapture={() => setCsvZoneFocused(true)}
              onBlurCapture={(e) => {
                const next = e.relatedTarget as Node | null;
                if (next && e.currentTarget.contains(next)) {
                  return;
                }
                setCsvZoneFocused(false);
              }}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const f = ev.dataTransfer.files?.[0];
                if (!f || busy) {
                  return;
                }
                setSelectedCsvFileName(f.name);
                void f.text().then((t) => {
                  setBrokerCsv(t);
                  resetPreviewState();
                  void executeDryRun(t, { openPanel: true, silent: true }).then((ok) => {
                    if (ok) {
                      setMessage("Preview opened from file — confirm mappings, then Apply import.");
                    }
                  });
                });
              }}
            >
              <div className="import-activity__csv-zone-head flex flex-col items-start gap-2">
                <span className="import-activity__section-label m-0">CSV file</span>
                <label className="import-activity__paste-btn w-full md:w-auto">
                  <span className="import-activity__file-shell import-activity__file-shell--inline">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="import-activity__file-input text-[0.65rem]"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setSelectedCsvFileName(f.name);
                        void f.text().then((t) => {
                          setBrokerCsv(t);
                          resetPreviewState();
                          void executeDryRun(t, { openPanel: true, silent: true }).then((ok) => {
                            if (ok) {
                              setMessage("Preview opened from file — confirm mappings, then Apply import.");
                            }
                          });
                        });
                      }}
                    />
                  </span>
                </label>
                <p className="m-0 text-[0.68rem] leading-snug text-[var(--ia-secondary-text)]">
                  Choose file, then click <strong className="text-[var(--xf-text-100)]">Run import now</strong> after
                  selection.
                </p>
                {hasSelectedCsvFile ? (
                  <p className="m-0 text-[0.68rem] leading-snug text-[var(--xf-text-300)]">
                    Selected file: <span className="font-mono text-[var(--xf-text-100)]">{selectedCsvFileName}</span>
                  </p>
                ) : (
                  <p className="m-0 text-[0.68rem] leading-snug text-[var(--xf-text-400)]">No file selected yet.</p>
                )}
                <div className="w-full border-t border-[var(--ia-border)] pt-2" aria-label="Replace holdings before import">
                  <label className="import-activity__delete-first-label">
                    <input
                      type="checkbox"
                      className="import-activity__delete-first-checkbox"
                      checked={deleteExistingHoldingsFirst}
                      onChange={(e) => setDeleteExistingHoldingsFirst(e.target.checked)}
                      disabled={busy}
                      aria-describedby="import-delete-first-hint"
                    />
                    <span>{importActivityWorkflowCopy.deleteHoldingsFirstLabel}</span>
                  </label>
                  <p id="import-delete-first-hint" className="import-activity__delete-first-hint">
                    {importActivityWorkflowCopy.deleteHoldingsFirstHint}
                  </p>
                </div>
              </div>
              <textarea
                className="import-activity__textarea import-activity__textarea--collapsible"
                value={brokerCsv}
                onChange={(e) => {
                  setBrokerCsv(e.target.value);
                  if (!e.target.value.trim()) {
                    setSelectedCsvFileName("");
                  }
                  resetPreviewState();
                }}
                disabled={busy}
                placeholder="Drag & drop a .csv here, choose file, or paste…"
                aria-label="Broker CSV contents"
              />
              <details className="import-activity__workflow-details mt-2">
                <summary className="import-activity__workflow-summary">Raw CSV preview (compact)</summary>
                <div className="import-activity__workflow-inner">
                  {csvRawPreview ? (
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--ia-border)] bg-[var(--ia-field-bg)] p-2 font-mono text-[0.65rem] leading-snug text-[var(--xf-text-100)]">
                      {csvRawPreview}
                    </pre>
                  ) : (
                    <p className="m-0 text-[0.7rem]">Upload or paste CSV content to preview rows here.</p>
                  )}
                </div>
              </details>
            </div>
            </section>
          </div>

          {brokerKind === "fidelity" ? (
            <div className="import-activity__note import-activity__note--tight mb-2" role="note">
              <p className="m-0 text-[0.68rem] leading-snug">
                <strong className="text-[var(--xf-text-100)]">Fidelity:</strong>{" "}
                <strong>Portfolio holdings</strong> snapshot first; <strong>Accounts History</strong> replays onto
                positions. Parser uses headers (<code className="font-mono">Account Number</code> +{" "}
                <code className="font-mono">Symbol</code> vs <code className="font-mono">Run Date</code>).
              </p>
              {fidelityDetectedFileKind === "portfolio_holdings" ? (
                <p className="import-activity__detect-ok text-[0.65rem]">Detected: Portfolio holdings.</p>
              ) : null}
              {fidelityDetectedFileKind === "activities" ? (
                <p className="import-activity__detect-ok text-[0.65rem]">Detected: Accounts History (activity ledger).</p>
              ) : null}
              {fidelityDetectedFileKind === "legacy_positions" ? (
                <p className="mt-1 mb-0 import-activity__text-secondary text-[0.65rem]">
                  Legacy positions export — set default account ref if the file has no account column.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="import-activity__actions-row import-activity__actions-row--tight mb-1 hidden md:flex">
            <button
              type="button"
              className="import-activity__btn-secondary min-h-11 text-[0.8rem] py-2.5"
              disabled={!canRunPreview}
              onClick={() => void runPreview()}
            >
              <UploadIcon className="crud-icon h-3.5 w-3.5" /> Preview (dry run)
            </button>
            <button
              type="button"
              className="import-activity__btn-primary min-h-11 text-[0.8rem] py-2.5"
              disabled={!canRunImport}
              onClick={() => void runImport()}
            >
              <UploadIcon className="crud-icon h-3.5 w-3.5" /> Run import now
            </button>
            {brokerPreview?.length ? (
              <button
                type="button"
                className="import-activity__btn-secondary min-h-11 text-[0.8rem] py-2.5"
                disabled={busy || !hasSelectedCsvFile}
                onClick={() => {
                  setPreviewSectionOpen(true);
                  previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Open preview
              </button>
            ) : null}
          </div>

          {message ? <p className="import-activity__status-msg text-[0.8rem] mb-2">{message}</p> : null}
          <p className="text-[0.72rem] font-medium text-[color:var(--xf-gain-green)]">
            Safe preview — no positions will be changed yet
          </p>

          <details
            className="import-activity__workflow-details mb-2"
            open={workflowExpanded}
            onToggle={(e) => setWorkflowExpanded((e.target as HTMLDetailsElement).open)}
          >
            <summary className="import-activity__workflow-summary">Import reference (expand)</summary>
            <div className="import-activity__workflow-inner">
              <h2 className="import-activity__workflow-h">{importActivityWorkflowCopy.supportedFilesHeading}</h2>
              <ul className="import-activity__workflow-ul">
                {importActivityWorkflowCopy.supportedFiles.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <h2 className="import-activity__workflow-h">{importActivityWorkflowCopy.howToHeading}</h2>
              <div className="import-activity__workflow-steps">
                {importActivityWorkflowCopy.howToSteps.map((line) => (
                  <p key={line} className="import-activity__workflow-step">
                    {line}
                  </p>
                ))}
              </div>
              <h2 className="import-activity__workflow-h">{importActivityWorkflowCopy.optionsHeading}</h2>
              <p className="import-activity__workflow-step m-0">{importActivityWorkflowCopy.optionsBody}</p>
              {brokerPreview?.length ? (
                <>
                  <h2 className="import-activity__workflow-h">Broker ref validation</h2>
                  <ul className="import-activity__workflow-ul">
                    {brokerPreview.map((row) => {
                      const key = brokerImportPreviewRowKey(row);
                      const matched = findAccountByExternalRef(row.accountRef);
                      const on = importRowSelected[key] === true;
                      return (
                        <li key={key}>
                          {row.label || accountRefLastFourOnlyDisplay(row.accountRef)} —{" "}
                          {on ? (matched ? "✓ matched" : "⚠ no portfolio match") : "skipped"}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </div>
          </details>

          {results && results.length > 0 ? (
            <div className="import-activity__panel mb-2">
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
      </div>

      <section
        ref={previewSectionRef}
        className="import-activity__panel p-2.5 md:p-3"
        aria-label="Parsed positions preview"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--xf-text-100)]">Parsed Positions</h2>
            <span className="inline-flex min-h-6 items-center rounded-full border border-[var(--ia-border)] bg-[var(--ia-muted-bg)] px-2 font-mono text-[0.7rem] tabular-nums text-[var(--xf-text-100)]">
              {previewHeaderCount}
            </span>
          </div>
          <button
            type="button"
            className="import-activity__btn-secondary min-h-11 px-3 py-2 text-[0.75rem] md:hidden"
            onClick={() => setPreviewSectionOpen((prev) => !prev)}
            aria-expanded={previewSectionOpen}
            aria-controls="import-activity-parsed-positions"
          >
            {previewCollapsibleLabel}
          </button>
        </div>

        <div className="mt-1.5 import-activity__summary-card">
          <p className="import-activity__summary-headline">{summaryHeadline}</p>
          <p className="import-activity__summary-csv">{csvStatusLine}</p>
          <p className="import-activity__summary-risk">{importActivityWorkflowCopy.optionsBody}</p>
          <div className="import-activity__summary-chips" aria-label="Accounts enabled for import mapping">
            {accounts
              .filter((a) => Boolean(a._id?.trim()) && accountUseForImport[a._id!] !== false)
              .map((a) => (
                <span key={a._id} className="import-activity__summary-chip">
                  {a.name} <span className="font-mono tabular-nums">({accountRefLastFourOnlyDisplay(a.extAccountId)})</span> ✓
                </span>
              ))}
            {selectedBrokerAccountCount === 0 ? (
              <span className="import-activity__text-tertiary text-[0.65rem]">No accounts enabled for import.</span>
            ) : null}
          </div>
        </div>

        <div id="import-activity-parsed-positions" className={previewSectionOpen ? "mt-3 space-y-2" : "mt-3 hidden md:block md:space-y-2"}>
          {!mappingDiagnostics.healthy && mappingDiagnostics.issueLabels.length > 0 ? (
            <p className="import-activity-preview-warn-copy">
              No portfolio match: {mappingDiagnostics.issueLabels.slice(0, 6).join(", ")}
              {mappingDiagnostics.issueLabels.length > 6 ? "…" : ""}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="import-activity-preview-metric">
              <span className="import-activity-preview-metric-label">Positions (parsed)</span>
              <span className="import-activity-preview-metric-value">{totalPositionsParsed}</span>
            </div>
            <div className="import-activity-preview-metric">
              <span className="import-activity-preview-metric-label">Selected for apply</span>
              <span className="import-activity-preview-metric-value">{selectedPositionsEstimate}</span>
            </div>
          </div>
          <p className="import-activity-preview-note">Safe preview — no positions will be changed yet</p>

          {brokerPreview?.length ? (
            <div className="import-activity-preview-account-toggles">
              <span className="import-activity-preview-section-label">Include broker accounts</span>
              <ul className="import-activity-preview-chip-list">
                {brokerPreview.map((row) => {
                  const key = brokerImportPreviewRowKey(row);
                  const on = importRowSelected[key] === true;
                  return (
                    <li key={key}>
                      <label className="import-activity-preview-chip">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            setImportRowSelected((prev) => ({ ...prev, [key]: e.target.checked }));
                          }}
                          className="import-activity-preview-chip-input"
                        />
                        <span>{row.label || row.accountRef}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="import-activity-preview-table-wrap">
            <div className="import-activity-preview-table-header">
              <span className="import-activity-preview-col-account">Account</span>
              <span className="import-activity-preview-col-symbol">Symbol</span>
              <span className="import-activity-preview-col-qty">Qty</span>
              <span className="import-activity-preview-col-num">Avg</span>
              <span className="import-activity-preview-col-num">Last</span>
              <span className="import-activity-preview-col-num">Value</span>
              <span className="import-activity-preview-col-type">Type</span>
            </div>
            <div ref={previewRowsScrollRef} className="import-activity-preview-table-scroll">
              <div
                className="import-activity-preview-table-virtual-inner"
                style={{ height: `${previewRowsVirtualizer.getTotalSize()}px`, position: "relative" }}
              >
                {previewRowsVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = previewSampleRows[virtualRow.index];
                  if (!row) {
                    return null;
                  }
                  return (
                    <div
                      key={virtualRow.key}
                      className="import-activity-preview-table-row"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <span className="import-activity-preview-col-account truncate" title={row.accountLabel}>
                        {row.accountLabel}
                      </span>
                      <span className="import-activity-preview-col-symbol truncate font-mono text-[0.65rem]" title={row.symbol}>
                        {row.symbol}
                      </span>
                      <span className="import-activity-preview-col-qty font-mono tabular-nums">{row.qty}</span>
                      <span className="import-activity-preview-col-num font-mono tabular-nums">{row.avgCost}</span>
                      <span className="import-activity-preview-col-num font-mono tabular-nums">{row.last}</span>
                      <span className="import-activity-preview-col-num font-mono tabular-nums">{row.value}</span>
                      <span className="import-activity-preview-col-type">{row.rowType}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {hasPreviewRows ? (
              <p className="import-activity-preview-sample-foot">
                Showing first {previewSampleRows.length} position row{previewSampleRows.length === 1 ? "" : "s"} (sample).
              </p>
            ) : (
              <p className="import-activity-preview-empty">Run preview to parse positions from your CSV file.</p>
            )}
          </div>

          {previewWarnings.length > 0 ? (
            <ul className="import-activity-preview-warnings">
              {previewWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--ia-border)] bg-[color:color-mix(in_srgb,var(--xf-bg-900)_94%,transparent)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2">
          <button
            type="button"
            className="import-activity__btn-secondary min-h-11 w-full justify-center px-3 py-2.5 text-[0.85rem]"
            disabled={!canRunPreview}
            onClick={() => void runPreview()}
          >
            <UploadIcon className="crud-icon h-4 w-4" /> Preview (dry run)
          </button>
          <button
            type="button"
            className="import-activity__btn-primary min-h-11 w-full justify-center px-3 py-2.5 text-[0.85rem]"
            disabled={!canRunImport}
            onClick={() => void runImport()}
          >
            <UploadIcon className="crud-icon h-4 w-4" /> Run import now
          </button>
          <button
            type="button"
            className="import-activity__btn-secondary min-h-11 w-full justify-center px-3 py-2.5 text-[0.85rem]"
            disabled={busy || !hasSelectedCsvFile || !brokerPreview?.length}
            onClick={() => {
              setPreviewSectionOpen(true);
              previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Open preview
          </button>
        </div>
      </div>
    </div>
  );
}
