"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

import { PortfolioManageNav } from "./portfolio-manage-nav";

type AlertRow = {
  _id: string;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "dismissed";
  symbol: string | null;
};

const SEVERITIES = ["info", "warning", "critical"] as const;
const STATUSES = ["active", "acknowledged", "dismissed"] as const;

export function AdminPortfolioAlertsConsole({ portfolioId }: { portfolioId: string }) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<AlertRow>>>({});
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);

  const base = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/alerts`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: AlertRow[] }>(await fetch(base, { cache: "no-store" }));
      setRows(payload.data);
      setEdits({});
      setStatus(`Loaded ${payload.data.length} alert(s)`);
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
  const merge = (r: AlertRow): AlertRow => ({ ...r, ...draft(r._id) });
  const dirty = (r: AlertRow): boolean => {
    const d = draft(r._id);
    return (
      (d.title !== undefined && d.title !== r.title) ||
      (d.body !== undefined && d.body !== r.body) ||
      (d.severity !== undefined && d.severity !== r.severity) ||
      (d.status !== undefined && d.status !== r.status) ||
      (d.symbol !== undefined && d.symbol !== r.symbol)
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
            title: String(fd.get("title") ?? ""),
            body: String(fd.get("body") ?? "") || undefined,
            severity: String(fd.get("severity") ?? "info"),
            symbol: String(fd.get("symbol") ?? "") || undefined
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

  const patchBody = (m: AlertRow) => ({
    title: m.title,
    body: m.body === "" ? null : m.body,
    severity: m.severity,
    status: m.status,
    symbol: m.symbol === "" || m.symbol === null ? null : m.symbol
  });

  const saveRow = async (r: AlertRow) => {
    if (!dirty(r)) return;
    const m = merge(r);
    setLoading(true);
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(`${base}/${encodeURIComponent(r._id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody(m))
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

  const deleteRow = async (r: AlertRow) => {
    if (!window.confirm(`Delete alert “${r.title}”?`)) return;
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
            body: JSON.stringify(patchBody(m))
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
      <PortfolioManageNav portfolioId={portfolioId} active="alerts">
        <button type="button" className="cta cta-primary" disabled={loading || !hasAnyDirty} onClick={() => void saveAll()}>
          <SaveIcon className="crud-icon" /> Save changes
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void refresh()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      <article className="surface-card xf-widget section-card">
        <h3>New alert</h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          Portfolio-scoped desk alerts (Mongo <code className="font-mono text-xs">portfolio_alerts</code>). Not wired to
          push delivery yet — use <strong>Delivery channels</strong> for endpoints.
        </p>
        <form className="stack-form" onSubmit={createRow}>
          <input name="title" placeholder="Title" required className="crud-input" />
          <textarea name="body" placeholder="Body (optional)" className="crud-input" rows={2} />
          <select name="severity" defaultValue="info" className="crud-input">
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input name="symbol" placeholder="Symbol (optional)" className="crud-input" />
          <button type="submit" className="cta cta-primary" disabled={loading}>
            <AddIcon className="crud-icon" /> Create
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>All alerts</h3>
        <div className="crud-table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Symbol</th>
                <th>Body</th>
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
                        className="crud-input text-xs"
                        value={m.title}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], title: e.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="crud-input text-xs"
                        value={m.severity}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], severity: e.target.value as AlertRow["severity"] }
                          }))
                        }
                      >
                        {SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
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
                            [r._id]: { ...prev[r._id], status: e.target.value as AlertRow["status"] }
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
                        className="crud-input font-mono text-xs"
                        value={m.symbol ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], symbol: e.target.value.toUpperCase() || null }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="crud-input text-xs"
                        value={m.body ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], body: e.target.value || null }
                          }))
                        }
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
