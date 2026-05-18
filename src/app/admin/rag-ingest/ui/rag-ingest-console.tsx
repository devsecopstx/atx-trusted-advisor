"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type SummaryRow = {
  slug: string;
  title: string;
  riskLevel: string;
  outlook: string;
  tags: string[];
  segment: string;
  ingestedAt: string;
  chunkCount: number;
  firstChunkPreview: string;
  mongoSeededAt: string | null;
  xaiSyncedAt: string | null;
};

type DetailRow = SummaryRow & {
  manifest: {
    chunkFiles: string[];
  };
  chunkFiles: Array<{ name: string; bytes: number }>;
};

export function RagIngestConsole() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [uploadSlug, setUploadSlug] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadRisk, setUploadRisk] = useState("Balanced");
  const [uploadOutlook, setUploadOutlook] = useState("Neutral");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editRisk, setEditRisk] = useState("balanced");
  const [editOutlook, setEditOutlook] = useState("");
  const [editTags, setEditTags] = useState("");

  const loadList = useCallback(async () => {
    const payload = await parseJson<{ data: SummaryRow[] }>(
      await fetch("/api/admin/rag-ingest", { credentials: "include" })
    );
    setRows(payload.data);
    setStatus(`${payload.data.length} ingested folder(s)`);
    setError(null);
    return payload.data;
  }, []);

  const loadDetail = useCallback(async (slug: string) => {
    const payload = await parseJson<{ data: DetailRow }>(
      await fetch(`/api/admin/rag-ingest/${encodeURIComponent(slug)}`, { credentials: "include" })
    );
    setDetail(payload.data);
    setEditTitle(payload.data.title);
    setEditRisk(payload.data.riskLevel);
    setEditOutlook(payload.data.outlook);
    setEditTags(payload.data.tags.join(", "));
    return payload.data;
  }, []);

  useEffect(() => {
    void loadList().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load");
      setStatus("Error");
    });
  }, [loadList]);

  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedSlug).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    });
  }, [selectedSlug, loadDetail]);

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadSlug.trim() || !uploadTitle.trim()) {
      setError("PDF file, slug, and title are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", uploadFile);
      form.set("slug", uploadSlug.trim().toLowerCase());
      form.set("title", uploadTitle.trim());
      form.set("risk", uploadRisk);
      form.set("outlook", uploadOutlook);
      form.set("tags", uploadTags);
      const res = await fetch("/api/admin/rag-ingest/ingest", {
        method: "POST",
        credentials: "include",
        body: form
      });
      await parseJson(res);
      await loadList();
      setSelectedSlug(uploadSlug.trim().toLowerCase());
      setUploadFile(null);
      setStatus("Ingest complete — review markdown below");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveMetadata() {
    if (!selectedSlug) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/rag-ingest/${encodeURIComponent(selectedSlug)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          riskLevel: editRisk,
          outlook: editOutlook,
          tags
        })
      });
      await parseJson(res);
      await loadList();
      await loadDetail(selectedSlug);
      setStatus("Metadata saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedSlug(target: "mongo" | "xai" | "both") {
    if (!selectedSlug) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rag-ingest/${encodeURIComponent(selectedSlug)}/seed`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mongo: target === "mongo" || target === "both",
          xai: target === "xai" || target === "both"
        })
      });
      await parseJson(res);
      await loadList();
      await loadDetail(selectedSlug);
      setStatus(target === "both" ? "Mongo + xAI seed complete" : `${target} seed complete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadHref(slug: string, filename: string): string {
    return `/api/admin/rag-ingest/${encodeURIComponent(slug)}/download/${encodeURIComponent(filename)}`;
  }

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>Ingest PDF</h3>
        <p className="status-text text-sm" style={{ color: "var(--xf-text-300)" }}>
          Writes markdown + <code className="text-xs">ingest.manifest.json</code> under{" "}
          <code className="text-xs">atx-docs/rag-collection/&lt;slug&gt;/</code>. Requires Python{" "}
          <code className="text-xs">pymupdf4llm</code> (see services/pdf-ingest/requirements.txt).
        </p>
        <form className="stack-gap" onSubmit={(e) => void handleIngest(e)}>
          <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <label className="stack-gap text-sm">
              PDF file
              <input
                type="file"
                accept="application/pdf"
                onChange={(ev) => setUploadFile(ev.target.files?.[0] ?? null)}
              />
            </label>
            <label className="stack-gap text-sm">
              Slug
              <input
                className="input"
                value={uploadSlug}
                onChange={(e) => setUploadSlug(e.target.value)}
                placeholder="advanced-iron-condor-2026"
              />
            </label>
            <label className="stack-gap text-sm">
              Title
              <input
                className="input"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Advanced iron condor 2026"
              />
            </label>
            <label className="stack-gap text-sm">
              Risk
              <select className="input" value={uploadRisk} onChange={(e) => setUploadRisk(e.target.value)}>
                <option value="Conservative">Conservative</option>
                <option value="Balanced">Balanced</option>
                <option value="Aggressive">Aggressive</option>
              </select>
            </label>
            <label className="stack-gap text-sm">
              Outlook
              <input
                className="input"
                value={uploadOutlook}
                onChange={(e) => setUploadOutlook(e.target.value)}
                placeholder="Bullish Vol"
              />
            </label>
            <label className="stack-gap text-sm" style={{ minWidth: "12rem", flex: 1 }}>
              Tags (comma-separated)
              <input
                className="input"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="iron-condor, adjustment"
              />
            </label>
          </div>
          <button type="submit" className="cta cta-primary" disabled={busy}>
            {busy ? "Ingesting…" : "Ingest & review"}
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Ingested folders</h3>
        <p className="status-text">{error ? <span className="status-error">{error}</span> : status}</p>
        {rows.length === 0 && !error ? (
          <p className="status-text">No PDF ingest folders yet — upload above or run the CLI.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th scope="col">Slug</th>
                  <th scope="col">Title</th>
                  <th scope="col">Risk / outlook</th>
                  <th scope="col">Chunks</th>
                  <th scope="col">Mongo / xAI</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.slug} className={selectedSlug === r.slug ? "row-selected" : undefined}>
                    <td>
                      <code className="text-xs">{r.slug}</code>
                      <span className="ml-2 rounded bg-[var(--xf-surface-700)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--xf-gain-green)]">
                        ingest
                      </span>
                    </td>
                    <td className="text-sm">{r.title}</td>
                    <td className="text-xs" style={{ color: "var(--xf-text-300)" }}>
                      {r.riskLevel} · {r.outlook}
                    </td>
                    <td className="text-xs">{r.chunkCount}</td>
                    <td className="text-xs" style={{ color: "var(--xf-text-300)" }}>
                      {r.mongoSeededAt ? "Mongo ✓" : "Mongo —"} · {r.xaiSyncedAt ? "xAI ✓" : "xAI —"}
                    </td>
                    <td>
                      <button type="button" className="tiny-button" onClick={() => setSelectedSlug(r.slug)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {detail && selectedSlug ? (
        <article className="surface-card xf-widget section-card stack-gap">
          <h3>Review — {detail.slug}</h3>
          <p className="text-sm" style={{ color: "var(--xf-text-300)" }}>
            First chunk preview
          </p>
          <pre
            className="overflow-auto rounded border border-[var(--xf-border-600)] bg-[var(--xf-surface-800)] p-3 text-xs"
            style={{ maxHeight: "14rem", whiteSpace: "pre-wrap" }}
          >
            {detail.firstChunkPreview || "(empty)"}
          </pre>

          <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <label className="stack-gap text-sm">
              Title
              <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </label>
            <label className="stack-gap text-sm">
              Risk
              <select className="input" value={editRisk} onChange={(e) => setEditRisk(e.target.value)}>
                <option value="conservative">conservative</option>
                <option value="balanced">balanced</option>
                <option value="aggressive">aggressive</option>
              </select>
            </label>
            <label className="stack-gap text-sm">
              Outlook
              <input className="input" value={editOutlook} onChange={(e) => setEditOutlook(e.target.value)} />
            </label>
            <label className="stack-gap text-sm" style={{ flex: 1, minWidth: "12rem" }}>
              Tags
              <input className="input" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
            </label>
          </div>
          <div className="tool-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="cta cta-secondary" disabled={busy} onClick={() => void saveMetadata()}>
              Save metadata
            </button>
            <button type="button" className="cta cta-secondary" disabled={busy} onClick={() => void seedSlug("mongo")}>
              Seed Mongo
            </button>
            <button type="button" className="cta cta-secondary" disabled={busy} onClick={() => void seedSlug("xai")}>
              Sync xAI
            </button>
            <button type="button" className="cta cta-primary" disabled={busy} onClick={() => void seedSlug("both")}>
              Seed Mongo + xAI
            </button>
          </div>

          <h4 className="text-sm font-medium">Downloads</h4>
          <ul className="list-disc pl-5 text-sm">
            {detail.chunkFiles.map((f) => (
              <li key={f.name}>
                <a
                  className="text-xf-nav-green hover:underline"
                  href={downloadHref(selectedSlug, f.name)}
                  download
                >
                  {f.name}
                </a>
                <span className="text-xs text-[var(--xf-text-300)]"> ({f.bytes} bytes)</span>
              </li>
            ))}
            <li>
              <a
                className="text-xf-nav-green hover:underline"
                href={downloadHref(selectedSlug, "source.pdf")}
                download
              >
                source.pdf
              </a>
            </li>
          </ul>
        </article>
      ) : null}
    </section>
  );
}
