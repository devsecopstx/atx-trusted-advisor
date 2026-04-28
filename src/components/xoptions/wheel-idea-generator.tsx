"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { WheelReportView } from "@/components/xoptions/wheel-report-view";
import type {
    WheelExpirationCycle,
    WheelGeneratedPayload,
    WheelGeneratorInput,
    WheelReentryRule,
    WheelReportStyle,
    WheelRiskTolerance,
    WheelStrategyTemplate
} from "@/modules/xoptions/wheel-types";

type BootstrapPayload = {
  holdings: Array<{ symbol: string; marketValue: number; shares: number; lastPrice: number | null }>;
  hot: { rows: Array<{ symbol: string }>; scanned: number };
};

const TEMPLATE_IDEAS: WheelStrategyTemplate[] = [
  {
    key: "nvda-income",
    label: "NVDA Premium Harvest",
    ticker: "NVDA",
    note: "Higher IV skew with controlled monthly cadence.",
    riskTolerance: "balanced",
    expirationCycle: "monthly",
    targetPutDelta: 0.22,
    targetCallDelta: 0.26,
    minimumPremiumYieldPerCyclePct: 9
  },
  {
    key: "aapl-defensive",
    label: "AAPL Defensive Wheel",
    ticker: "AAPL",
    note: "Conservative deltas for steadier assignment profile.",
    riskTolerance: "conservative",
    expirationCycle: "monthly",
    targetPutDelta: 0.18,
    targetCallDelta: 0.22,
    minimumPremiumYieldPerCyclePct: 6
  },
  {
    key: "tsla-active",
    label: "TSLA Active Yield",
    ticker: "TSLA",
    note: "Weekly active management with richer premium turnover.",
    riskTolerance: "aggressive",
    expirationCycle: "weekly",
    targetPutDelta: 0.28,
    targetCallDelta: 0.32,
    minimumPremiumYieldPerCyclePct: 12
  },
  {
    key: "msft-core",
    label: "MSFT Core Income",
    ticker: "MSFT",
    note: "Balanced long-term wheel anchored to blue-chip liquidity.",
    riskTolerance: "balanced",
    expirationCycle: "quarterly",
    targetPutDelta: 0.2,
    targetCallDelta: 0.25,
    minimumPremiumYieldPerCyclePct: 7
  }
];

