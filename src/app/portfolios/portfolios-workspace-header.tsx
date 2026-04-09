"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE } from "@/app/ui/product-brand-constants";
import { useTenantShellBranding } from "@/app/ui/tenant-branding-context";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { tenantIdHexLastFourUserFacing } from "@/lib/mongo-object-id-hex";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { MarketDayContext } from "@/modules/scanner/us-market-day-context";
import { resolveUsMarketDayContext, usMarketSessionStatusLabel } from "@/modules/scanner/us-market-day-context";

type PulseIndex = { symbol: string; price?: number; changePercent?: number };

type WorkspaceTenant = {
  idHex: string;
  slug: string;
  name: string;
};

type Props = {
  totalBookUsd: number;
  topHoldingsKey: string;
  workspaceTenant?: WorkspaceTenant | null;
  /** Session active tenant (for chip fallback when `getWorkspaceTenantHeaderContext` is null). */
  workspaceTenantIdHex?: string | null;
};

function formatChgPct(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) {
    return "—";
  }
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

export function PortfoliosWorkspaceHeader({
  totalBookUsd,
  topHoldingsKey,
  workspaceTenant = null,
  workspaceTenantIdHex = null
}: Props) {
  const branding = useTenantShellBranding();
  const [indices, setIndices] = useState<PulseIndex[]>([]);
  const [market, setMarket] = useState<MarketDayContext>(() => resolveUsMarketDayContext(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = topHoldingsKey ? `?holdings=${encodeURIComponent(topHoldingsKey)}` : "";
        const res = await fetch(`/api/market/workspace-pulse${qs}`, { credentials: "include" });
        const body = (await res.json()) as {
          data?: { indices?: PulseIndex[]; market?: MarketDayContext };
        };
        if (!cancelled) {
          if (body.data?.indices) {
            setIndices(body.data.indices);
          }
          setMarket(body.data?.market ?? resolveUsMarketDayContext(new Date()));
        }
      } catch {
        if (!cancelled) {
          setIndices([]);
          setMarket(resolveUsMarketDayContext(new Date()));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    const t = setInterval(() => void load(), 180_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [topHoldingsKey]);

  const spy = useMemo(() => indices.find((i) => i.symbol === "SPY") ?? indices[0], [indices]);
  const sessionStatus = useMemo(() => usMarketSessionStatusLabel(market), [market]);

  const tenantHex = workspaceTenantIdHex?.trim() ?? "";
  const tenantFacing = tenantHex ? tenantIdHexLastFourUserFacing(tenantHex) : "";

  const displayName =
    branding?.displayName?.trim() || workspaceTenant?.name?.trim() || "Workspace";
  const subtitle = branding?.tagline?.trim() || PORTFOLIOS_WORKSPACE_FALLBACK_TAGLINE;
  const logoUrl = branding?.logoUrl?.trim();
  const headerTooltip = `${displayName}${branding?.tagline?.trim() ? ` — ${branding.tagline.trim()}` : ""}`;

  return (
    <header className="portfolios-workspace-header xchat-header">
      <div className="xchat-header-leading">
        {/*
         * Branding pulled from Tenant Settings → Branding (core_tenants / tenantPreferences).
         * Changes apply immediately across the workspace (context + --xf-tenant-accent).
         */}
        <div className="xchat-header-brand-stack">
          <Link
            aria-label="Portfolios workspace — home"
            className="portfolios-workspace-header__brand-row"
            href="/portfolios"
            title={headerTooltip}
          >
            <div className="portfolios-workspace-header__brand-mark">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URLs + tenant CDNs
                <img
                  alt=""
                  className="portfolios-workspace-header__brand-logo"
                  height={40}
                  src={logoUrl}
                  width={40}
                />
              ) : (
                <span aria-hidden className="portfolios-workspace-header__brand-fallback-atx">
                  aTx
                </span>
              )}
            </div>
            <div className="portfolios-workspace-header__brand-text">
              <span className="portfolios-workspace-header__brand-title">{displayName}</span>
              <span className="portfolios-workspace-header__brand-subtitle">{subtitle}</span>
            </div>
          </Link>
          {!branding?.displayName?.trim() && !workspaceTenant?.name?.trim() && tenantFacing ? (
            <span
              className="xchat-header-tenant-under-brand xchat-header-tenant-under-brand--chip font-mono"
              title={`Tenant id ${tenantHex}`}
            >
              Tenant {tenantFacing}
            </span>
          ) : null}
        </div>
      </div>

      <div className="portfolios-workspace-header__center">
        <XfHoverHint hint="Book total: cash plus position cost basis across all portfolios. Not live marks; no portfolio day P&amp;L.">
          <div className="portfolios-workspace-header__total-block">
            <p className="portfolios-workspace-header__total-label">Total book value</p>
            <p className="portfolios-workspace-header__total-value font-mono tabular-nums">
              {formatUsdWhole(totalBookUsd)}
            </p>
            <p className="portfolios-workspace-header__total-delta">
              <span className="text-[var(--xf-text-300)]">Portfolio day Δ </span>
              <span className="text-[var(--xf-text-300)]">—</span>
            </p>
          </div>
        </XfHoverHint>
      </div>

      <div className="portfolios-workspace-header__trailing xchat-header-trailing">
        <div
          className="portfolios-workspace-header__market-cluster flex flex-wrap items-center gap-2"
          aria-live="polite"
          aria-busy={loading}
        >
          <XfHoverHint hint={`${market.marketDate} · ${market.timezone} · ${sessionStatus.detail}`}>
            <span
              className={
                sessionStatus.label === "Open"
                  ? "portfolios-workspace-header__market-status portfolios-workspace-header__market-status--open"
                  : "portfolios-workspace-header__market-status"
              }
            >
              {sessionStatus.label}
            </span>
          </XfHoverHint>
          <span className="portfolios-workspace-header__market-pill font-mono tabular-nums">
            {spy ? (
              <>
                <span className="text-[var(--xf-text-100)]">{spy.symbol}</span>{" "}
                {spy.price !== undefined && Number.isFinite(spy.price) ? (
                  <span className="text-[var(--xf-text-200)]">
                    {spy.price.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 2
                    })}
                  </span>
                ) : (
                  <span className="text-[var(--xf-text-300)]">—</span>
                )}{" "}
                <span
                  className={
                    (spy.changePercent ?? 0) > 0
                      ? "text-[var(--xf-gain-green)]"
                      : (spy.changePercent ?? 0) < 0
                        ? "text-red-300"
                        : "text-[var(--xf-text-300)]"
                  }
                >
                  {spy.changePercent !== undefined && spy.changePercent > 0 ? "▲ " : ""}
                  {spy.changePercent !== undefined && spy.changePercent < 0 ? "▼ " : ""}
                  {formatChgPct(spy.changePercent)}
                </span>
              </>
            ) : (
              <span className="text-[var(--xf-text-300)]">Markets —</span>
            )}
          </span>
        </div>
      </div>
    </header>
  );
}
