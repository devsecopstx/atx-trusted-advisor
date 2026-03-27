"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import {
    DEFAULT_PORTFOLIO_SCORING_FACTORS,
    SCORING_FACTOR_CATALOG,
    SCORING_FACTOR_IDS,
    SCORING_FORMULA_DESCRIPTION,
    type ScoringFactorId
} from "@/modules/core-admin/scoring-factors";

import { AdminScoringFactorVisual } from "./admin-scoring-factor-visuals";
import { PortfolioManageNav } from "./portfolio-manage-nav";

type ScoringRowApi = {
  id: string;
  weight: number;
  label: string;
  description: string;
  normalization: string;
};

type PortfolioPayload = {
  _id: string;
  name: string;
  userId: string;
  scoringFactors: ScoringRowApi[];
};

type DraftRow = {
  id: ScoringFactorId;
  enabled: boolean;
  /** Whole percent 0–100 among enabled rows; enabled rows must sum to 100 before save. */
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

export function AdminPortfolioScoringConsole({ portfolioId }: { portfolioId: string }) {
  const [portfolioName, setPortfolioName] = useState("");
  const [draft, setDraft] = useState<DraftRow[]>(() => defaultDraftFromCatalog());
  const [status, setStatus] = useState("Loading…");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const res = await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}`, { cache: "no-store" });
      const json = await parseJson<{ data: PortfolioPayload }>(res);
      setPortfolioName(json.data.name);
      setDraft(apiRowsToDraft(json.data.scoringFactors));
      setStatus("Ready");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

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
    setStatus("Form reset to default weights (not saved)");
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
        await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scoringFactors: body })
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

  const clearOverride = async () => {
    if (!window.confirm("Remove stored scoring factors? API will use built-in defaults for this portfolio.")) {
      return;
    }
    setLoading(true);
    setStatus("Clearing…");
    try {
      await parseJson(
        await fetch(`/api/admin/portfolios/${encodeURIComponent(portfolioId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scoringFactors: null })
        })
      );
      setStatus("Cleared — showing defaults");
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel stack-gap" style={{ maxWidth: 960 }}>
      <PortfolioManageNav portfolioId={portfolioId} active="scoring">
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void load()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
      </PortfolioManageNav>

      <header>
        <h2 className="text-xl font-semibold">Portfolio scoring factors</h2>
        <p className="status-text mt-1">
          Portfolio{" "}
          <Link className="underline font-medium" href={`/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`}>
            {portfolioName || portfolioId.slice(0, 8) + "…"}
          </Link>
        </p>
      </header>

      <p className="text-sm font-mono" style={{ color: "var(--xf-text-muted, var(--xf-slate-400))" }}>
        {SCORING_FORMULA_DESCRIPTION}
      </p>

      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" className="cta cta-primary" disabled={loading} onClick={() => void save()}>
          Save weights
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={applyCatalogDefaults}>
          Reset form to defaults
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void clearOverride()}>
          Clear stored override
        </button>
        <span className="status-text">
          {status} — enabled sum: {enabledSum}% / 100% ({enabledCount} factor(s))
        </span>
      </div>

      <div className="crud-table-wrap">
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
