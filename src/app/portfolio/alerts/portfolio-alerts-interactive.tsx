"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";

import { PortfolioAlertDetailModal } from "@/app/portfolio/alerts/portfolio-alert-detail-modal";
import { PortfolioAlertsToolbar } from "@/app/portfolio/alerts/portfolio-alerts-toolbar";
import {
    buildActionPreviewLines,
    buildHumanAlertSummary,
    buildRiskPills,
    buildSimulateXoptionsHref,
    classifyAlertSurface,
    dteBadgeTone,
    extractCloseKindFromBody,
    formatContractDeskLabel,
    formatRelativeTime,
    optionPositionLabelFromClose,
    parseContractKey,
    parseContractKeyFromBody,
    scannerRuleLine,
    type ActionPreviewKind,
    type PortfolioAlertRowVm
} from "@/lib/portfolio-alert-desk-present";
import {
    alertDteBucket,
    inferAlertRiskKind,
    isOptionStyleAlert,
    parseAlertDte,
    type AlertDteBucketId,
    type AlertRiskKind
} from "@/lib/portfolio-alert-insights";

export type { PortfolioAlertRowVm } from "@/lib/portfolio-alert-desk-present";

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

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PortfolioAlertsInteractive(props: {
  portfolioId: string;
  portfolioName: string;
  rows: PortfolioAlertRowVm[];
}) {
  const { portfolioId, portfolioName, rows } = props;
  const [detailRow, setDetailRow] = useState<PortfolioAlertRowVm | null>(null);
  const [actionPreview, setActionPreview] = useState<{ kind: ActionPreviewKind; row: PortfolioAlertRowVm } | null>(null);

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
    const accounts = new Set(rows.map((r) => (r.accountName ?? "").trim()).filter(Boolean));
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
          <table className="portfolio-alerts-table portfolio-alerts-table--desk">
            <caption className="portfolio-alerts-table__caption">
              Desk and scanner alerts for {portfolioName}
            </caption>
            <thead className="portfolio-alerts-table__head">
              <tr>
                <th scope="col">Contract / signal</th>
                <th scope="col">Book · account</th>
                <th scope="col">Severity · rule</th>
                <th scope="col">Risks · read</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sevClass = severityRowClass(r.severity);
                const surface = classifyAlertSurface(r.title, r.body);
                const ck = parseContractKeyFromBody(r.body);
                const parsed = ck ? parseContractKey(ck) : null;
                const closeKind = extractCloseKindFromBody(r.body);
                const optionRow = isOptionStyleAlert(r.title, r.body);
                const meta = r.metadata;
                const dte = meta?.metrics.dte ?? parseAlertDte(r.body, r.title);
                const dteTone = dteBadgeTone(dte);
                const pills = buildRiskPills(r.body, r.title, meta);
                const summaryLine = buildHumanAlertSummary(r.body, r.title, meta);
                const previews = buildActionPreviewLines({
                  parsed,
                  closeKind,
                  symbol: r.symbol,
                  metadata: meta
                });
                const updated = new Date(r.updatedAt);
                const created = new Date(r.createdAt);
                const rel = formatRelativeTime(r.updatedAt);
                const contractPrimary =
                  surface === "options_scanner" && parsed
                    ? formatContractDeskLabel(parsed)
                    : scannerRuleLine(r.title);
                const dirBadge =
                  optionRow && parsed && closeKind
                    ? `${optionPositionLabelFromClose(closeKind, parsed.optionType)} · ${closeKind.replace(/_/g, " ")}`
                    : surface === "watchlist_price"
                      ? "Price break"
                      : "Desk";

                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`portfolio-alerts-table__row portfolio-alerts-table__row--clickable ${sevClass}`}
                      tabIndex={0}
                      aria-label={`Open detail for ${contractPrimary}`}
                      onClick={() => setDetailRow(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailRow(r);
                        }
                      }}
                    >
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--contract">
                        <span className="portfolio-alerts-contract__id">{contractPrimary}</span>
                        <span className={`portfolio-alerts-dir-badge portfolio-alerts-dir-badge--${closeKind === "BUY_TO_CLOSE" ? "btc" : closeKind === "SELL_TO_CLOSE" ? "stc" : "na"}`}>
                          {dirBadge}
                        </span>
                      </td>
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
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--sev-rule">
                        <div className="portfolio-alerts-sev-rule">
                          <span
                            className={`portfolio-alerts-pill portfolio-alerts-pill--severity portfolio-alerts-pill--sev-${r.severity}`}
                          >
                            {r.severity}
                          </span>
                          {dte != null ? (
                            <span className={`portfolio-alerts-dte-badge portfolio-alerts-dte-badge--${dteTone}`}>
                              {dte} DTE
                            </span>
                          ) : null}
                          <span className="portfolio-alerts-sev-rule__text">{scannerRuleLine(r.title)}</span>
                        </div>
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--risks">
                        <div className="portfolio-alerts-risk-pill-row">
                          {pills.map((p) => (
                            <span key={p.id} className="portfolio-alerts-risk-pill portfolio-alerts-risk-pill--compact">
                              <span className="portfolio-alerts-risk-pill__k">{p.label}</span>
                              <span className="portfolio-alerts-risk-pill__v">{p.value}</span>
                            </span>
                          ))}
                        </div>
                        <p className="portfolio-alerts-one-liner">{summaryLine}</p>
                      </td>
                      <td className="portfolio-alerts-table__cell">
                        <span className="portfolio-alerts-pill portfolio-alerts-pill--status">{r.status}</span>
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--time">
                        <span className="portfolio-alerts-time__rel">{rel}</span>
                        <time className="portfolio-alerts-time__abs" dateTime={updated.toISOString()} title={created.toISOString()}>
                          {updated.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit"
                          })}
                        </time>
                        <span className="portfolio-alerts-table__created-hint" title={created.toISOString()}>
                          created {created.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="portfolio-alerts-table__cell portfolio-alerts-table__cell--actions">
                        <button
                          type="button"
                          className="portfolio-alerts-view-detail"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailRow(r);
                          }}
                        >
                          View detail
                        </button>
                        {optionRow ? (
                          <div className="portfolio-alerts-actions portfolio-alerts-actions--rich">
                            {(["close", "roll30", "rollStrike"] as const).map((kind) => {
                              const pv = previews[kind];
                              const icon = kind === "close" ? <IconClose className="portfolio-alerts-actions__ico" /> : <IconCalendar className="portfolio-alerts-actions__ico" />;
                              return (
                                <button
                                  key={kind}
                                  type="button"
                                  className="portfolio-alerts-actions__btn portfolio-alerts-actions__btn--stack"
                                  title={pv.tooltip}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionPreview({ kind, row: r });
                                  }}
                                >
                                  <span className="portfolio-alerts-actions__btn-row">
                                    {icon}
                                    <span>
                                      {kind === "close" ? "Close" : kind === "roll30" ? "Roll 30 DTE" : "Roll & strike"}
                                    </span>
                                    <span className="portfolio-alerts-actions__framing">({pv.framing})</span>
                                  </span>
                                  <span className="portfolio-alerts-actions__preview-line">{pv.primary}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : surface === "watchlist_price" ? (
                          <div className="portfolio-alerts-actions">
                            <Link
                              className="portfolio-alerts-actions__link"
                              href={r.symbol ? `${xoptionsHref}&symbol=${encodeURIComponent(r.symbol.trim().toUpperCase())}` : xoptionsHref}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Add to xOptions
                            </Link>
                          </div>
                        ) : (
                          <span className="portfolio-alerts-table__dash">—</span>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PortfolioAlertDetailModal
        portfolioId={portfolioId}
        portfolioName={portfolioName}
        row={detailRow}
        onClose={() => setDetailRow(null)}
      />

      {actionPreview ? (
        <div
          className="portfolio-alerts-action-scrim"
          role="presentation"
          onClick={() => setActionPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setActionPreview(null);
            }
          }}
        >
          <div
            className="portfolio-alerts-action-scrim__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-alerts-action-title"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const k = parseContractKeyFromBody(actionPreview.row.body);
              const parsed = k ? parseContractKey(k) : null;
              const lines = buildActionPreviewLines({
                parsed,
                closeKind: extractCloseKindFromBody(actionPreview.row.body),
                symbol: actionPreview.row.symbol,
                metadata: actionPreview.row.metadata
              })[actionPreview.kind];
              const sim = buildSimulateXoptionsHref({
                portfolioId,
                accountId: actionPreview.row.accountId,
                symbol: actionPreview.row.symbol
              });
              return (
                <>
                  <h2 id="portfolio-alerts-action-title" className="portfolio-alerts-preview-dialog__title">
                    {actionPreview.kind === "close"
                      ? "Close leg"
                      : actionPreview.kind === "roll30"
                        ? "Roll ~30 DTE"
                        : "Roll & adjust strike"}
                  </h2>
                  <p className="portfolio-alerts-preview-dialog__body">{lines.primary}</p>
                  <p className="portfolio-alerts-preview-dialog__body portfolio-alerts-action-scrim__hint">{lines.tooltip}</p>
                  <div className="portfolio-alerts-preview-dialog__footer">
                    {sim ? (
                      <Link className="portfolio-alerts-preview-dialog__link" href={sim} onClick={() => setActionPreview(null)}>
                        Simulate in xOptions
                      </Link>
                    ) : (
                      <Link className="portfolio-alerts-preview-dialog__link" href={xoptionsHref} onClick={() => setActionPreview(null)}>
                        Open xOptions
                      </Link>
                    )}
                    <button type="button" className="portfolio-alerts-preview-dialog__close" onClick={() => setActionPreview(null)}>
                      Dismiss
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </>
  );
}
