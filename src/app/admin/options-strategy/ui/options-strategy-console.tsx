"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type SummaryRow = {
  id: string;
  slug: string;
  name: string;
  sourceRelPath: string;
  updatedAt: string;
};

export function OptionsStrategyConsole() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [status, setStatus] = useState("Loading…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await parseJson<{ data: SummaryRow[] }>(await fetch("/api/admin/options-strategy"));
        setRows(payload.data);
        setStatus(`${payload.data.length} strategies`);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setStatus("Error");
      }
    })();
  }, []);

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <div className="tool-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>Strategies</h3>
          <Link className="cta cta-primary" href="/admin/options-strategy/new">
            New strategy
          </Link>
        </div>
        <p className="status-text">{error ? <span className="status-error">{error}</span> : status}</p>
        {rows.length === 0 && !error ? (
          <p className="status-text">No rows yet — run seed sync to import from disk or click New to add one.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th scope="col">Slug</th>
                  <th scope="col">Name (file)</th>
                  <th scope="col">Source</th>
                  <th scope="col">Updated</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code className="text-xs">{r.slug}</code>
                    </td>
                    <td className="text-sm">{r.name}</td>
                    <td className="text-xs" style={{ color: "var(--xf-text-300)" }}>
                      {r.sourceRelPath || "—"}
                    </td>
                    <td className="text-xs" style={{ color: "var(--xf-text-300)" }}>
                      {new Date(r.updatedAt).toLocaleString()}
                    </td>
                    <td>
                      <Link className="tiny-button" href={`/admin/options-strategy/${r.id}/edit`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
