"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

import { PortfolioManageNav } from "./portfolio-manage-nav";

type ChannelRow = {
  _id: string;
  kind: "email" | "slack_webhook" | "sms" | "push";
  label: string;
  destination: string;
  enabled: boolean;
};

const KINDS = ["email", "slack_webhook", "sms", "push"] as const;

export function AdminPortfolioDeliveryChannelsConsole({ portfolioId }: { portfolioId: string }) {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<ChannelRow>>>({});
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);

  const base = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/delivery-channels`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: ChannelRow[] }>(await fetch(base, { cache: "no-store" }));
      setRows(payload.data);
      setEdits({});
      setStatus(`Loaded ${payload.data.length} channel(s)`);
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
  const merge = (r: ChannelRow): ChannelRow => ({ ...r, ...draft(r._id) });
  const dirty = (r: ChannelRow): boolean => {
    const d = draft(r._id);
    return (
      (d.kind !== undefined && d.kind !== r.kind) ||
      (d.label !== undefined && d.label !== r.label) ||
      (d.destination !== undefined && d.destination !== r.destination) ||
      (d.enabled !== undefined && d.enabled !== r.enabled)
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
            kind: String(fd.get("kind") ?? "email"),
            label: String(fd.get("label") ?? ""),
            destination: String(fd.get("destination") ?? "")
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

  const saveRow = async (r: ChannelRow) => {
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
            kind: m.kind,
            label: m.label,
            destination: m.destination,
            enabled: m.enabled
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

  const deleteRow = async (r: ChannelRow) => {
    if (!window.confirm(`Delete channel “${r.label}”?`)) return;
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
              kind: m.kind,
              label: m.label,
              destination: m.destination,
              enabled: m.enabled
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
      <PortfolioManageNav portfolioId={portfolioId} active="delivery_channels">
        <button type="button" className="cta cta-primary" disabled={loading || !hasAnyDirty} onClick={() => void saveAll()}>
          Save changes
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void refresh()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      <article className="surface-card xf-widget section-card">
        <h3>New delivery channel</h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          Stores notification endpoints per book (Mongo <code className="font-mono text-xs">portfolio_delivery_channels</code>
          ). Treat destinations as sensitive — restrict admin access in production.
        </p>
        <form className="stack-form" onSubmit={createRow}>
          <select name="kind" defaultValue="email" className="crud-input">
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input name="label" placeholder="Label" required className="crud-input" />
          <input name="destination" placeholder="Email, webhook URL, or handle" required className="crud-input" />
          <button type="submit" className="cta cta-primary" disabled={loading}>
            <AddIcon className="crud-icon" /> Create
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>All channels</h3>
        <div className="crud-table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Label</th>
                <th>Destination</th>
                <th>Enabled</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = merge(r);
                return (
                  <tr key={r._id}>
                    <td>
                      <select
                        className="crud-input text-xs"
                        value={m.kind}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], kind: e.target.value as ChannelRow["kind"] }
                          }))
                        }
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="crud-input text-xs"
                        value={m.label}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], label: e.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="crud-input font-mono text-xs"
                        value={m.destination}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [r._id]: { ...prev[r._id], destination: e.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [r._id]: { ...prev[r._id], enabled: e.target.checked }
                            }))
                          }
                        />
                        on
                      </label>
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
