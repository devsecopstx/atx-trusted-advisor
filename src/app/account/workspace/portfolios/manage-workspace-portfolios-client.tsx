"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { OutlookIconFor, outlookIconClassForSlug } from "@/app/ui/outlook-icons";
import { formatUsd2 } from "@/lib/portfolio-overview-metrics";
import {
    type AccountOutlook,
    accountOutlookChoiceLabels,
    accountOutlookDisplayLabel,
    parseAccountOutlook,
    portfolioKindChoiceLabel
} from "@/modules/core-admin/types";

export type ManagePortfolioRow = {
  id: string;
  name: string;
  isDefault: boolean;
  outlook: string | null;
  broker_type: string | null;
  portfolioKind: "real_estate" | "investments" | null;
  valueUsd: number;
  outlookLabel: string;
  brokerLabel: string;
  /** From broker catalog when `broker_type` matches. */
  brokerIconUrl: string | null;
  kindLabel: string;
};

export type BrokerOption = { type: string; name: string; iconUrl?: string | null };

type Props = {
  initialRows: ManagePortfolioRow[];
  brokers: BrokerOption[];
};

function BrokerGlyph({
  iconUrl,
  size = 20
}: {
  iconUrl?: string | null;
  /** Pixel width/height (square). */
  size?: number;
}) {
  if (!iconUrl?.trim()) {
    return null;
  }
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center">
      {/* Broker catalog may use /public paths or absolute URLs — avoid next/image remote config coupling. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="object-contain"
        decoding="async"
        height={size}
        loading="lazy"
        src={iconUrl}
        width={size}
      />
    </span>
  );
}

export function ManageWorkspacePortfoliosClient({ initialRows, brokers }: Props) {
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
  const [outlook, setOutlook] = useState<string>("");
  const [brokerType, setBrokerType] = useState<string>("");
  const [kind, setKind] = useState<string>("investments");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const selectedBroker = useMemo(() => {
    const key = brokerType.trim().toLowerCase();
    if (!key) {
      return null;
    }
    return brokers.find((b) => b.type.toLowerCase() === key) ?? null;
  }, [brokerType, brokers]);

  const outlookForGlyph = parseAccountOutlook(outlook);

  const syncFormFromRow = useCallback((row: ManagePortfolioRow | null) => {
    if (!row) {
      setName("");
      setOutlook("");
      setBrokerType("");
      setKind("investments");
      setIsDefault(false);
      return;
    }
    setName(row.name);
    setOutlook(row.outlook ?? "");
    setBrokerType(row.broker_type ?? "");
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
    const row = rows.find((r) => r.id === id);
    if (row) {
      syncFormFromRow(row);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setName("");
    setOutlook("");
    setBrokerType(brokers[0]?.type ?? "");
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
          broker_type: brokerType.trim() || undefined,
          outlook: outlook === "" ? null : outlook,
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
        outlook: outlook === "" ? null : outlook,
        broker_type: brokerType.trim() === "" ? null : brokerType.trim().toLowerCase(),
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
      const ol = accountOutlookDisplayLabel(outlook === "" ? null : parseAccountOutlook(outlook));
      const btKey = brokerType.trim().toLowerCase();
      const brokerPick = brokerType.trim() === "" ? null : brokers.find((b) => b.type === btKey);
      const bl = brokerType.trim() === "" ? "—" : (brokerPick?.name ?? brokerType.trim());
      const bi = brokerPick?.iconUrl ?? null;
      const kl = portfolioKindChoiceLabel(kind === "real_estate" ? "real_estate" : "investments");
      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                name: trimmed,
                outlook: outlook === "" ? null : outlook,
                broker_type: brokerType.trim() === "" ? null : brokerType.trim().toLowerCase(),
                portfolioKind: kind === "real_estate" ? "real_estate" : "investments",
                isDefault,
                outlookLabel: ol,
                brokerLabel: bl,
                brokerIconUrl: bi,
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
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="surface-card xf-widget section-card p-4 md:p-6">
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
          <table className="portfolio-manage-table min-w-[720px] w-full">
            <thead>
              <tr>
                <th scope="col">Select</th>
                <th scope="col">Name</th>
                <th scope="col">Default</th>
                <th scope="col">Outlook</th>
                <th scope="col">Broker</th>
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
                    selectedId === row.id && !creating
                      ? "bg-[var(--xf-bg-800)]/80"
                      : undefined
                  }
                >
                  <td>
                    <button
                      aria-pressed={selectedId === row.id && !creating}
                      className="text-[var(--xf-gain-green)] text-sm underline-offset-2 hover:underline"
                      type="button"
                      onClick={() => selectRow(row.id)}
                    >
                      {selectedId === row.id && !creating ? "Selected" : "Select"}
                    </button>
                  </td>
                  <td className="font-medium text-[var(--xf-text-100)]">{row.name}</td>
                  <td>{row.isDefault ? <span className="text-[var(--xf-gain-green)]">Yes</span> : "—"}</td>
                  <td className="text-[var(--xf-text-200)] text-sm">
                    <span className="inline-flex items-center gap-2">
                      {row.outlook ? (
                        <span
                          className={`inline-flex shrink-0 ${outlookIconClassForSlug(row.outlook as AccountOutlook)}`}
                        >
                          <OutlookIconFor className="h-4 w-4" outlook={row.outlook as AccountOutlook} />
                        </span>
                      ) : null}
                      {row.outlookLabel}
                    </span>
                  </td>
                  <td className="text-[var(--xf-text-200)] text-sm">
                    <span className="inline-flex items-center gap-2">
                      <BrokerGlyph iconUrl={row.brokerIconUrl} />
                      {row.brokerLabel}
                    </span>
                  </td>
                  <td className="text-[var(--xf-text-200)] text-sm">{row.kindLabel}</td>
                  <td className="text-right font-mono text-sm tabular-nums">{formatUsd2(row.valueUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card xf-widget section-card p-4 md:p-6">
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
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--xf-text-200)]">Outlook</span>
            <div className="flex min-w-0 items-center gap-2">
              {outlookForGlyph ? (
                <span className={`inline-flex shrink-0 ${outlookIconClassForSlug(outlookForGlyph)}`}>
                  <OutlookIconFor className="h-5 w-5" outlook={outlookForGlyph} />
                </span>
              ) : (
                <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
              )}
              <select className="crud-input min-w-0 flex-1" value={outlook} onChange={(e) => setOutlook(e.target.value)}>
                <option value="">—</option>
                <option value="bullish">{accountOutlookChoiceLabels.bullish}</option>
                <option value="neutral">{accountOutlookChoiceLabels.neutral}</option>
                <option value="bearish">{accountOutlookChoiceLabels.bearish}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--xf-text-200)]">Broker</span>
            <div className="flex min-w-0 items-center gap-2">
              <BrokerGlyph iconUrl={selectedBroker?.iconUrl} size={24} />
              <select
                className="crud-input min-w-0 flex-1"
                value={brokerType}
                onChange={(e) => setBrokerType(e.target.value)}
              >
                <option value="">—</option>
                {brokers.map((b) => (
                  <option key={b.type} value={b.type}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
    </div>
  );
}
