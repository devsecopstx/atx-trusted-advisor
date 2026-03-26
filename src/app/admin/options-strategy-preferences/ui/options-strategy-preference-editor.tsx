"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

import "./options-strategy-preference-editor.css";

type OptionsStrategyPreferenceEditorProps = {
  preferenceId: string;
};

type Loaded = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sourceRelPath: string;
  updatedAt: string;
};

export function OptionsStrategyPreferenceEditor({ preferenceId }: OptionsStrategyPreferenceEditorProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [saving, setSaving] = useState(false);
  const [docOpen, setDocOpen] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await parseJson<{ data: Loaded }>(
          await fetch(`/api/admin/options-strategy-preferences/${encodeURIComponent(preferenceId)}`)
        );
        setLoaded(payload.data);
        setName(payload.data.name);
        setDescription(payload.data.description);
        setStatus("Ready");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [preferenceId]);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSaving(true);
      setStatus("Saving…");
      try {
        const payload = await parseJson<{ data: Loaded }>(
          await fetch(`/api/admin/options-strategy-preferences/${encodeURIComponent(preferenceId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), description })
          })
        );
        setLoaded(payload.data);
        setName(payload.data.name);
        setDescription(payload.data.description);
        setStatus("Saved");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [preferenceId, name, description]
  );

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

          <div className="tool-row" style={{ marginTop: "0.5rem" }}>
            <button className="cta cta-primary" disabled={saving || !loaded} type="submit">
              {saving ? "Saving…" : "Save"}
            </button>
            <Link className="cta cta-secondary" href="/admin/options-strategy-preferences">
              Back to list
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
