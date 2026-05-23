"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type EffectiveBlock = {
  scanner: {
    minIvRankPct: number;
    minDte: number | null;
    maxDte: number | null;
    optionTypes: ("call" | "put")[] | null;
    sources: ("position" | "watchlist")[] | null;
    underlyingDenylist: string[];
    underlyingAllowlist: string[] | null;
  };
  engine: {
    straddleDeltaMin: number;
    straddleDeltaMax: number;
    straddleDeltaTarget: number;
    minFitScore: number;
  };
};

type ApiPayload = {
  tenantId: string;
  slug: string;
  overrideEnabled: boolean;
  hasTenantOverride: boolean;
  effective: EffectiveBlock;
  productDefaults: EffectiveBlock;
  complianceNote: string;
};

type Draft = {
  overrideEnabled: boolean;
  minIvRankPct: string;
  minDte: string;
  maxDte: string;
  optionTypesCall: boolean;
  optionTypesPut: boolean;
  sourcesPosition: boolean;
  sourcesWatchlist: boolean;
  underlyingDenylist: string;
  underlyingAllowlist: string;
  straddleDeltaMin: string;
  straddleDeltaMax: string;
  minFitScore: string;
};

function draftFromApi(data: ApiPayload): Draft {
  const s = data.effective.scanner;
  const e = data.effective.engine;
  return {
    overrideEnabled: data.overrideEnabled,
    minIvRankPct: String(s.minIvRankPct),
    minDte: s.minDte == null ? "" : String(s.minDte),
    maxDte: s.maxDte == null ? "" : String(s.maxDte),
    optionTypesCall: s.optionTypes == null || s.optionTypes.includes("call"),
    optionTypesPut: s.optionTypes == null || s.optionTypes.includes("put"),
    sourcesPosition: s.sources == null || s.sources.includes("position"),
    sourcesWatchlist: s.sources == null || s.sources.includes("watchlist"),
    underlyingDenylist: s.underlyingDenylist.join(", "),
    underlyingAllowlist: (s.underlyingAllowlist ?? []).join(", "),
    straddleDeltaMin: String(e.straddleDeltaMin),
    straddleDeltaMax: String(e.straddleDeltaMax),
    minFitScore: String(e.minFitScore)
  };
}