function defaultForm(): WheelGeneratorInput {
  return {
    ticker: "",
    availableCapitalUsd: 250_000,
    riskTolerance: "balanced",
    expirationCycle: "monthly",
    targetPutDelta: 0.22,
    targetCallDelta: 0.27,
    minimumPremiumYieldPerCyclePct: 8,
    maxPositionSizePct: 25,
    reentryRule: "roll_immediately",
    ivPercentileMin: 35,
    avoidEarningsWeek: true,
    sectorPreference: null,
    taxConsideration: "mixed",
    variationCount: 3,
    reportStyle: "institutional"
  };
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function WheelIdeaGenerator() {
  const [form, setForm] = useState<WheelGeneratorInput>(defaultForm);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WheelGeneratedPayload | null>(null);
  const [generatedByName, setGeneratedByName] = useState<string>("HNWI Client");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPortfolioFit, setShowPortfolioFit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoadingBootstrap(true);
        const response = await fetch("/api/app-user/find-options/bootstrap?holdingsLimit=12&hotLimit=5", {
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: BootstrapPayload;
        };
        if (!cancelled && payload.data) {
          setBootstrap(payload.data);
          if (!form.ticker) {
            const top = payload.data.holdings[0]?.symbol ?? payload.data.hot.rows[0]?.symbol ?? "NVDA";
            setForm((current) => ({ ...current, ticker: top }));
          }
        }
      } catch {
        if (!cancelled) {
          setBootstrap(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingBootstrap(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.ticker]);

  const tickerUniverse = useMemo(() => {
    const all = new Set<string>();
    for (const row of bootstrap?.holdings ?? []) all.add(row.symbol.toUpperCase());
    for (const row of bootstrap?.hot.rows ?? []) all.add(row.symbol.toUpperCase());
    for (const preset of TEMPLATE_IDEAS) all.add(preset.ticker);
    return Array.from(all).sort();
  }, [bootstrap]);

  const selectedHoldingValue = useMemo(() => {
    const key = form.ticker.trim().toUpperCase();
    if (!key) {
      return 0;
    }
    return bootstrap?.holdings.find((row) => row.symbol.toUpperCase() === key)?.marketValue ?? 0;
  }, [bootstrap, form.ticker]);

  const projectedExposure = useMemo(() => {
    const maxWheel = (form.availableCapitalUsd * form.maxPositionSizePct) / 100;
    const total = selectedHoldingValue + maxWheel;
    return {
      projectedUsd: total,
      projectedPct: (total / Math.max(form.availableCapitalUsd, 1)) * 100
    };
  }, [form.availableCapitalUsd, form.maxPositionSizePct, selectedHoldingValue]);

  function applyTemplate(template: WheelStrategyTemplate) {
    setForm((current) => ({
      ...current,
      ticker: template.ticker,
      riskTolerance: template.riskTolerance,
      expirationCycle: template.expirationCycle,
      targetPutDelta: template.targetPutDelta,
      targetCallDelta: template.targetCallDelta,
      minimumPremiumYieldPerCyclePct: template.minimumPremiumYieldPerCyclePct
    }));
  }

  async function generateIdeas() {
    setGenerateBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/xoptions/wheel/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ticker: form.ticker.trim().toUpperCase()
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          reportId: string;
          generatedByName: string;
          createdAtIso: string;
          report: WheelGeneratedPayload;
        };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Wheel generator failed");
      }
      setReport(payload.data.report);
      setGeneratedByName(payload.data.generatedByName);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Wheel generator failed");
    } finally {
      setGenerateBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-gain-green)_25%,transparent)] bg-[var(--xf-surface-700)] p-4 sm:p-5">
        <header className="mb-4">
          <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--xf-gain-green)]">
            xWheel Studio - Premium HNWI
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-[var(--xf-text-100)]">
            Wheel Strategy Idea Generator + Professional Report Builder
          </h1>
          <p className="mt-2 text-sm text-[var(--xf-text-300)]">
            Generate 3-5 structured wheel setups, compare them side-by-side, then export a polished professional report.
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-2">
          <FormField
            label="Root stock ticker"
            hint="Auto-complete from portfolio/watchlist plus templates."
            input={
              <>
                <input
                  className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                  list="xwheel-ticker-suggestions"
                  value={form.ticker}
                  onChange={(event) => setForm((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))}
                  placeholder="TSLA"
                />
                <datalist id="xwheel-ticker-suggestions">
                  {tickerUniverse.map((ticker) => (
                    <option key={ticker} value={ticker} />
                  ))}
                </datalist>
              </>
            }
          />

          <FormField
            label="Available capital (USD)"
            input={
              <input
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                type="number"
                min={1}
                step={1000}
                value={form.availableCapitalUsd}
                onChange={(event) =>
                  setForm((current) => ({ ...current, availableCapitalUsd: Number(event.target.value) || 0 }))
                }
              />
            }
          />

          <SelectField
            label="Risk tolerance"
            value={form.riskTolerance}
            onChange={(value) => setForm((current) => ({ ...current, riskTolerance: value as WheelRiskTolerance }))}
            options={[
              { value: "conservative", label: "Conservative" },
              { value: "balanced", label: "Balanced" },
              { value: "aggressive", label: "Aggressive" }
            ]}
          />

          <SelectField
            label="Expiration cycle"
            value={form.expirationCycle}
            onChange={(value) => setForm((current) => ({ ...current, expirationCycle: value as WheelExpirationCycle }))}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" }
            ]}
          />

          <FormField
            label="Target put delta"
            input={
              <input
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                type="number"
                min={0.08}
                max={0.45}
                step={0.01}
                value={form.targetPutDelta}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetPutDelta: Number(event.target.value) || current.targetPutDelta }))
                }
              />
            }
          />

          <FormField
            label="Target call delta"
            input={
              <input
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                type="number"
                min={0.12}
                max={0.5}
                step={0.01}
                value={form.targetCallDelta}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetCallDelta: Number(event.target.value) || current.targetCallDelta }))
                }
              />
            }
          />

          <FormField
            label="Minimum premium yield per cycle (%)"
            input={
              <input
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                type="number"
                min={0}
                max={200}
                step={0.5}
                value={form.minimumPremiumYieldPerCyclePct}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minimumPremiumYieldPerCyclePct: Number(event.target.value) || current.minimumPremiumYieldPerCyclePct
                  }))
                }
              />
            }
          />

          <FormField
            label="Max position size (% capital)"
            input={
              <input
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                type="number"
                min={1}
                max={100}
                step={1}
                value={form.maxPositionSizePct}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxPositionSizePct: Number(event.target.value) || current.maxPositionSizePct }))
                }
              />
            }
          />

          <SelectField
            label="Re-entry rule"
            value={form.reentryRule}
            onChange={(value) => setForm((current) => ({ ...current, reentryRule: value as WheelReentryRule }))}
            options={[
              { value: "roll_immediately", label: "Roll immediately" },
              { value: "wait_pullback", label: "Wait for pullback" },
              { value: "stagger_reentry", label: "Stagger re-entry" }
            ]}
          />

          <SelectField
            label="Variations"
            value={String(form.variationCount)}
            onChange={(value) => setForm((current) => ({ ...current, variationCount: Number(value) as 3 | 4 | 5 }))}
            options={[
              { value: "3", label: "3 ideas" },
              { value: "4", label: "4 ideas" },
              { value: "5", label: "5 ideas" }
            ]}
          />

          <SelectField
            label="Report style"
            value={form.reportStyle}
            onChange={(value) => setForm((current) => ({ ...current, reportStyle: value as WheelReportStyle }))}
            options={[
              { value: "executive", label: "Executive Summary (1-page)" },
              { value: "institutional", label: "Full Institutional (multi-page)" }
            ]}
          />
        </div>

        <button
          className="mt-3 xchat-scan-action-btn xchat-scan-action-btn--accent"
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
        </button>

        {showAdvanced ? (
          <div className="mt-3 grid gap-3 rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] p-3 md:grid-cols-2">
            <FormField
              label="IV percentile minimum"
              input={
                <input
                  className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.ivPercentileMin ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ivPercentileMin: event.target.value === "" ? null : Number(event.target.value)
                    }))
                  }
                />
              }
            />

            <FormField
              label="Sector preference"
              input={
                <input
                  className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
                  value={form.sectorPreference ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sectorPreference: event.target.value || null }))
                  }
                  placeholder="Semiconductors"
                />
              }
            />

            <SelectField
              label="Tax consideration"
              value={form.taxConsideration ?? "mixed"}
              onChange={(value) => setForm((current) => ({ ...current, taxConsideration: value as WheelGeneratorInput["taxConsideration"] }))}
              options={[
                { value: "mixed", label: "Mixed" },
                { value: "taxable", label: "Taxable account focus" },
                { value: "tax_deferred", label: "Tax deferred account focus" }
              ]}
            />

            <label className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_16%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-200)]">
              <input
                type="checkbox"
                checked={form.avoidEarningsWeek}
                onChange={(event) => setForm((current) => ({ ...current, avoidEarningsWeek: event.target.checked }))}
              />
              Avoid earnings weeks
            </label>
          </div>
        ) : null}

        <section className="mt-4">
          <h2 className="text-sm font-semibold text-[var(--xf-text-100)]">Pre-seeded premium templates</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {TEMPLATE_IDEAS.map((template) => (
              <button
                key={template.key}
                className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_16%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] p-2.5 text-left"
                type="button"
                onClick={() => applyTemplate(template)}
              >
                <p className="text-sm font-semibold text-[var(--xf-text-100)]">{template.label}</p>
                <p className="text-xs text-[var(--xf-text-400)]">{template.note}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--xf-gain-green)]">{template.ticker}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="xchat-scan-action-btn xchat-scan-action-btn--accent"
            disabled={generateBusy || !form.ticker.trim()}
            type="button"
            onClick={() => void generateIdeas()}
          >
            {generateBusy ? "Generating wheel ideas..." : "Generate Wheel Ideas"}
          </button>
          <button
            className="xchat-scan-action-btn xchat-scan-action-btn--neutral"
            type="button"
            onClick={() => setShowPortfolioFit((current) => !current)}
          >
            Compare to Portfolio
          </button>
        </div>

        {showPortfolioFit ? (
          <div className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--xf-lightning-yellow)_28%,transparent)] bg-[color-mix(in_srgb,var(--xf-lightning-yellow)_10%,transparent)] p-3 text-sm">
            <p className="font-semibold text-[var(--xf-text-100)]">
              Selected ticker currently held: {selectedHoldingValue > 0 ? "Yes" : "No"}
            </p>
            <p className="mt-1 text-[var(--xf-text-300)]">
              Current holding value: <strong className="text-[var(--xf-text-100)]">{toCurrency(selectedHoldingValue)}</strong>
            </p>
            <p className="text-[var(--xf-text-300)]">
              Projected wheel notional exposure:{" "}
              <strong className="text-[var(--xf-text-100)]">{toCurrency(projectedExposure.projectedUsd)}</strong> (
              {projectedExposure.projectedPct.toFixed(1)}% of available capital)
            </p>
          </div>
        ) : null}

        {loadingBootstrap ? <p className="mt-2 text-xs text-[var(--xf-text-400)]">Loading portfolio/watchlist context...</p> : null}
        {error ? (
          <p className="mt-2 text-sm text-[var(--xf-danger-400)]" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {report ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <WheelReportView
            report={report}
            generatedByName={generatedByName}
            onEdit={() => {
              setReport(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </motion.div>
      ) : null}
    </div>
  );
}

function FormField(props: { label: string; hint?: string; input: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-400)]">{props.label}</span>
      {props.input}
      {props.hint ? <span className="text-[0.68rem] text-[var(--xf-text-500)]">{props.hint}</span> : null}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-400)]">{props.label}</span>
      <select
        className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_44%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
