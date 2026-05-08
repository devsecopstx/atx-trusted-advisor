"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PriceRuleRowVm } from "@/app/portfolio/alerts/portfolio-alerts-types";
import { buildDeskNotificationEmailPreviewHtml } from "@/lib/desk-notification-email-preview";
import type { PortfolioAlertRowVm } from "@/lib/portfolio-alert-desk-present";
import { scannerRuleLine } from "@/lib/portfolio-alert-desk-present";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export type UnifiedSortKey = "symbol" | "updated" | "expires" | "kind";

export type UnifiedAlertRow =
  | { kind: "price"; rule: PriceRuleRowVm }
  | { kind: "desk"; row: PortfolioAlertRowVm };

type PortfolioAlertsUnifiedGridProps = {
  portfolioId: string;
  portfolioName: string;
  deskRows: PortfolioAlertRowVm[];
  priceRules: PriceRuleRowVm[];
  nlPriceAlertsEnabled: boolean;
  onOpenDeskDetail: (row: PortfolioAlertRowVm) => void;
  onEditPriceRule: (rule: PriceRuleRowVm) => void;
  onToast?: (message: string) => void;
};

function ruleKindLabel(k: PriceRuleRowVm["ruleKind"]): string {
  if (k === "above") {
    return "Above";
  }
  if (k === "below") {
    return "Below";
  }
  return "Crosses";
}

function expiresLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) {
    return "—";
  }
  if (ms <= 0) {
    return "Expired";
  }
  const d = Math.ceil(ms / 86_400_000);
  return `${d}d`;
}

