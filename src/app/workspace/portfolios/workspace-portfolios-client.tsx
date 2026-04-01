"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditIcon, ListRowsIcon } from "@/app/admin/ui/crud-icons";
import { formatUsd2, formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import { portfolioKindChoiceLabel } from "@/modules/core-admin/types";

export type WorkspacePortfolioRow = {
  id: string;
  name: string;
  isDefault: boolean;
  portfolioKind: "real_estate" | "investments" | null;
  valueUsd: number;
  kindLabel: string;
};

/** @deprecated Use WorkspacePortfolioRow — alias for callers migrating from manage-workspace. */
export type ManagePortfolioRow = WorkspacePortfolioRow;

type Props = {
  initialRows: WorkspacePortfolioRow[];
};

function WorkspacePortfoliosAllocationChart({ rows }: { rows: WorkspacePortfolioRow[] }) {
  const { totalUsd, slices } = useMemo(() => {
    const totalUsd = rows.reduce((s, r) => s + Math.max(0, r.valueUsd), 0);
    const safe = totalUsd > 0 ? totalUsd : 1;
    const slices = rows.map((r) => ({
      id: r.id,
      label: r.name,
      percent: (Math.max(0, r.valueUsd) / safe) * 100,
      valueUsd: r.valueUsd
    }));
    return { totalUsd, slices };
  }, [rows]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <aside className="portfolio-top-band__charts xf-noise-overlay mb-1" aria-label="Book value by portfolio">
      <div className="portfolio-top-band__charts-inner">
        <section className="portfolio-panel portfolio-panel--tight">
          <h3 className="portfolio-panel__title portfolio-panel__title--sub">By portfolio</h3>
          <p className="portfolio-metric__label mb-2">
            Total (all portfolios):{" "}
            <span className="font-mono text-[var(--xf-text-100)] tabular-nums">{formatUsdWhole(totalUsd)}</span>
          </p>
          <div className="portfolio-allocation">
            <div className="portfolio-allocation__bar portfolio-allocation__bar--accounts" role="presentation">
              {slices.map((s) => (
                <div
                  key={s.id}
                  className="portfolio-allocation__segment"
                  style={{ flexGrow: Math.max(s.percent, 0.01) }}
                  title={`${s.label}: ${s.percent.toFixed(1)}% (${formatUsd2(s.valueUsd)})`}
                />
              ))}
            </div>
            <ul className="portfolio-allocation__legend portfolio-allocation__legend--plain">
              {slices.map((s) => (
                <li key={s.id}>
                  <span className="min-w-0 truncate" title={s.label}>
                    {s.label}
                  </span>
                  <span>{s.percent.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function WorkspacePortfoliosClient({ initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [selectedId, setSelectedId] = useState<string | null>(initialRows[0]?.id ?? null);

  useEffect(() => {
    setRows(initialRows);
    if (initialRows.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && initialRows.some((r) => r.id === prev) ? prev : initialRows[0].id
    );
  }, [initialRows]);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("investments");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"portfolios" | "edit">("portfolios");

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const syncFormFromRow = useCallback((row: WorkspacePortfolioRow | null) => {
    if (!row) {
      setName("");
      setKind("investments");
      setIsDefault(false);
      return;
    }
    setName(row.name);
    setKind(row.portfolioKind === "real_estate" ? "real_estate" : "investments");
    setIsDefault(row.isDefault);
  }, []);

  useEffect(() => {
    if (creating) {
      return;
    }
    const row = rows.find((r) => r.id === selectedId);
    if (row) {
      syncFormFromRow(row);
    }
  }, [creating, selectedId, rows, syncFormFromRow]);

  const selectRow = (id: string) => {
    setCreating(false);
    setError(null);
    setSelectedId(id);
    setWorkspaceTab("edit");
    const row = rows.find((r) => r.id === id);
    if (row) {
      syncFormFromRow(row);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setWorkspaceTab("edit");
    setName("");
    setKind("investments");
    setIsDefault(rows.length === 0);
    setError(null);
  };

  const saveCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          isDefault: isDefault || undefined,
          portfolioKind: kind === "real_estate" ? "real_estate" : "investments"
        })
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { _id?: string }; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Create failed");
        return;
      }
      const id = json.data?._id;
      router.refresh();
      if (id) {
        setCreating(false);
        setSelectedId(id);
      }
    } finally {
      setBusy(false);
    }
  };

  const savePatch = async () => {
    if (!selectedId || !selected) {
      setError("Select a portfolio to edit.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmed,
        portfolioKind: kind === "real_estate" ? "real_estate" : "investments",
        isDefault
      };
      const res = await fetch(`/api/portfolios/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      const kl = portfolioKindChoiceLabel(kind === "real_estate" ? "real_estate" : "investments");
      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                name: trimmed,
                portfolioKind: kind === "real_estate" ? "real_estate" : "investments",
                isDefault,
                kindLabel: kl
              }
            : isDefault
              ? { ...r, isDefault: false }
              : r
        )
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId) {
      return;
    }
    if (!window.confirm("Delete this portfolio and all accounts, positions, and watchlist data under it?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolios/${selectedId}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Delete failed");
        return;
      }
      const next = rows.filter((r) => r.id !== selectedId);
      setRows(next);
      setSelectedId(next[0]?.id ?? null);
      if (next[0]) {
        syncFormFromRow(next[0]);
      } else {
        startCreate();
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <WorkspacePortfoliosAllocationChart rows={rows} />

      <nav className="portfolio-manage-tabs" role="tablist" aria-label="Portfolio workspace">
        <button
          type="button"
          role="tab"
          id="workspace-tab-portfolios"
          aria-selected={workspaceTab === "portfolios"}
          aria-controls="workspace-panel-portfolios"
          className={`portfolio-manage-tabs__btn${workspaceTab === "portfolios" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("portfolios")}
        >
          <ListRowsIcon className="crud-icon" aria-hidden />
          My portfolios
        </button>
        <button
          type="button"
          role="tab"
          id="workspace-tab-edit"
          aria-selected={workspaceTab === "edit"}
          aria-controls="workspace-panel-edit"
          className={`portfolio-manage-tabs__btn${workspaceTab === "edit" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("edit")}
        >
          <EditIcon className="crud-icon" aria-hidden />
          Edit portfolio
        </button>
      </nav>

      {workspaceTab === "portfolios" ? (
        <div
          className="portfolio-manage-tabs__panel min-w-0"
          role="tabpanel"
          id="workspace-panel-portfolios"
          aria-labelledby="workspace-tab-portfolios"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="portfolio-panel__title text-base">All portfolios</h2>
            <button
              className="rounded-md border border-[var(--xf-border)] bg-[var(--xf-bg-800)] px-3 py-1.5 text-sm text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
              type="button"
              onClick={startCreate}
            >
              Add portfolio
            </button>
          </div>
          <div className="portfolio-table-wrap overflow-x-auto">
            <table className="portfolio-manage-table min-w-[480px] w-full">
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Name</th>
                  <th scope="col">Default</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selectedId === row.id && !creating ? "bg-[var(--xf-bg-800)]/80" : undefined
                    }
                  >
                    <td>
                      <button
                        aria-pressed={selectedId === row.id && !creating}
                        className="portfolio-manage-table__row-select-btn"
                        type="button"
                        onClick={() => selectRow(row.id)}
                      >
                        {selectedId === row.id && !creating ? "Selected" : "Select"}
                      </button>
                    </td>
                    <td className="font-medium text-[var(--xf-text-100)]">{row.name}</td>
                    <td>{row.isDefault ? <span className="text-[var(--xf-gain-green)]">Yes</span> : "—"}</td>
                    <td className="text-[var(--xf-text-200)] text-sm">{row.kindLabel}</td>
                    <td className="text-right font-mono text-sm tabular-nums">{formatUsd2(row.valueUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {workspaceTab === "edit" ? (
        <div
          className="portfolio-manage-tabs__panel min-w-0"
          role="tabpanel"
          id="workspace-panel-edit"
          aria-labelledby="workspace-tab-edit"
        >
          <h2 className="portfolio-panel__title mb-4 text-base">
            {creating ? "New portfolio" : "Edit portfolio"}
          </h2>
          {error ? (
            <p className="mb-3 rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}
          <div className="portfolio-manage-form flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--xf-text-200)]">Name</span>
              <input
                className="crud-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Portfolio name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--xf-text-200)]">Type</span>
              <select className="crud-input" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="investments">{portfolioKindChoiceLabel("investments")}</option>
                <option value="real_estate">{portfolioKindChoiceLabel("real_estate")}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--xf-text-200)]">
              <input
                checked={isDefault}
                className="accent-[var(--xf-gain-green)]"
                type="checkbox"
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Default portfolio
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {creating ? (
                <button
                  className="rounded-md bg-[var(--xf-gain-green)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                  disabled={busy}
                  type="button"
                  onClick={saveCreate}
                >
                  {busy ? "Saving…" : "Create"}
                </button>
              ) : (
                <>
                  <button
                    className="rounded-md bg-[var(--xf-gain-green)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                    disabled={busy || !selectedId}
                    type="button"
                    onClick={savePatch}
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="rounded-md border border-red-500/50 bg-red-950/30 px-4 py-2 text-sm text-red-200 hover:bg-red-950/50 disabled:opacity-50"
                    disabled={busy || !selectedId}
                    type="button"
                    onClick={remove}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use WorkspacePortfoliosClient */
export const ManageWorkspacePortfoliosClient = WorkspacePortfoliosClient;
