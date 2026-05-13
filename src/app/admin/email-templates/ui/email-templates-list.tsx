"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import type { SerializedEmailTemplate } from "@/modules/email-templates/serialize";

const BASE = "/api/admin/email-templates";

export function AdminEmailTemplatesList() {
  const [rows, setRows] = useState<SerializedEmailTemplate[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const res = await parseJson<{ data: SerializedEmailTemplate[] }>(
        await fetch(`${BASE}?includeGlobal=true`, { cache: "no-store" })
      );
      setRows(res.data);
      setStatus(`Loaded ${res.data.length} template(s)`);
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

  return (
    <section className="admin-card">
      <header className="admin-card__head">
        <h2>Templates</h2>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshIcon className="admin-btn__icon" /> Refresh
        </button>
      </header>
      <p className="admin-status" aria-live="polite">{status}</p>
      <table className="admin-table" role="table">
        <thead>
          <tr>
            <th>Slug</th>
            <th>Scope</th>
            <th>Version</th>
            <th>Cadence</th>
            <th>Active</th>
            <th>Subject</th>
            <th>Updated</th>
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: "center", color: "#94a3b8" }}>
                No templates yet — run <code>npm run seed:email-templates</code>.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const scope = row.tenantId ? "tenant" : "global";
              const editScope = scope === "global" ? "global" : "tenant";
              return (
                <tr key={`${row.slug}:${row.tenantId ?? "null"}`}>
                  <td>
                    <code className="font-mono text-xs">{row.slug}</code>
                  </td>
                  <td>{scope}</td>
                  <td>{row.version}</td>
                  <td>{row.defaultCadence}</td>
                  <td>{row.active ? "yes" : "no"}</td>
                  <td className="truncate" style={{ maxWidth: 320 }}>
                    {row.subject}
                  </td>
                  <td>
                    <time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString()}</time>
                  </td>
                  <td>
                    <Link
                      href={`/admin/email-templates/${row.slug}?scope=${editScope}`}
                      className="admin-link"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