export function PortfolioAlertsUnifiedGrid({
  portfolioId,
  portfolioName,
  deskRows,
  priceRules,
  nlPriceAlertsEnabled,
  onOpenDeskDetail,
  onEditPriceRule,
  onToast
}: PortfolioAlertsUnifiedGridProps) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<UnifiedSortKey>("symbol");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, SymbolLookupResult | null>>({});

  const unified = useMemo((): UnifiedAlertRow[] => {
    const price = priceRules.map((rule) => ({ kind: "price" as const, rule }));
    const desk = deskRows.map((row) => ({ kind: "desk" as const, row }));
    return [...price, ...desk];
  }, [deskRows, priceRules]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = unified;
    if (q) {
      rows = rows.filter((r) => {
        if (r.kind === "price") {
          const t = `${r.rule.symbol} ${r.rule.ruleKind} ${r.rule.targetPriceUsd}`.toLowerCase();
          return t.includes(q);
        }
        const t = `${r.row.symbol ?? ""} ${r.row.title} ${r.row.body ?? ""}`.toLowerCase();
        return t.includes(q);
      });
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortKey === "kind") {
        return a.kind.localeCompare(b.kind);
      }
      if (sortKey === "symbol") {
        const sa = a.kind === "price" ? a.rule.symbol : a.row.symbol ?? "";
        const sb = b.kind === "price" ? b.rule.symbol : b.row.symbol ?? "";
        return sa.localeCompare(sb);
      }
      if (sortKey === "expires") {
        const ea = a.kind === "price" ? new Date(a.rule.expiresAt).getTime() : 0;
        const eb = b.kind === "price" ? new Date(b.rule.expiresAt).getTime() : 0;
        return eb - ea;
      }
      const ua =
        a.kind === "price" ? new Date(a.rule.updatedAt).getTime() : new Date(a.row.updatedAt).getTime();
      const ub =
        b.kind === "price" ? new Date(b.rule.updatedAt).getTime() : new Date(b.row.updatedAt).getTime();
      return ub - ua;
    });
    return sorted;
  }, [unified, search, sortKey]);

  useEffect(() => {
    const syms = new Set<string>();
    for (const r of filtered) {
      if (r.kind === "price") {
        syms.add(r.rule.symbol.trim().toUpperCase());
      } else if (r.row.symbol?.trim()) {
        syms.add(r.row.symbol.trim().toUpperCase());
      }
    }
    const list = [...syms].slice(0, 28);
    if (list.length === 0) {
      setQuotes({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = new URL("/api/market/symbol-quotes", window.location.origin);
        u.searchParams.set("symbols", list.join(","));
        u.searchParams.set("portfolioId", portfolioId);
        const res = await fetch(u.toString(), { credentials: "include" });
        const payload = (await res.json().catch(() => ({}))) as {
          data?: Record<string, SymbolLookupResult | null>;
        };
        if (!cancelled) {
          setQuotes(payload.data ?? {});
        }
      } catch {
        if (!cancelled) {
          setQuotes({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered, portfolioId]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 10
  });

  const fireToast = useCallback(
    (m: string) => {
      onToast?.(m);
    },
    [onToast]
  );

  const removePriceRule = async (id: string) => {
    if (!nlPriceAlertsEnabled) {
      return;
    }
    if (!window.confirm("Remove this NL price rule? You can recreate it anytime.")) {
      return;
    }
    try {
      const res = await fetch(`/api/portfolios/${encodeURIComponent(portfolioId)}/price-alerts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) {
        fireToast("Could not remove rule.");
        return;
      }
      fireToast("Price rule removed.");
      router.refresh();
    } catch {
      fireToast("Could not remove rule.");
    }
  };

  const previewDeskRow = (row: PortfolioAlertRowVm) => {
    setPreviewHtml(
      buildDeskNotificationEmailPreviewHtml([
        { title: row.title, body: row.body ?? undefined, symbol: row.symbol ?? undefined }
      ])
    );
  };

  const previewPriceRule = (rule: PriceRuleRowVm) => {
    const spot = quotes[rule.symbol.toUpperCase()]?.price;
    const body =
      spot != null
        ? `Target $${rule.targetPriceUsd.toFixed(2)} · spot ~ $${spot.toFixed(2)} · rule ${rule.ruleKind}`
        : `Target $${rule.targetPriceUsd.toFixed(2)} · rule ${rule.ruleKind}`;
    setPreviewHtml(
      buildDeskNotificationEmailPreviewHtml([
        {
          title: `${rule.symbol} NL price alert (${ruleKindLabel(rule.ruleKind)})`,
          body,
          symbol: rule.symbol
        }
      ])
    );
  };

  const triggerQuickDeskPreview = () => {
    setPreviewHtml(
      buildDeskNotificationEmailPreviewHtml([
        {
          title: "[Simulation] Scanner ping",
          body: "Branded delivery preview — no strategy recommendation. Live SMTP still sends plain text until HTML templates ship.",
          symbol: "DEMO"
        }
      ])
    );
    fireToast("Preview only — no desk row inserted.");
  };

  return (
    <section className="portfolio-alerts-unified" aria-label="Unified alerts">
      <div className="portfolio-alerts-unified__controls">
        <label className="portfolio-alerts-unified__search">
          <span className="sr-only">Search alerts</span>
          <input
            type="search"
            className="portfolio-alerts-unified__search-input"
            placeholder="Search symbol or desk copy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="portfolio-alerts-unified__sort">
          <span className="portfolio-alerts-unified__sort-label">Sort</span>
          <select
            className="portfolio-alerts-unified__sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as UnifiedSortKey)}
          >
            <option value="symbol">Symbol</option>
            <option value="updated">Updated</option>
            <option value="expires">Expires</option>
            <option value="kind">Type</option>
          </select>
        </label>
        <button type="button" className="portfolio-alerts-toolbar__btn" onClick={triggerQuickDeskPreview}>
          Trigger test · email preview
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="portfolio-alerts-empty" role="status">
          <div className="portfolio-alerts-empty__glyph" aria-hidden>
            🔔
          </div>
          <p className="portfolio-alerts-empty__title">No alerts match this view</p>
          <p className="portfolio-alerts-empty__copy">
            Create an NL price rule (Premium+ advisor), add a desk test row, or clear filters. xChat phrases like{" "}
            <strong>add alert TSLA 420 above</strong> land here automatically.
          </p>
        </div>
      ) : (
        <div className="portfolio-alerts-unified__table-wrap">
          <div className="portfolio-alerts-unified__head" role="row">
            <span>Type</span>
            <span>Symbol</span>
            <span>Target / signal</span>
            <span>Spot · Δ%</span>
            <span>Context</span>
            <span>Expires</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div ref={parentRef} className="portfolio-alerts-unified__scroll">
            <div
              className="portfolio-alerts-unified__phantom"
              style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}
            >
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const item = filtered[vi.index];
                if (!item) {
                  return null;
                }
                const symUpper =
                  item.kind === "price"
                    ? item.rule.symbol.toUpperCase()
                    : (item.row.symbol ?? "").toUpperCase();
                const q = symUpper ? quotes[symUpper] : null;
                const logo = q?.logoUrl;
                return (
                  <div
                    key={vi.key}
                    className="portfolio-alerts-unified__row"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`
                    }}
                    role="row"
                  >
                    <span className="portfolio-alerts-unified__cell">
                      <span className={`portfolio-alerts-pill portfolio-alerts-pill--kind-${item.kind}`}>
                        {item.kind === "price" ? "NL rule" : "Desk"}
                      </span>
                    </span>
                    <span className="portfolio-alerts-unified__cell portfolio-alerts-unified__cell--sym">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Yahoo CDN URLs from lookup API
                        <img className="portfolio-alerts-unified__logo" src={logo} alt="" width={22} height={22} />
                      ) : (
                        <span className="portfolio-alerts-unified__logo-ph" aria-hidden>
                          ◆
                        </span>
                      )}
                      <strong>{symUpper || "—"}</strong>
                    </span>
                    <span className="portfolio-alerts-unified__cell">
                      {item.kind === "price" ? (
                        <>
                          <span className="portfolio-alerts-dir-badge portfolio-alerts-dir-badge--na">
                            {ruleKindLabel(item.rule.ruleKind)}
                          </span>
                          <span className="portfolio-alerts-unified__target">${item.rule.targetPriceUsd.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="portfolio-alerts-unified__desk-title">{scannerRuleLine(item.row.title)}</span>
                      )}
                    </span>
                    <span className="portfolio-alerts-unified__cell">
                      {(() => {
                        if (!symUpper) {
                          return "—";
                        }
                        const px = q?.price;
                        if (px == null || !Number.isFinite(px)) {
                          return "—";
                        }
                        if (item.kind !== "price") {
                          return `$${px.toFixed(2)}`;
                        }
                        const tgt = item.rule.targetPriceUsd;
                        const pct = tgt !== 0 ? ((px - tgt) / tgt) * 100 : null;
                        const cls =
                          pct == null
                            ? ""
                            : pct >= 0
                              ? "portfolio-alerts-manage__dist--up"
                              : "portfolio-alerts-manage__dist--down";
                        return (
                          <span>
                            ${px.toFixed(2)}
                            {pct != null ? (
                              <span className={`portfolio-alerts-manage__dist ${cls}`}>
                                {" "}
                                ({pct >= 0 ? "+" : ""}
                                {pct.toFixed(2)}%)
                              </span>
                            ) : null}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="portfolio-alerts-unified__cell portfolio-alerts-unified__cell--ctx">
                      {item.kind === "price" ? (
                        <>
                          {portfolioName}
                          {item.rule.portfolioName ? ` · ${item.rule.portfolioName}` : ""}
                        </>
                      ) : (
                        <>
                          {item.row.portfolioName?.trim() || portfolioName} · {item.row.accountName?.trim() || "—"}
                        </>
                      )}
                    </span>
                    <span className="portfolio-alerts-unified__cell">
                      {item.kind === "price" ? expiresLabel(item.rule.expiresAt) : "—"}
                    </span>
                    <span className="portfolio-alerts-unified__cell">
                      <span className="portfolio-alerts-pill portfolio-alerts-pill--status">
                        {item.kind === "price" ? item.rule.status : item.row.status}
                      </span>
                    </span>
                    <span className="portfolio-alerts-unified__cell portfolio-alerts-unified__cell--act">
                      {item.kind === "price" ? (
                        <>
                          <button
                            type="button"
                            className="portfolio-alerts-view-detail"
                            disabled={!nlPriceAlertsEnabled}
                            onClick={() => onEditPriceRule(item.rule)}
                          >
                            Edit
                          </button>
                          <button type="button" className="portfolio-alerts-view-detail" onClick={() => previewPriceRule(item.rule)}>
                            Test
                          </button>
                          <button
                            type="button"
                            className="portfolio-alerts-view-detail"
                            disabled={!nlPriceAlertsEnabled}
                            onClick={() => void removePriceRule(item.rule.id)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="portfolio-alerts-view-detail" onClick={() => onOpenDeskDetail(item.row)}>
                            View
                          </button>
                          <button type="button" className="portfolio-alerts-view-detail" onClick={() => previewDeskRow(item.row)}>
                            Test
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {previewHtml ? (
        <div
          className="portfolio-alerts-action-scrim"
          role="presentation"
          onClick={() => setPreviewHtml(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPreviewHtml(null);
            }
          }}
        >
          <div
            className="portfolio-alerts-preview-html"
            role="dialog"
            aria-modal="true"
            aria-label="Email preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="portfolio-alerts-preview-html__chrome">
              <h3 className="portfolio-alerts-preview-html__title">Branded delivery preview</h3>
              <button type="button" className="portfolio-alerts-preview-dialog__close" onClick={() => setPreviewHtml(null)}>
                Close
              </button>
            </div>
            <iframe className="portfolio-alerts-preview-html__frame" title="Desk email preview" srcDoc={previewHtml} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
