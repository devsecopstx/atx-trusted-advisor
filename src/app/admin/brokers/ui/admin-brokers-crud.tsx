"use client";

import { useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { BrokerIcon } from "@/components/brokers/BrokerIcon";
import { brokerIconSlugFromCatalogType } from "@/lib/broker-ui";

type BrokerRow = {
  _id: string;
  type: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export function AdminBrokersCrud() {
  const [rows, setRows] = useState<BrokerRow[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [newType, setNewType] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading brokers…");
    try {
      const payload = await parseJson<{ data: BrokerRow[] }>(
        await fetch("/api/admin/brokers", { cache: "no-store" })
      );
      setRows(payload.data);
      setStatus(`Loaded ${payload.data.length} broker(s)`);
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

  async function createBroker() {
    const type = newType.trim().toLowerCase();
    const name = newName.trim();
    if (!type || !name) {
      setStatus("Enter type slug and display name");
      return;
    }
    setStatus("Creating…");
    try {
      await parseJson(
        await fetch("/api/admin/brokers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            name,
            ...(newDescription.trim() ? { description: newDescription.trim() } : {})
          })
        })
      );
      setNewType("");
      setNewName("");
      setNewDescription("");
      setStatus("Created");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function saveRow(row: BrokerRow, patch: { name: string; description: string }) {
    setStatus(`Saving ${row.type}…`);
    try {
      await parseJson(
        await fetch(`/api/admin/brokers/${encodeURIComponent(row._id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: patch.name.trim(),
            description: patch.description.trim() || null
          })
        })
      );
      setStatus("Saved");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function deleteRow(row: BrokerRow) {
    if (!window.confirm(`Delete broker “${row.name}” (${row.type})? Accounts may still reference this slug.`)) {
      return;
    }
    setStatus(`Deleting ${row.type}…`);
    try {
      await parseJson(
        await fetch(`/api/admin/brokers/${encodeURIComponent(row._id)}`, { method: "DELETE" })
      );
      setStatus("Deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
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

      <h3>Add broker</h3>
      <p className="status-text" style={{ marginBottom: "0.75rem" }}>
        <strong>Type</strong> is a lowercase slug (<code className="font-mono text-xs">a–z</code>, digits, underscore) used
        as custodian account <code className="font-mono text-xs">type</code>. Built-in slugs (
        <code className="font-mono text-xs">fidelity</code>, <code className="font-mono text-xs">merrill</code>,{" "}
        <code className="font-mono text-xs">ibkr</code>, <code className="font-mono text-xs">etrade</code>,{" "}
        <code className="font-mono text-xs">forge</code>, <code className="font-mono text-xs">hiive</code>) render SVG marks
        in this catalog and on portfolio accounts.
      </p>
      <div
        className="grid gap-3"
        style={{
          marginBottom: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))"
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>Type slug</span>
          <input
            className="crud-input font-mono text-xs"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="e.g. schwab"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Display name</span>
          <input
            className="crud-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Charles Schwab"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span>Description</span>
          <input
            className="crud-input"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Short note for admins"
          />
        </label>
      </div>
      <button className="cta cta-primary mb-6" disabled={loading} onClick={() => void createBroker()} type="button">
        <AddIcon className="crud-icon" /> Add broker
      </button>

      <h3>Catalog</h3>
      <p className="status-text" style={{ marginBottom: "0.5rem" }}>
        Edit any row, then click <strong>Save changes</strong> in that row.
      </p>
      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Type / mark</th>
              <th>Name</th>
              <th>Description</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BrokerCatalogRow
                key={`${row._id}-${row.updatedAt}`}
                row={row}
                onDelete={() => void deleteRow(row)}
                onSave={saveRow}
              />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function BrokerCatalogRow(props: {
  row: BrokerRow;
  onSave: (row: BrokerRow, patch: { name: string; description: string }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const { row } = props;
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description);

  const dirty = name !== row.name || description !== row.description;
  const builtInIcon = brokerIconSlugFromCatalogType(row.type);

  return (
    <tr>
      <td className="align-top">
        <div className="flex flex-col gap-1.5">
          <code className="font-mono text-xs text-[var(--xf-text-300)]">{row.type}</code>
          {builtInIcon ? (
            <BrokerIcon broker={builtInIcon} size={40} showTooltip tooltipVariant="rich" />
          ) : (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-xs font-mono uppercase text-[var(--xf-text-300)]"
              title={`No built-in mark for ${row.type}`}
            >
              {row.type.slice(0, 2)}
            </span>
          )}
        </div>
      </td>
      <td className="align-top">
        <input className="crud-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      </td>
      <td className="align-top" style={{ maxWidth: 280 }}>
        <textarea
          className="crud-input text-xs"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Description"
        />
      </td>
      <td className="text-xs opacity-80 align-top whitespace-nowrap">{new Date(row.updatedAt).toLocaleString()}</td>
      <td className="align-top whitespace-nowrap">
        <button
          className="cta cta-secondary text-xs"
          disabled={!dirty}
          onClick={() => void props.onSave(row, { name, description })}
          title="Save changes for this broker row"
          type="button"
        >
          <SaveIcon className="crud-icon" /> Save changes
        </button>
        <button
          className="cta cta-secondary text-xs ml-1"
          onClick={() => void props.onDelete()}
          type="button"
          aria-label={`Delete ${row.type}`}
        >
          <DeleteIcon className="crud-icon" />
        </button>
      </td>
    </tr>
  );
}
