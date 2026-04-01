"use client";

import { useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type ChannelRow = {
  _id: string;
  name: string;
  deliveryTarget: "in_app" | "slack";
  slackWebhookUrl: string;
  createdAt: string;
  updatedAt: string;
};

const BASE = "/api/admin/delivery-channels";

export function AdminDeliveryChannelsCrud() {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState<"in_app" | "slack">("in_app");
  const [newSlackUrl, setNewSlackUrl] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: ChannelRow[] }>(await fetch(BASE, { cache: "no-store" }));
      setRows(payload.data);
      setStatus(`Loaded ${payload.data.length} channel(s)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createChannel() {
    const name = newName.trim();
    if (!name) {
      setStatus("Enter a name");
      return;
    }
    if (newTarget === "slack" && !newSlackUrl.trim()) {
      setStatus("Slack webhook URL is required for Slack channels");
      return;
    }
    setStatus("Creating…");
    try {
      await parseJson(
        await fetch(BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            deliveryTarget: newTarget,
            ...(newTarget === "slack" ? { slackWebhookUrl: newSlackUrl.trim() } : {})
          })
        })
      );
      setNewName("");
      setNewTarget("in_app");
      setNewSlackUrl("");
      setStatus("Created");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function saveRow(row: ChannelRow, draft: Partial<Pick<ChannelRow, "name" | "deliveryTarget" | "slackWebhookUrl">>) {
    setStatus(`Saving ${row.name}…`);
    try {
      await parseJson(
        await fetch(`${BASE}/${encodeURIComponent(row._id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(draft.name !== undefined ? { name: draft.name } : {}),
            ...(draft.deliveryTarget !== undefined ? { deliveryTarget: draft.deliveryTarget } : {}),
            ...(draft.slackWebhookUrl !== undefined ? { slackWebhookUrl: draft.slackWebhookUrl } : {})
          })
        })
      );
      setStatus("Saved");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function deleteRow(row: ChannelRow) {
    if (!window.confirm(`Delete channel “${row.name}”?`)) {
      return;
    }
    setStatus(`Deleting ${row.name}…`);
    try {
      await parseJson(await fetch(`${BASE}/${encodeURIComponent(row._id)}`, { method: "DELETE" }));
      setStatus("Deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function sendTest(row: ChannelRow) {
    setTestingId(row._id);
    setStatus("Sending test…");
    try {
      const payload = await parseJson<{ ok?: boolean; detail?: string; error?: string }>(
        await fetch(`${BASE}/${encodeURIComponent(row._id)}/test`, { method: "POST" })
      );
      if (payload.error) {
        setStatus(payload.error);
      } else {
        setStatus(payload.detail ?? "Test sent: hello from atx");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <article className="surface-card xf-widget section-card">
      <div className="tool-row" style={{ marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      <h3>Add channel</h3>
      <div
        className="grid gap-3"
        style={{
          marginBottom: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))"
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>Name</span>
          <input
            className="crud-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Ops alerts"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Delivery target</span>
          <select
            className="crud-input"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value as "in_app" | "slack")}
          >
            <option value="in_app">In-app</option>
            <option value="slack">Slack</option>
          </select>
        </label>
        {newTarget === "slack" ? (
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span>Slack webhook URL</span>
            <input
              className="crud-input font-mono text-xs"
              value={newSlackUrl}
              onChange={(e) => setNewSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
      </div>
      <button className="cta cta-primary mb-6" disabled={loading} onClick={() => void createChannel()} type="button">
        <AddIcon className="crud-icon" /> Add channel
      </button>

      <h3>Channels</h3>
      <p className="status-text" style={{ marginBottom: "0.5rem" }}>
        Edit a row and click <strong>Save</strong>, or use <strong>Send test</strong> for{" "}
        <code className="font-mono text-xs">hello from atx</code>.
      </p>
      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Target</th>
              <th>Slack webhook</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DeliveryChannelRow
                key={`${row._id}-${row.updatedAt}`}
                loading={loading}
                row={row}
                testing={testingId === row._id}
                onDelete={() => void deleteRow(row)}
                onSave={(draft) => void saveRow(row, draft)}
                onTest={() => void sendTest(row)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="status-text">No delivery channels yet.</p> : null}
    </article>
  );
}

function DeliveryChannelRow({
  row,
  loading,
  testing,
  onSave,
  onDelete,
  onTest
}: {
  row: ChannelRow;
  loading: boolean;
  testing: boolean;
  onSave: (draft: Partial<Pick<ChannelRow, "name" | "deliveryTarget" | "slackWebhookUrl">>) => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [deliveryTarget, setDeliveryTarget] = useState(row.deliveryTarget);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(row.slackWebhookUrl);

  const dirty =
    name.trim() !== row.name ||
    deliveryTarget !== row.deliveryTarget ||
    slackWebhookUrl.trim() !== (row.slackWebhookUrl ?? "").trim();

  return (
    <tr>
      <td>
        <input
          className="crud-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Channel name"
        />
      </td>
      <td>
        <select
          className="crud-input"
          value={deliveryTarget}
          onChange={(e) => setDeliveryTarget(e.target.value as "in_app" | "slack")}
          aria-label="Delivery target"
        >
          <option value="in_app">In-app</option>
          <option value="slack">Slack</option>
        </select>
      </td>
      <td>
        {deliveryTarget === "slack" ? (
          <input
            className="crud-input font-mono text-xs"
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/…"
            spellCheck={false}
            aria-label="Slack webhook URL"
          />
        ) : (
          <span className="status-text">—</span>
        )}
      </td>
      <td className="font-mono text-xs text-slate-400">{new Date(row.updatedAt).toLocaleString()}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <button
            className="cta cta-secondary"
            disabled={loading || !dirty}
            type="button"
            onClick={() =>
              onSave({
                name: name.trim(),
                deliveryTarget,
                slackWebhookUrl: deliveryTarget === "slack" ? slackWebhookUrl : ""
              })
            }
          >
            <SaveIcon className="crud-icon" /> Save
          </button>
          <button
            className="cta cta-secondary"
            disabled={loading || testing}
            type="button"
            onClick={onTest}
          >
            {testing ? "Sending…" : "Send test"}
          </button>
          <button className="cta cta-secondary" disabled={loading} type="button" onClick={onDelete}>
            <DeleteIcon className="crud-icon" /> Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
