"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

import { PortfolioManageNav } from "./portfolio-manage-nav";

type RecRow = {
  _id: string;
  symbol: string;
  action: "buy" | "sell" | "hold" | "watch";
  note: string | null;
  quantity: number | null;
  targetPrice: number | null;
  status: "new" | "accepted" | "executed" | "dismissed";
};

const ACTIONS = ["buy", "sell", "hold", "watch"] as const;
const STATUSES = ["new", "accepted", "executed", "dismissed"] as const;

export function AdminPortfolioRecommendationsConsole({ portfolioId }: { portfolioId: string }) {
  const [rows, setRows] = useState<RecRow[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<RecRow>>>({});
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);

  const base = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/recommendations`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: RecRow[] }>(await fetch(base, { cache: "no-store" }));
      setRows(payload.data);
      setEdits({});
      setStatus(`Loaded ${payload.data.length} recommendation(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const draft = (id: string) => edits[id] ?? {};
  const merge = (r: RecRow): RecRow => ({ ...r, ...draft(r._id) });
  const dirty = (r: RecRow): boolean => {
    const d = draft(r._id);
    return (
      (d.symbol !== undefined && d.symbol !== r.symbol) ||
      (d.action !== undefined && d.action !== r.action) ||
      (d.note !== undefined && d.note !== r.note) ||
      (d.quantity !== undefined && d.quantity !== r.quantity) ||
      (d.targetPrice !== undefined && d.targetPrice !== r.targetPrice) ||
      (d.status !== undefined && d.status !== r.status)
    );
  };
  const hasAnyDirty = rows.some((r) => dirty(r));

  async function createRow(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setLoading(true);
    setStatus("Creating…");
    try {
      await parseJson(
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: String(fd.get("symbol") ?? ""),
            action: String(fd.get("action") ?? "hold"),
            note: String(fd.get("note") ?? "") || undefined,
            quantity: fd.get("quantity")
              ? Number.parseFloat(String(fd.get("quantity")))
              : undefined,
            targetPrice: fd.get("targetPrice")
              ? Number.parseFloat(String(fd.get("targetPrice")))
              : undefined
          })
        })
      );
      ev.currentTarget.reset();
      setStatus("Created");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  const saveRow = async (r: RecRow) => {
    if (!dirty(r)) return;
    const m = merge(r);
    setLoading(true);
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(`${base}/${encodeURIComponent(r._id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: m.symbol,
            action: m.action,
            note: m.note === "" ? null : m.note,
            quantity: m.quantity === null || m.quantity === undefined ? null : m.quantity,
            targetPrice:
              m.targetPrice === null || m.targetPrice === undefined ? null : m.targetPrice,
            status: m.status
          })
        })
      );
      setEdits((prev) => {
        const n = { ...prev };
        delete n[r._id];
        return n;
      });
      setStatus("Saved");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (r: RecRow) => {
    if (!window.confirm(`Delete recommendation ${r.symbol}?`)) return;
    setLoading(true);
    try {
      await parseJson(await fetch(`${base}/${encodeURIComponent(r._id)}`, { method: "DELETE" }));
      setStatus("Deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    const targets = rows.filter((r) => dirty(r));
    if (targets.length === 0) return;
    setLoading(true);
    setStatus("Saving all…");
    try {
      for (const r of targets) {
        const m = merge(r);
        await parseJson(
          await fetch(`${base}/${encodeURIComponent(r._id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: m.symbol,
              action: m.action,
              note: m.note === "" ? null : m.note,
              quantity: m.quantity === null || m.quantity === undefined ? null : m.quantity,
              targetPrice:
                m.targetPrice === null || m.targetPrice === undefined ? null : m.targetPrice,
              status: m.status
            })
          })
        );
        setEdits((prev) => {
          const n = { ...prev };
          delete n[r._id];
          return n;
        });
      }
      setStatus(`Saved ${targets.length} row(s)`);
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel stack-gap">
      <PortfolioManageNav portfolioId={portfolioId} active="recommendations">
        <button type="button" className="cta cta-primary" disabled={loading || !hasAnyDirty} onClick={() => void saveAll()}>
          Save changes
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void refresh()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      <article className="surface-card xf-widget section-card">
        <h3>New recommendation</h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          Core book recommendations (Mongo <code className="font-mono text-xs">portfolio_recommendations</code>), same
          contract as user <code className="font-mono text-xs">/api/portfolios/…/recommendations</code>.
        </p>
        <form className="stack-form" onSubmit={createRow}>
          <input name="symbol" placeholder="Symbol" required className="crud-input" />
          <select name="action" defaultValue="hold" className="crud-input">
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input name="note" placeholder="Note (optional)" className="crud-input" />
          <input name="quantity" type="number" step="any" placeholder="Qty (optional)" className="crud-input" />
          <input name="targetPrice" type="number" step="any" placeholder="Target (optional)" className="crud-input" />
          <button type="submit" className="cta cta-primary" disabled={loading}>
            <AddIcon className="crud-icon" /> Create
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>All recommendations</h3>
        <div className="crud-table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Action</th>
                <th>Status</th>
                <th>Note</th>
                <th>Qty</th>
                <th>Target</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = merge(r);
                return (
                  <tr key={r._id}>
                    <td>
                      <input
                        className="crud-input font-mono text-xs"
                        value={m.symbol}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], symbol: e.target.value.toUpperCase() }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="crud-input text-xs"
                        value={m.action}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], action: e.target.value as RecRow["action"] }
                          }))
                        }
                      >
                        {ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="crud-input text-xs"
                        value={m.status}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], status: e.target.value as RecRow["status"] }
                          }))
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="crud-input text-xs"
                        value={m.note ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], note: e.target.value || null }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="crud-input text-xs"
                        type="number"
                        step="any"
                        value={m.quantity ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: {
                              ...prev[r._id],
                              quantity: v === "" ? null : Number.parseFloat(v)
                            }
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="crud-input text-xs"
                        type="number"
                        step="any"
                        value={m.targetPrice ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: {
                              ...prev[r._id],
                              targetPrice: v === "" ? null : Number.parseFloat(v)
                            }
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <div className="tool-row" style={{ gap: "0.25rem" }}>
                        <button
                          type="button"
                          className="cta cta-primary text-xs"
                          disabled={loading || !dirty(r)}
                          onClick={() => void saveRow(r)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="cta cta-secondary text-xs"
                          disabled={loading}
                          onClick={() => void deleteRow(r)}
                        >
                          <DeleteIcon className="crud-icon" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
