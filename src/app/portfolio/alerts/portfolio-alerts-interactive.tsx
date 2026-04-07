"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";

import { PortfolioAlertsToolbar } from "@/app/portfolio/alerts/portfolio-alerts-toolbar";
import { formatPortfolioAlertBodyForDisplay } from "@/lib/portfolio-alert-display";
import {
    alertDteBucket,
    extractAlertQuantSnippet,
    inferAlertRiskKind,
    isOptionStyleAlert,
    parseAlertDte,
    type AlertDteBucketId,
    type AlertRiskKind
} from "@/lib/portfolio-alert-insights";

export type PortfolioAlertRowVm = {
  id: string;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  status: string;
  symbol: string | null;
  portfolioName: string | null;
  accountId: string | null;
  accountName: string | null;
  accountType: string | null;
  createdAt: string;
  updatedAt: string;
};

type PreviewKind = "close" | "roll30" | "rollStrike";

const DTE_LABELS: Record<AlertDteBucketId, string> = {
  "0-7": "0–7 DTE",
  "8-21": "8–21 DTE",
  "22-45": "22–45 DTE",
  "46+": "46+ DTE",
  unknown: "DTE unknown"
};

const RISK_LABELS: Record<AlertRiskKind, string> = {
  exit_pressure: "Exit / close pressure",
  income_theta: "Income / theta",
  price_move: "Price move",
  general: "Other"
};

function severityRowClass(sev: string): string {
  if (sev === "critical") {
    return "portfolio-alerts-table__row--critical";
  }
  if (sev === "warning") {
    return "portfolio-alerts-table__row--warn";
  }
  return "portfolio-alerts-table__row--info";
}

function buildActionPreview(kind: PreviewKind, row: PortfolioAlertRowVm): string {
  const sym = row.symbol ?? "this underlying";
  const dte = parseAlertDte(row.body, row.title);
  const dteBit = dte !== null ? ` Current leg ~${dte} DTE.` : "";
  switch (kind) {
    case "close":
      return `Close — ${sym}:${dteBit} Plan an exit at the next liquid session; size vs open risk and confirm fills with your broker. Not financial advice.`;
    case "roll30":
      return `Roll ~30 DTE — ${sym}:${dteBit} Target a cycle near 30 days out to reset theta; check earnings and open interest before anchoring strikes. Not financial advice.`;
    case "rollStrike":
      return `Roll & adjust strike — ${sym}:${dteBit} Roll forward and nudge strike ~2–5 Δ to rebalance premium vs assignment risk (verify chain quotes). Not financial advice.`;
    default:
      return "";
  }
}

const PREVIEW_TITLES: Record<PreviewKind, string> = {
  close: "Close leg",
  roll30: "Roll ~30 DTE",
  rollStrike: "Roll & adjust strike"
};

