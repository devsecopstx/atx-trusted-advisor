"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import {
    buildHumanAlertSummary,
    buildPortfolioContextLines,
    buildRiskPills,
    buildSimulateXoptionsHref,
    classifyAlertSurface,
    dteBadgeTone,
    extractCloseKindFromBody,
    extractOptionMarkFromBody,
    formatContractDeskLabel,
    optionPositionLabelFromClose,
    parseContractKey,
    parseContractKeyFromBody,
    scannerRuleLine,
    type PortfolioAlertRowVm
} from "@/lib/portfolio-alert-desk-present";
import { formatPortfolioAlertBodyForDisplay } from "@/lib/portfolio-alert-display";
import { parseAlertDte } from "@/lib/portfolio-alert-insights";

function renderEmphasis(text: string): ReactNode {
  const parts = text.split("**");
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

type Props = {
  portfolioId: string;
  portfolioName: string;
  row: PortfolioAlertRowVm | null;
  onClose: () => void;
};

export function PortfolioAlertDetailModal({ portfolioId, portfolioName, row, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeModel, setNarrativeModel] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) {
      return;
    }
    const el = dialogRef.current;
    if (el && !el.open) {
      el.showModal();
    }
  }, [row]);

  useEffect(() => {
    if (!row) {
      return;
    }
    let cancelled = false;
    const url = `/api/portfolios/${encodeURIComponent(portfolioId)}/alerts/${encodeURIComponent(row.id)}/narrative`;
    void Promise.resolve()
      .then(() => {
        if (cancelled) {
          return;
        }
        setNarrative(null);
        setNarrativeModel(null);
        setNarrativeError(null);
        setNarrativeLoading(true);
        return fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
      })
      .then(async (res) => {
        if (cancelled) {
          return;
        }
        const j = (await res.json().catch(() => ({}))) as {
          data?: { narrative?: string; model?: string };
          error?: string;
        };
        if (!res.ok) {
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setNarrative(j.data?.narrative?.trim() ?? null);
          setNarrativeModel(j.data?.model ?? null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setNarrativeError(e instanceof Error ? e.message : "Could not load narrative");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNarrativeLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [row, portfolioId]);

  if (!row) {
    return null;
  }

  const surface = classifyAlertSurface(row.title, row.body);
  const ck = parseContractKeyFromBody(row.body);
  const parsed = ck ? parseContractKey(ck) : null;
  const closeKind = extractCloseKindFromBody(row.body);
  const meta = row.metadata;
  const dte = meta?.metrics.dte ?? parseAlertDte(row.body, row.title);
  const dteTone = dteBadgeTone(dte);
  const mark = meta?.metrics.mark ?? extractOptionMarkFromBody(row.body);
  const symU = (row.symbol ?? parsed?.underlying ?? "").trim().toUpperCase() || null;
  const simulateHref = buildSimulateXoptionsHref({
    portfolioId,
    accountId: row.accountId,
    symbol: symU
  });
  const xoptionsBase = `/xoptions?portfolioId=${encodeURIComponent(portfolioId)}${
    symU ? `&symbol=${encodeURIComponent(symU)}` : ""
  }`;
  const portfolioHref = `/portfolio?portfolioId=${encodeURIComponent(portfolioId)}`;
  const chainHref = symU
    ? `/xoptions/full-chain?symbol=${encodeURIComponent(symU)}`
    : "/xoptions/full-chain";

  const fallbackNarrative = buildHumanAlertSummary(row.body, row.title, meta);
  const narrativeBody = narrative ?? fallbackNarrative;

  return (
    <dialog
      ref={dialogRef}
      className="portfolio-alerts-detail-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="portfolio-alerts-detail-dialog__inner">
        <header className="portfolio-alerts-detail-dialog__head">
          <div>
            <p className="portfolio-alerts-detail-dialog__eyebrow">{portfolioName}</p>
            <h2 id={titleId} className="portfolio-alerts-detail-dialog__title">
              {surface === "options_scanner" && parsed
                ? formatContractDeskLabel(parsed)
                : scannerRuleLine(row.title)}
            </h2>
            {surface === "options_scanner" && parsed && closeKind ? (
              <p className="portfolio-alerts-detail-dialog__sub">
                {optionPositionLabelFromClose(closeKind, parsed.optionType)} ·{" "}
                <span className="portfolio-alerts-detail-dialog__action-tag">{closeKind.replace(/_/g, " ")}</span>
                {mark != null ? (
                  <>
                    {" "}
                    · option mark <span className="font-mono">${mark.toFixed(2)}</span> (snapshot)
                  </>
                ) : null}
              </p>
            ) : surface === "watchlist_price" ? (
              <p className="portfolio-alerts-detail-dialog__sub">Watchlist tape signal — open xOptions for live chart.</p>
            ) : (
              <p className="portfolio-alerts-detail-dialog__sub">Portfolio / account signal</p>
            )}
          </div>
          <button type="button" className="portfolio-alerts-detail-dialog__x" onClick={() => dialogRef.current?.close()} aria-label="Close alert detail">
            ×
          </button>
        </header>

        <div className="portfolio-alerts-detail-dialog__rule-row">
          <span className={`portfolio-alerts-pill portfolio-alerts-pill--severity portfolio-alerts-pill--sev-${row.severity}`}>
            {row.severity}
          </span>
          <span className="portfolio-alerts-detail-dialog__rule-text">{scannerRuleLine(row.title)}</span>
          {dte != null ? (
            <span className={`portfolio-alerts-dte-badge portfolio-alerts-dte-badge--${dteTone}`}>{dte} DTE</span>
          ) : null}
        </div>

        <section className="portfolio-alerts-detail-dialog__section" aria-label="Desk narrative">
          <h3 className="portfolio-alerts-detail-dialog__h3">Desk narrative</h3>
          {narrativeLoading ? (
            <p className="portfolio-alerts-detail-dialog__muted">Generating risk read…</p>
          ) : null}
          {narrativeError && !narrativeLoading ? (
            <p className="portfolio-alerts-detail-dialog__warn status-text">{narrativeError} — showing scanner summary.</p>
          ) : null}
          <p className="portfolio-alerts-detail-dialog__narrative">{narrativeBody}</p>
          {narrativeModel ? (
            <p className="portfolio-alerts-detail-dialog__model-hint font-mono text-xs">Model: {narrativeModel}</p>
          ) : null}
        </section>

        <section className="portfolio-alerts-detail-dialog__section" aria-label="Key metrics">
          <h3 className="portfolio-alerts-detail-dialog__h3">Snapshot metrics</h3>
          <div className="portfolio-alerts-detail-metrics">
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">DTE</span>
              <span className="portfolio-alerts-detail-metrics__v">{dte ?? "—"}</span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">Theta / day</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.thetaPerDayUsd != null && Number.isFinite(meta.metrics.thetaPerDayUsd)
                  ? `$${meta.metrics.thetaPerDayUsd.toFixed(2)}`
                  : "—"}
              </span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">IV</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.ivPct != null ? `${meta.metrics.ivPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">OI</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.openInterest != null ? meta.metrics.openInterest.toLocaleString() : "—"}
              </span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">Volume</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.volume != null ? meta.metrics.volume.toLocaleString() : "—"}
              </span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">Scanner confidence</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.finalConfidence != null ? `${meta.metrics.finalConfidence}%` : "—"}
              </span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">Δ abs</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.deltaAbs != null ? meta.metrics.deltaAbs.toFixed(3) : "—"}
              </span>
            </div>
            <div className="portfolio-alerts-detail-metrics__card">
              <span className="portfolio-alerts-detail-metrics__k">Unrealized %</span>
              <span className="portfolio-alerts-detail-metrics__v">
                {meta?.metrics.pnlPct != null ? `${meta.metrics.pnlPct >= 0 ? "+" : ""}${meta.metrics.pnlPct.toFixed(1)}%` : "—"}
              </span>
            </div>
          </div>
          <p className="portfolio-alerts-detail-dialog__muted text-xs">
            Est. close vs hold and ITM % need live underlying — use xOptions payoff / chain. Not financial advice.
          </p>
        </section>

        <section className="portfolio-alerts-detail-dialog__section" aria-label="Book context">
          <h3 className="portfolio-alerts-detail-dialog__h3">Book context</h3>
          <ul className="portfolio-alerts-detail-dialog__bullets">
            {(() => {
              const ctxLines = buildPortfolioContextLines({
                accountName: row.accountName,
                accountType: row.accountType,
                symbolUpper: symU
              });
              if (ctxLines.length === 0) {
                return <li>Workspace book: {portfolioName}</li>;
              }
              return ctxLines.map((line, idx) => (
                <li key={`${idx}-${line.slice(0, 24)}`}>{renderEmphasis(line)}</li>
              ));
            })()}
          </ul>
        </section>

        {surface === "watchlist_price" ? (
          <section className="portfolio-alerts-detail-dialog__section" aria-label="Watchlist">
            <h3 className="portfolio-alerts-detail-dialog__h3">Tape</h3>
            <p className="portfolio-alerts-detail-dialog__muted text-sm">{row.body}</p>
            <div className="portfolio-alerts-detail-dialog__cta-row">
              <Link className="portfolio-alerts-preview-dialog__link" href={xoptionsBase}>
                Add to xOptions
              </Link>
            </div>
          </section>
        ) : null}

        {row.body && surface === "options_scanner" ? (
          <section className="portfolio-alerts-detail-dialog__section" aria-label="Raw scanner note">
            <h3 className="portfolio-alerts-detail-dialog__h3">Scanner note</h3>
            <pre className="portfolio-alerts-detail-dialog__pre">{formatPortfolioAlertBodyForDisplay(row.body)}</pre>
          </section>
        ) : null}

        <div className="portfolio-alerts-detail-dialog__pills" aria-label="Key risks">
          {buildRiskPills(row.body, row.title, meta).map((p) => (
            <span key={p.id} className="portfolio-alerts-risk-pill">
              <span className="portfolio-alerts-risk-pill__k">{p.label}</span>
              <span className="portfolio-alerts-risk-pill__v">{p.value}</span>
            </span>
          ))}
        </div>

        <footer className="portfolio-alerts-detail-dialog__footer">
          <Link className="portfolio-alerts-preview-dialog__link" href={portfolioHref}>
            Full portfolio
          </Link>
          <Link className="portfolio-alerts-preview-dialog__link" href={chainHref}>
            Option chain
          </Link>
          {simulateHref ? (
            <Link className="portfolio-alerts-preview-dialog__link" href={simulateHref}>
              Simulate in xOptions (step 4)
            </Link>
          ) : null}
          <button type="button" className="portfolio-alerts-preview-dialog__close" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </footer>
      </div>
    </dialog>
  );
}
