"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

import "./options-strategy-editor.css";

const SLUG_RE = /^[a-z][a-z0-9-]{0,62}$/;

type Created = {
  id: string;
};

export function OptionsStrategyNewForm() {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filtersText, setFiltersText] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Fill out the form and click Create");

  const slugError = useMemo(() => {
    const s = slug.trim();
    if (!s) return "Required";
    if (!SLUG_RE.test(s)) return "Use lowercase letters, digits, and dashes; must start with a letter";
    return "";
  }, [slug]);

  const filtersError = useMemo(() => {
    try {
      const obj = JSON.parse(filtersText || "null");
      if (obj == null) return "";
      if (typeof obj !== "object") return "Filters must be a JSON object or null";
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [filtersText]);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (slugError || filtersError) return;
      setSaving(true);
      setStatus("Creating…");
      try {
        type CreateBody = {
          slug: string;
          name: string;
          description: string;
          filters?: Record<string, unknown> | null;
        };
        const body: CreateBody = {
          slug: slug.trim(),
          name: (name.trim() || slug.trim()),
          description
        };
        if (!filtersError) {
          const parsed: unknown = JSON.parse(filtersText || "null");
          body.filters = (parsed && typeof parsed === "object") ? (parsed as Record<string, unknown>) : null;
        }
        const payload = await parseJson<{ data: Created }>(
          await fetch("/api/admin/options-strategy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })
        );
        window.location.href = `/admin/options-strategy/${encodeURIComponent(payload.data.id)}/edit`;
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Create failed");
        setSaving(false);
      }
    },
    [slug, name, description, filtersText, slugError, filtersError]
  );

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>New strategy</h3>
        <p className="status-text">{status}</p>
        <form className="stack-form" onSubmit={(ev) => void onSubmit(ev)}>
          <label className="status-text" htmlFor="osn-slug">
            Slug (directory name under atx-docs/rag-collection/options-strategy)
          </label>
          <input
            id="osn-slug"
            required
            value={slug}
            onChange={(ev) => setSlug(ev.target.value)}
            autoComplete="off"
            placeholder="e.g. wheel"
          />
          {slugError ? (
            <p className="status-error" style={{ marginTop: 4 }}>{slugError}</p>
          ) : null}

          <label className="status-text" htmlFor="osn-name">
            Name (defaults to filename; you can override)
          </label>
          <input id="osn-name" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="off" />

          <label className="status-text" htmlFor="osn-desc">
            Description (markdown body)
          </label>
          <textarea
            id="osn-desc"
            className="osp-doc-textarea"
            spellCheck={false}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            aria-label="Strategy markdown document"
          />

          <label className="status-text" htmlFor="osn-filters" style={{ marginTop: "0.5rem" }}>
            Filters (free-form JSON)
          </label>
          <textarea
            id="osn-filters"
            className="osp-doc-textarea"
            style={{ minHeight: 140 }}
            spellCheck={false}
            value={filtersText}
            onChange={(ev) => setFiltersText(ev.target.value)}
            aria-label="Strategy filters JSON"
          />
          {filtersError ? (
            <p className="status-error" style={{ marginTop: 4 }}>JSON error: {filtersError}</p>
          ) : null}

          <div className="tool-row" style={{ marginTop: "0.5rem" }}>
            <button className="cta cta-primary" disabled={saving || !!slugError || !!filtersError} type="submit">
              {saving ? "Creating…" : "Create"}
            </button>
            <Link className="cta cta-secondary" href="/admin/options-strategy" style={{ marginLeft: 8 }}>
              Cancel
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