export function PortfolioAlertsInteractive(props: {
  portfolioId: string;
  portfolioName: string;
  rows: PortfolioAlertRowVm[];
}) {
  const { portfolioId, portfolioName, rows } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<{ kind: PreviewKind; title: string; body: string } | null>(null);

  const [accountType, setAccountType] = useState<string>("all");
  const [dteBucket, setDteBucket] = useState<AlertDteBucketId | "all">("all");
  const [riskKind, setRiskKind] = useState<AlertRiskKind | "all">("all");
  const [symbol, setSymbol] = useState<string>("all");

  const accountTypes = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.accountType?.trim()) {
        s.add(r.accountType.trim().toLowerCase());
      }
    }
    return [...s].sort();
  }, [rows]);

  const symbols = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.symbol?.trim()) {
        s.add(r.symbol.trim().toUpperCase());
      }
    }
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (accountType !== "all") {
        const t = (r.accountType ?? "").trim().toLowerCase();
        if (t !== accountType) {
          return false;
        }
      }
      if (dteBucket !== "all") {
        const b = alertDteBucket(parseAlertDte(r.body, r.title));
        if (b !== dteBucket) {
          return false;
        }
      }
      if (riskKind !== "all") {
        if (inferAlertRiskKind(r.severity, r.body, r.title) !== riskKind) {
          return false;
        }
      }
      if (symbol !== "all") {
        const sy = (r.symbol ?? "").trim().toUpperCase();
        if (sy !== symbol) {
          return false;
        }
      }
      return true;
    });
  }, [rows, accountType, dteBucket, riskKind, symbol]);

  const summary = useMemo(() => {
    const warnings = rows.filter((r) => r.severity === "warning").length;
    const critical = rows.filter((r) => r.severity === "critical").length;
    const syms = new Set(rows.map((r) => (r.symbol ?? "").trim().toUpperCase()).filter(Boolean));
    const accounts = new Set(
      rows.map((r) => (r.accountName ?? "").trim()).filter(Boolean)
    );
    return {
      total: rows.length,
      warnings,
      critical,
      symbolCount: syms.size,
      accountCount: accounts.size,
      activeOptionSignals: rows.filter((r) => isOptionStyleAlert(r.title, r.body)).length
    };
  }, [rows]);

  const filtersActive =
    accountType !== "all" || dteBucket !== "all" || riskKind !== "all" || symbol !== "all";

  const resetFilters = useCallback(() => {
    setAccountType("all");
    setDteBucket("all");
    setRiskKind("all");
    setSymbol("all");
  }, []);

  const openPreview = useCallback((kind: PreviewKind, row: PortfolioAlertRowVm) => {
    setPreview({
      kind,
      title: PREVIEW_TITLES[kind],
      body: buildActionPreview(kind, row)
    });
    dialogRef.current?.showModal();
  }, []);

  const xoptionsHref = `/xoptions?portfolioId=${encodeURIComponent(portfolioId)}`;

  return (
    <>
      <section className="portfolio-alerts-summary" aria-label="Portfolio alert impact">
        <div className="portfolio-alerts-summary__grid">
          <div className="portfolio-alerts-summary__tile">
            <span className="portfolio-alerts-summary__value">{summary.total}</span>
            <span className="portfolio-alerts-summary__label">Open alerts</span>
          </div>
          <div className="portfolio-alerts-summary__tile portfolio-alerts-summary__tile--warn">
            <span className="portfolio-alerts-summary__value">{summary.warnings}</span>
            <span className="portfolio-alerts-summary__label">Warnings</span>
          </div>
          <div className="portfolio-alerts-summary__tile portfolio-alerts-summary__tile--crit">
            <span className="portfolio-alerts-summary__value">{summary.critical}</span>
            <span className="portfolio-alerts-summary__label">Critical</span>
          </div>
          <div className="portfolio-alerts-summary__tile">
            <span className="portfolio-alerts-summary__value">{summary.symbolCount}</span>
            <span className="portfolio-alerts-summary__label">Symbols touched</span>
          </div>
          <div className="portfolio-alerts-summary__tile">
            <span className="portfolio-alerts-summary__value">{summary.accountCount}</span>
            <span className="portfolio-alerts-summary__label">Accounts named</span>
          </div>
          <div className="portfolio-alerts-summary__tile portfolio-alerts-summary__tile--gain">
            <span className="portfolio-alerts-summary__value">{summary.activeOptionSignals}</span>
            <span className="portfolio-alerts-summary__label">Option signals</span>
          </div>
        </div>
        <p className="portfolio-alerts-summary__book">
          Book <strong>{portfolioName}</strong>
          {filtersActive ? (
            <>
              {" "}
              · showing <strong>{filtered.length}</strong> of {rows.length}
            </>
          ) : null}
        </p>
      </section>

      <PortfolioAlertsToolbar alertCount={rows.length} portfolioId={portfolioId} />

      {rows.length > 0 ? (
        <div className="portfolio-alerts-filters" role="search" aria-label="Filter alerts">
          <label className="portfolio-alerts-filters__field">
            <span className="portfolio-alerts-filters__label">Account type</span>
            <select
              className="portfolio-alerts-filters__select"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="all">All types</option>
              {accountTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="portfolio-alerts-filters__field">
            <span className="portfolio-alerts-filters__label">DTE bucket</span>
            <select
              className="portfolio-alerts-filters__select"
              value={dteBucket}
              onChange={(e) => setDteBucket(e.target.value as AlertDteBucketId | "all")}
            >
              <option value="all">All DTE</option>
              {(Object.keys(DTE_LABELS) as AlertDteBucketId[]).map((k) => (
                <option key={k} value={k}>
                  {DTE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="portfolio-alerts-filters__field">
            <span className="portfolio-alerts-filters__label">Risk type</span>
            <select
              className="portfolio-alerts-filters__select"
              value={riskKind}
              onChange={(e) => setRiskKind(e.target.value as AlertRiskKind | "all")}
            >
              <option value="all">All risks</option>
              {(Object.keys(RISK_LABELS) as AlertRiskKind[]).map((k) => (
                <option key={k} value={k}>
                  {RISK_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="portfolio-alerts-filters__field">
            <span className="portfolio-alerts-filters__label">Symbol</span>
            <select
              className="portfolio-alerts-filters__select"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              <option value="all">All symbols</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {filtersActive ? (
            <button type="button" className="portfolio-alerts-filters__reset" onClick={resetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="status-text portfolio-alerts-console__empty">No alerts for this portfolio yet.</p>
      ) : filtered.length === 0 ? (
        <p className="status-text portfolio-alerts-console__empty">
          No alerts match these filters.{" "}
          <button type="button" className="portfolio-alerts-filters__reset-inline" onClick={resetFilters}>
            Reset filters
          </button>
        </p>
      ) : (
        <div
          className="portfolio-alerts-table-scroll"
          role="region"
          aria-label={`Alerts table, ${filtered.length} row${filtered.length === 1 ? "" : "s"}`}
        >
          <table className="portfolio-alerts-table">
            <caption className="portfolio-alerts-table__caption">
              Desk and scanner alerts for {portfolioName}
            </caption>
            <thead className="portfolio-alerts-table__head">
              <tr>
                <th scope="col">Book · Account</th>
                <th scope="col">Alert</th>
                <th scope="col">Symbol</th>
                <th scope="col">Level · signal</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col">Suggested actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sevClass = severityRowClass(r.severity);
                const snippet = extractAlertQuantSnippet(r.body, r.title);
                const optionRow = isOptionStyleAlert(r.title, r.body);
                const created = new Date(r.createdAt);
                const updated = new Date(r.updatedAt);
                return (
                  <Fragment key={r.id}>
                    <tr className={`portfolio-alerts-table__row ${sevClass}`}>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--book">
                        <span className="portfolio-alerts-table__book-name">
                          {r.portfolioName?.trim() || portfolioName}
                        </span>
                        <span className="portfolio-alerts-table__book-sep" aria-hidden>
                          {" · "}
                        </span>
                        <span className="portfolio-alerts-table__account-name">
                          {r.accountName?.trim() || "—"}
                        </span>
                        {r.accountType ? (
                          <span className="portfolio-alerts-table__account-type">{r.accountType}</span>
                        ) : null}
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--title">
                        <span className="portfolio-alerts-table__title-text">{r.title}</span>
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--symbol">
                        {r.symbol ? (
                          <span className="portfolio-alerts-pill portfolio-alerts-pill--sym">{r.symbol}</span>
                        ) : (
                          <span className="portfolio-alerts-table__dash" aria-label="No symbol">
                            —
                          </span>
                        )}
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--level">
                        <div className="portfolio-alerts-level-stack">
                          <span
                            className={`portfolio-alerts-pill portfolio-alerts-pill--severity portfolio-alerts-pill--sev-${r.severity}`}
                          >
                            {r.severity}
                          </span>
                          <span className="portfolio-alerts-quant-snippet" title={snippet}>
                            {snippet}
                          </span>
                        </div>
                      </td>
                      <td className="portfolio-alerts-table__cell">
                        <span className="portfolio-alerts-pill portfolio-alerts-pill--status">{r.status}</span>
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--time">
                        <time dateTime={updated.toISOString()} title={created.toISOString()}>
                          {updated.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit"
                          })}
                        </time>
                        <span className="portfolio-alerts-table__created-hint" title={created.toISOString()}>
                          {" "}
                          · created {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--actions">
                        {optionRow ? (
                          <div className="portfolio-alerts-actions">
                            <button
                              type="button"
                              className="portfolio-alerts-actions__btn"
                              onClick={() => openPreview("close", r)}
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              className="portfolio-alerts-actions__btn"
                              onClick={() => openPreview("roll30", r)}
                            >
                              Roll 30 DTE
                            </button>
                            <button
                              type="button"
                              className="portfolio-alerts-actions__btn"
                              onClick={() => openPreview("rollStrike", r)}
                            >
                              Roll &amp; adjust strike
                            </button>
                          </div>
                        ) : (
                          <span className="portfolio-alerts-table__dash">—</span>
                        )}
                      </td>
                    </tr>
                    {r.body ? (
                      <tr className={`portfolio-alerts-table__detail ${sevClass}`}>
                        <td className="portfolio-alerts-table__rationale" colSpan={7}>
                          {formatPortfolioAlertBodyForDisplay(r.body)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog ref={dialogRef} className="portfolio-alerts-preview-dialog" onClose={() => setPreview(null)}>
        {preview ? (
          <div className="portfolio-alerts-preview-dialog__inner">
            <h2 className="portfolio-alerts-preview-dialog__title">{preview.title}</h2>
            <p className="portfolio-alerts-preview-dialog__body">{preview.body}</p>
            <div className="portfolio-alerts-preview-dialog__footer">
              <Link className="portfolio-alerts-preview-dialog__link" href={xoptionsHref}>
                Open xOptions
              </Link>
              <button
                type="button"
                className="portfolio-alerts-preview-dialog__close"
                onClick={() => dialogRef.current?.close()}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
