"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminScoringFactorVisual } from "@/app/admin/portfolios/ui/admin-scoring-factor-visuals";
import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import {
  DEFAULT_PORTFOLIO_SCORING_FACTORS,
  SCORING_FACTOR_CATALOG,
  SCORING_FACTOR_IDS,
  SCORING_FORMULA_DESCRIPTION,
  type ScoringFactorId
} from "@/modules/core-admin/scoring-factors";

type ScoringRowApi = {
  id: string;
  weight: number;
  label: string;
  description: string;
  normalization: string;
};

type DraftRow = {
  id: ScoringFactorId;
  enabled: boolean;
  percent: number;
  label: string;
  description: string;
  normalization: string;
};

function apiRowsToDraft(rows: ScoringRowApi[]): DraftRow[] {
  const byId = new Map(rows.map((r) => [r.id as ScoringFactorId, r]));
  return SCORING_FACTOR_IDS.map((id) => {
    const r = byId.get(id);
    const c = SCORING_FACTOR_CATALOG[id];
    return {
      id,
      enabled: Boolean(r && r.weight > 0),
      percent: r ? Math.round(r.weight * 100) : 0,
      label: r?.label ?? c.label,
      description: r?.description ?? c.description,
      normalization: r?.normalization ?? c.normalization
    };
  });
}

function defaultDraftFromCatalog(): DraftRow[] {
  return SCORING_FACTOR_IDS.map((id) => {
    const c = SCORING_FACTOR_CATALOG[id];
    const f = DEFAULT_PORTFOLIO_SCORING_FACTORS.find((x) => x.id === id)!;
    return {
      id,
      enabled: true,
      percent: Math.round(f.weight * 100),
      label: c.label,
      description: c.description,
      normalization: c.normalization
    };
  });
}

type Props = {
  tenantId: string;
};

export function AdminPortfolioScoringDefaultsPanel({ tenantId }: Props) {
  const [draft, setDraft] = useState<DraftRow[]>(() => defaultDraftFromCatalog());
  const [hasTenantOverride, setHasTenantOverride] = useState(false);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(true);

  const base = `/api/admin/tenants/${encodeURIComponent(tenantId)}/portfolio-scoring-defaults`;

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const json = await parseJson<{
        data: { scoringFactors: ScoringRowApi[]; hasTenantOverride?: boolean; slug?: string };
      }>(await fetch(base, { cache: "no-store", credentials: "include" }));
      setSlug(json.data.slug ?? "");
      setHasTenantOverride(Boolean(json.data.hasTenantOverride));
      setDraft(apiRowsToDraft(json.data.scoringFactors));
      setStatus("Ready");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledSum = useMemo(
    () => draft.filter((r) => r.enabled).reduce((s, r) => s + r.percent, 0),
    [draft]
  );
  const enabledCount = useMemo(() => draft.filter((r) => r.enabled).length, [draft]);

  const setRow = (id: ScoringFactorId, patch: Partial<Pick<DraftRow, "enabled" | "percent">>) => {
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const applyCatalogDefaults = () => {
    setDraft(defaultDraftFromCatalog());
    setStatus("Form reset to product defaults (not saved)");
  };

  const save = async () => {
    const enabled = draft.filter((r) => r.enabled);
    if (enabled.length === 0) {
      setStatus("Enable at least one factor");
      return;
    }
    if (enabledSum !== 100) {
      setStatus(`Percents for enabled factors must sum to 100 (currently ${enabledSum})`);
      return;
    }
    const body = enabled.map((r) => ({
      id: r.id,
      weight: r.percent / 100
    }));
    setLoading(true);
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(base, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultPortfolioScoringFactors: body })
        })
      );
      setStatus("Saved");
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const clearTenantDefault = async () => {
    if (
      !window.confirm(
        "Remove tenant default weights? New books will use product defaults until you save again, unless a portfolio has its own override."
      )
    ) {
      return;
    }
    setLoading(true);
    setStatus("Clearing…");
    try {
      await parseJson(
        await fetch(base, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultPortfolioScoringFactors: null })
        })
      );
      setStatus("Cleared — showing product defaults");
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="xf-widget section-card admin-tenant-pref-form" style={{ maxWidth: 960 }}>
      <p className="admin-muted" style={{ marginBottom: "0.75rem" }}>
        Weights apply to <strong>new portfolios</strong> (admin create) and to books that do not store their own{" "}
        <code className="font-mono text-xs">scoringFactors</code> override. Per-book edits stay under{" "}
        <strong>Admin → Portfolios → Scoring</strong>.
      </p>
      <p className="text-sm font-mono" style={{ color: "var(--xf-text-muted, var(--xf-slate-400))" }}>
        {SCORING_FORMULA_DESCRIPTION}
      </p>
      {slug ? (
        <p className="status-text mt-2">
          Tenant <code className="font-mono text-xs">{slug}</code>
          {hasTenantOverride ? (
            <span> — custom default stored</span>
          ) : (
            <span> — using product defaults (nothing stored on tenant)</span>
          )}
        </p>
      ) : null}

      <div className="tool-row mt-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" className="cta cta-primary" disabled={loading} onClick={() => void save()}>
          <SaveIcon className="crud-icon" /> Save tenant default
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void load()}>
          <RefreshIcon className="crud-icon" /> Reload
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={applyCatalogDefaults}>
          Reset form to product defaults
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void clearTenantDefault()}>
          Clear tenant default
        </button>
        <span className="status-text">
          {status} — enabled sum: {enabledSum}% / 100% ({enabledCount} factor(s))
        </span>
      </div>

      <div className="crud-table-wrap mt-4">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Use</th>
              <th>Factor</th>
              <th>Weight %</th>
              <th>Description</th>
              <th>Normalization</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => setRow(row.id, { enabled: e.target.checked })}
                    aria-label={`Include ${row.label}`}
                  />
                </td>
                <td>
                  <div className="admin-scoring-factor-cell">
                    <AdminScoringFactorVisual id={row.id} />
                    <div>
                      <div className="admin-scoring-factor-cell__name">{row.label}</div>
                      <div className="admin-scoring-factor-cell__id">{row.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ width: 100 }}>
                  <input
                    className="crud-input text-right"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={!row.enabled}
                    value={row.enabled ? row.percent : 0}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setRow(row.id, { percent: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 });
                    }}
                    aria-label={`Weight percent for ${row.label}`}
                  />
                </td>
                <td className="text-xs" style={{ maxWidth: 280 }}>
                  {row.description}
                </td>
                <td className="text-xs opacity-90" style={{ maxWidth: 220 }}>
                  {row.normalization}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
