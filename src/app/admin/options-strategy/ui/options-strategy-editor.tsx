"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

import "./options-strategy-editor.css";

type OptionsStrategyEditorProps = {
  strategyId: string;
};

type Loaded = {
  id: string;
  slug: string;
  name: string;
  description: string;
  filters: Record<string, unknown> | null;
  sourceRelPath: string;
  updatedAt: string;
};

export function OptionsStrategyEditor({ strategyId }: OptionsStrategyEditorProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filtersText, setFiltersText] = useState("{}");
  const [status, setStatus] = useState("Loading…");
  const [saving, setSaving] = useState(false);
  const [docOpen, setDocOpen] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await parseJson<{ data: Loaded }>(
          await fetch(`/api/admin/options-strategy/${encodeURIComponent(strategyId)}`)
        );
        setLoaded(payload.data);
        setName(payload.data.name);
        setDescription(payload.data.description);
        setFiltersText(
          payload.data.filters != null ? JSON.stringify(payload.data.filters, null, 2) : "{}"
        );
        setStatus("Ready");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [strategyId]);

  type ParsedFiltersOk = { [k: string]: unknown; __parseError?: never };
  type ParsedFiltersErr = { __parseError: string };
  type ParsedFilters = ParsedFiltersOk | ParsedFiltersErr | null;
  const parsedFilters: ParsedFilters = useMemo(() => {
    try {
      const obj: unknown = JSON.parse(filtersText || "null");
      if (obj == null) return null;
      if (typeof obj !== "object") return { __parseError: "Filters must be a JSON object or null" };
      return obj as ParsedFiltersOk;
    } catch (e) {
      return { __parseError: e instanceof Error ? e.message : String(e) };
    }
  }, [filtersText]);

  const filtersError: string | undefined = parsedFilters && "__parseError" in parsedFilters
    ? parsedFilters.__parseError
    : undefined;

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSaving(true);
      setStatus("Saving…");
      try {
        type PatchBody = { name: string; description: string; filters?: Record<string, unknown> | null };
        const body: PatchBody = { name: name.trim(), description };
        if (!filtersError) {
          body.filters = (parsedFilters && typeof parsedFilters === "object" && !("__parseError" in parsedFilters))
            ? (parsedFilters as Record<string, unknown>)
            : null;
        }
        const payload = await parseJson<{ data: Loaded }>(
          await fetch(`/api/admin/options-strategy/${encodeURIComponent(strategyId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })
        );
        setLoaded(payload.data);
        setName(payload.data.name);
        setDescription(payload.data.description);
        setFiltersText(
          payload.data.filters != null ? JSON.stringify(payload.data.filters, null, 2) : "{}"
        );
        setStatus("Saved");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [strategyId, name, description, parsedFilters, filtersError]
  );

  const onDelete = useCallback(async () => {
    if (!loaded) return;
    const ok = confirm(
      `Delete strategy ${loaded.slug}? This cannot be undone and will remove its filters as well.`
    );
    if (!ok) return;
    setSaving(true);
    setStatus("Deleting…");
    try {
      const res = await fetch(`/api/admin/options-strategy/${encodeURIComponent(strategyId)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(payload.error || "Delete failed");
      }
      window.location.href = "/admin/options-strategy";
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
      setSaving(false);
    }
  }, [loaded, strategyId]);

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>{loaded ? loaded.slug : "…"}</h3>
        {loaded ? (
          <p className="status-text" style={{ fontSize: "0.8rem" }}>
            <span style={{ color: "var(--xf-text-300)" }}>Source file:</span>{" "}
            <code className="text-xs">{loaded.sourceRelPath || "—"}</code>
            <span style={{ color: "var(--xf-text-300)", marginLeft: "0.75rem" }}>Updated:</span>{" "}
            {new Date(loaded.updatedAt).toLocaleString()}
          </p>
        ) : null}
        <p className="status-text">{status}</p>

        <form className="stack-form" onSubmit={(ev) => void onSubmit(ev)}>
          <label className="status-text" htmlFor="osp-name">
            Name (from filename by default)
          </label>
          <input
            id="osp-name"
            required
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            autoComplete="off"
          />

          <details
            className="osp-doc-details"
            open={docOpen}
            onToggle={(ev) => setDocOpen((ev.target as HTMLDetailsElement).open)}
          >
            <summary className="osp-doc-summary">Strategy document (markdown)</summary>
            <p className="status-text" style={{ margin: "0.35rem 0 0.5rem", fontSize: "0.78rem" }}>
              Full file body — scroll inside the box. Collapse this section when you only need to change the name.
            </p>
            <textarea
              className="osp-doc-textarea"
              spellCheck={false}
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              aria-label="Strategy markdown document"
            />
          </details>

          <label className="status-text" htmlFor="osp-filters" style={{ marginTop: "0.5rem" }}>
            Filters (free-form JSON)
          </label>
          <textarea
            id="osp-filters"
            className="osp-doc-textarea"
            style={{ minHeight: 140 }}
            spellCheck={false}
            value={filtersText}
            onChange={(ev) => setFiltersText(ev.target.value)}
            aria-label="Strategy filters JSON"
          />
          {filtersError ? (
            <p className="status-error" style={{ marginTop: 4 }}>
              JSON error: {filtersError}
            </p>
          ) : null}

          <div className="tool-row" style={{ marginTop: "0.5rem", justifyContent: "space-between" }}>
            <div>
              <button className="cta cta-primary" disabled={saving || !loaded || !!filtersError} type="submit">
                <SaveIcon className="crud-icon" /> {saving ? "Saving…" : "Save"}
              </button>
              <Link className="cta cta-secondary" href="/admin/options-strategy" style={{ marginLeft: 8 }}>
                Back to list
              </Link>
            </div>
            <button
              type="button"
              className="cta cta-danger"
              disabled={saving || !loaded}
              onClick={() => void onDelete()}
              title="Delete this strategy"
            >
              Delete
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
