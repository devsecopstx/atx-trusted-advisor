"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditIcon, ListRowsIcon } from "@/app/admin/ui/crud-icons";
import { canonicalMongoObjectIdHex, isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import { formatUsd2 } from "@/lib/portfolio-overview-metrics";
import { portfolioKindChoiceLabel } from "@/modules/core-admin/types";

export type WorkspacePortfolioRow = {
  id: string;
  name: string;
  isDefault: boolean;
  portfolioKind: "real_estate" | "investments" | null;
  valueUsd: number;
  kindLabel: string;
};

/** @deprecated Use WorkspacePortfolioRow */
export type ManagePortfolioRow = WorkspacePortfolioRow;

export type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

type Props = {
  focusPortfolioId: string | null;
  initialRows: WorkspacePortfolioRow[];
};

export function PortfoliosDashboardClient({ focusPortfolioId, initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [creating, setCreating] = useState(false);

  const normalizedFocusId =
    focusPortfolioId && isLikelyMongoObjectIdHex(focusPortfolioId)
      ? canonicalMongoObjectIdHex(focusPortfolioId)
      : focusPortfolioId;

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (normalizedFocusId && initialRows.some((r) => r.id === normalizedFocusId)) {
      return normalizedFocusId;
    }
    return initialRows.find((r) => r.isDefault)?.id ?? initialRows[0]?.id ?? null;
  });

  /** Canonicalize `?focus=` in the address bar (mixed-case hex breaks server-side Set lookup). */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const u = new URL(window.location.href);
      const raw = u.searchParams.get("focus")?.trim() ?? "";
      if (!raw || !isLikelyMongoObjectIdHex(raw)) {
        return;
      }
      const c = canonicalMongoObjectIdHex(raw);
      if (c === raw) {
        return;
      }
      u.searchParams.set("focus", c);
      router.replace(`${u.pathname}${u.search}`, { scroll: false });
    } catch {
      // ignore
    }
  }, [router]);

  useEffect(() => {
    setRows(initialRows);
    if (initialRows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!creating) {
      const fid =
        normalizedFocusId && initialRows.some((r) => r.id === normalizedFocusId)
          ? normalizedFocusId
          : initialRows.find((r) => r.isDefault)?.id ?? initialRows[0].id;
      setSelectedId(fid);
    }
  }, [initialRows, normalizedFocusId, creating]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("investments");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"portfolios" | "edit">("portfolios");
  const [manageNavPortfolioId, setManageNavPortfolioId] = useState<string | null>(null);

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
    setWorkspaceTab("portfolios");
    const row = rows.find((r) => r.id === id);
    if (row) {
      syncFormFromRow(row);
    }
    router.replace(`/portfolios?focus=${encodeURIComponent(id)}`);
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
      if (id) {
        setCreating(false);
        setSelectedId(id);
        router.replace(`/portfolios?focus=${encodeURIComponent(id)}`);
      }
      router.refresh();
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

  const goManagePortfolio = async (portfolioId: string) => {
    setManageNavPortfolioId(portfolioId);
    try {
      const res = await fetch("/api/user/workspace-portfolio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(body.error ?? "Could not open portfolio");
        return;
      }
      router.push("/portfolio");
    } finally {
      setManageNavPortfolioId(null);
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
      const n = next[0]?.id ?? null;
      setSelectedId(n);
      if (next[0]) {
        syncFormFromRow(next[0]);
        router.replace(n ? `/portfolios?focus=${encodeURIComponent(n)}` : "/portfolios");
      } else {
        router.replace("/portfolios");
        startCreate();
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <nav className="portfolio-manage-tabs" role="tablist" aria-label="Portfolios">
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
          Portfolios
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
            <h2 className="portfolio-panel__title text-base">Your portfolios</h2>
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
                  <th scope="col">Focus</th>
                  <th scope="col">Name</th>
                  <th scope="col">Default</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">
                    Value
                  </th>
                  <th scope="col" className="text-right whitespace-nowrap">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selectedId === row.id && !creating
                        ? "bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_10%,var(--xf-bg-900))]"
                        : undefined
                    }
                  >
                    <td>
                      <button
                        aria-pressed={selectedId === row.id && !creating}
                        className="portfolio-manage-table__row-select-btn"
                        type="button"
                        onClick={() => selectRow(row.id)}
                      >
                        {selectedId === row.id && !creating ? "Focused" : "Focus"}
                      </button>
                    </td>
                    <td className="font-medium text-[var(--xf-text-100)]">{row.name}</td>
                    <td>
                      {row.isDefault ? (
                        <span className="font-medium text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]">
                          Yes
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-[var(--xf-text-200)] text-sm">{row.kindLabel}</td>
                    <td className="text-right font-mono text-sm tabular-nums">{formatUsd2(row.valueUsd)}</td>
                    <td className="text-right">
                      <button
                        className="portfolio-table-link border-0 bg-transparent p-0 text-sm font-medium underline-offset-2 hover:underline disabled:cursor-not-allowed"
                        type="button"
                        disabled={manageNavPortfolioId === row.id}
                        onClick={() => void goManagePortfolio(row.id)}
                      >
                        {manageNavPortfolioId === row.id ? "Opening…" : "Manage portfolio"}
                      </button>
                    </td>
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
            {!creating && selectedId ? (
              <p className="text-xs text-[var(--xf-text-300)]">
                Portfolio id (APIs &amp; admin):{" "}
                <span className="font-mono text-[var(--xf-text-200)]">{selectedId}</span>
              </p>
            ) : null}
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
                className="accent-[var(--xf-tenant-accent,var(--xf-xoptions-accent))]"
                type="checkbox"
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Default portfolio
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {creating ? (
                <button
                  className="rounded-md bg-[var(--xf-tenant-accent,var(--xf-xoptions-accent))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={busy}
                  type="button"
                  onClick={saveCreate}
                >
                  {busy ? "Saving…" : "Create"}
                </button>
              ) : (
                <>
                  <button
                    className="rounded-md bg-[var(--xf-tenant-accent,var(--xf-xoptions-accent))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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

/** @deprecated Use PortfoliosDashboardClient */
export const WorkspacePortfoliosClient = PortfoliosDashboardClient;

/** @deprecated Use PortfoliosDashboardClient */
export const ManageWorkspacePortfoliosClient = PortfoliosDashboardClient;