function parseTickerCsv(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

function buildPatchBody(draft: Draft): Record<string, unknown> {
  const optionTypes: ("call" | "put")[] = [];
  if (draft.optionTypesCall) optionTypes.push("call");
  if (draft.optionTypesPut) optionTypes.push("put");
  const sources: ("position" | "watchlist")[] = [];
  if (draft.sourcesPosition) sources.push("position");
  if (draft.sourcesWatchlist) sources.push("watchlist");

  return {
    overrideEnabled: draft.overrideEnabled,
    scanner: {
      minIvRankPct: Number(draft.minIvRankPct),
      minDte: draft.minDte.trim() === "" ? null : Number(draft.minDte),
      maxDte: draft.maxDte.trim() === "" ? null : Number(draft.maxDte),
      optionTypes,
      sources,
      underlyingDenylist: parseTickerCsv(draft.underlyingDenylist),
      underlyingAllowlist: parseTickerCsv(draft.underlyingAllowlist)
    },
    engine: {
      straddleDeltaMin: Number(draft.straddleDeltaMin),
      straddleDeltaMax: Number(draft.straddleDeltaMax),
      minFitScore: Number(draft.minFitScore)
    }
  };
}

type Props = {
  tenantId: string;
};

export function OptionsStrategyEnginePanel({ tenantId }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [productDefaults, setProductDefaults] = useState<ApiPayload["productDefaults"] | null>(null);
  const [complianceNote, setComplianceNote] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const base = `/api/admin/tenants/${encodeURIComponent(tenantId)}/options-strategy-engine-config`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const payload = await parseJson<{ data: ApiPayload }>(
        await fetch(base, { cache: "no-store", credentials: "include" })
      );
      setDraft(draftFromApi(payload.data));
      setProductDefaults(payload.data.productDefaults);
      setComplianceNote(payload.data.complianceNote);
      setSlug(payload.data.slug ?? "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load strategy engine config");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const productSummary = useMemo(() => {
    if (!productDefaults) return null;
    const s = productDefaults.scanner;
    const e = productDefaults.engine;
    return `Product defaults — IV rank ≥${s.minIvRankPct}%, straddle |Δ| ${e.straddleDeltaMin}–${e.straddleDeltaMax}, min fit ${e.minFitScore}`;
  }, [productDefaults]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setStatus(null);
    try {
      await parseJson(
        await fetch(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ optionsStrategyEngineConfig: buildPatchBody(draft) })
        })
      );
      setStatus("Strategy engine config saved — effective on next scanner run.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetToProductDefaults() {
    setSaving(true);
    setStatus(null);
    try {
      await parseJson(
        await fetch(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ optionsStrategyEngineConfig: null })
        })
      );
      setStatus("Tenant overrides cleared — product defaults + global strategy catalog apply.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) {
    return <p className="text-sm text-[var(--xf-text-400)]">Loading strategy engine config…</p>;
  }

  if (!draft) {
    return (
      <p className="text-sm text-[var(--xf-loss-red)]">
        {status ?? "Could not load strategy engine configuration."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface-800)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--xf-gain-green)]">
          Compliance exposure
        </p>
        <p className="mt-2 text-sm text-[var(--xf-text-200)]">{complianceNote}</p>
        <p className="mt-2 text-xs text-[var(--xf-text-400)]">
          Tenant <code className="font-mono">{slug || tenantId}</code> — app users can read effective
          parameters via{" "}
          <code className="font-mono">GET /api/app-user/tenant/options-strategy-engine-config</code>.
          Global strategy catalog filters remain under{" "}
          <Link href="/admin/options-strategy" className="text-[var(--xf-gain-green)] underline">
            Options strategy
          </Link>
          .
        </p>
        {productSummary ? (
          <p className="mt-2 font-mono text-xs text-[var(--xf-text-400)]">{productSummary}</p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--xf-text-100)]">
        <input
          type="checkbox"
          checked={draft.overrideEnabled}
          onChange={(e) => setDraft({ ...draft, overrideEnabled: e.target.checked })}
        />
        <span>
          <strong>Tenant override enabled</strong> — when on, scanner uses these parameters instead of
          merged global catalog filters.
        </span>
      </label>

      <section className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-3 rounded border border-[var(--xf-muted-border)] p-4">
          <legend className="px-1 text-sm font-semibold text-[var(--xf-text-100)]">Scanner filters</legend>
          <label className="block text-sm">
            <span className="text-[var(--xf-text-400)]">Min IV rank (%)</span>
            <input
              type="number"
              min={1}
              max={99}
              className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
              value={draft.minIvRankPct}
              onChange={(e) => setDraft({ ...draft, minIvRankPct: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--xf-text-400)]">Min DTE</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
                value={draft.minDte}
                placeholder="Any"
                onChange={(e) => setDraft({ ...draft, minDte: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--xf-text-400)]">Max DTE</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
                value={draft.maxDte}
                placeholder="Any"
                onChange={(e) => setDraft({ ...draft, maxDte: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="w-full text-[var(--xf-text-400)]">Option types</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.optionTypesCall}
                onChange={(e) => setDraft({ ...draft, optionTypesCall: e.target.checked })}
              />
              Calls
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.optionTypesPut}
                onChange={(e) => setDraft({ ...draft, optionTypesPut: e.target.checked })}
              />
              Puts
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="w-full text-[var(--xf-text-400)]">Sources</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.sourcesPosition}
                onChange={(e) => setDraft({ ...draft, sourcesPosition: e.target.checked })}
              />
              Positions
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.sourcesWatchlist}
                onChange={(e) => setDraft({ ...draft, sourcesWatchlist: e.target.checked })}
              />
              Watchlist
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--xf-text-400)]">Underlying denylist (comma-separated)</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
              value={draft.underlyingDenylist}
              onChange={(e) => setDraft({ ...draft, underlyingDenylist: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--xf-text-400)]">Underlying allowlist (comma-separated)</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
              value={draft.underlyingAllowlist}
              onChange={(e) => setDraft({ ...draft, underlyingAllowlist: e.target.value })}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3 rounded border border-[var(--xf-muted-border)] p-4">
          <legend className="px-1 text-sm font-semibold text-[var(--xf-text-100)]">Engine parameters</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--xf-text-400)]">Straddle Δ min</span>
              <input
                type="number"
                step={0.01}
                min={0.01}
                max={0.99}
                className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
                value={draft.straddleDeltaMin}
                onChange={(e) => setDraft({ ...draft, straddleDeltaMin: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--xf-text-400)]">Straddle Δ max</span>
              <input
                type="number"
                step={0.01}
                min={0.01}
                max={0.99}
                className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
                value={draft.straddleDeltaMax}
                onChange={(e) => setDraft({ ...draft, straddleDeltaMax: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--xf-text-400)]">Min fit score (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 font-mono text-sm"
              value={draft.minFitScore}
              onChange={(e) => setDraft({ ...draft, minFitScore: e.target.value })}
            />
          </label>
          <p className="text-xs text-[var(--xf-text-400)]">
            Straddle target Δ stays at product default (0.225). JVM engine reads tenant bounds when
            Spring strategy jobs run with tenant context.
          </p>
        </fieldset>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded bg-[var(--xf-gain-green)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          <SaveIcon /> Save strategy engine config
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-[var(--xf-muted-border)] px-3 py-2 text-sm text-[var(--xf-text-200)]"
          onClick={() => void refresh()}
          disabled={loading || saving}
        >
          <RefreshIcon /> Reload
        </button>
        <button
          type="button"
          className="rounded border border-[var(--xf-muted-border)] px-3 py-2 text-sm text-[var(--xf-text-400)]"
          onClick={() => void handleResetToProductDefaults()}
          disabled={saving}
        >
          Clear tenant overrides
        </button>
      </div>

      {status ? <p className="text-sm text-[var(--xf-text-300)]">{status}</p> : null}
    </div>
  );
}
