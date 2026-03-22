"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecommendationsCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [scopeTags, setScopeTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const tags = scopeTags
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        summary: summary.trim() ? summary : undefined,
        scopeTags: tags.length > 0 ? tags : undefined
      })
    });
    setPending(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(typeof j.error === "string" ? j.error : "Request failed");
      return;
    }
    setTitle("");
    setSummary("");
    setScopeTags("");
    router.refresh();
  }

  return (
    <form className="recommendations-form" onSubmit={onSubmit}>
      <h2 className="recommendations-form-title">New recommendation</h2>
      <label className="recommendations-label">
        Title
        <input
          className="recommendations-input"
          maxLength={500}
          onChange={(ev) => setTitle(ev.target.value)}
          required
          value={title}
        />
      </label>
      <label className="recommendations-label">
        Summary (optional)
        <textarea
          className="recommendations-textarea"
          maxLength={4000}
          onChange={(ev) => setSummary(ev.target.value)}
          rows={3}
          value={summary}
        />
      </label>
      <label className="recommendations-label">
        Scope tags (optional, comma-separated — for downstream agents)
        <input
          className="recommendations-input"
          onChange={(ev) => setScopeTags(ev.target.value)}
          placeholder="e.g. TSLA, wheel, earnings"
          value={scopeTags}
        />
      </label>
      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="cta recommendations-submit" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
