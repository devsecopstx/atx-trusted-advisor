"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CopyIcon, DeleteIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

const RAG_COLLECTIONS_CACHE_KEY = "xfinance:admin:rag-collections:v2";
const RAG_COLLECTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

type CollectionStats = {
  documentCount: number | null;
  chunkCount: number | null;
  fileCount: number | null;
  indexStatus: string | null;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  usageStats: Record<string, unknown> | null;
};

type CollectionRow = {
  id: string;
  name?: string;
  stats: CollectionStats;
};

type CachedPayload = { ts: number; data: CollectionRow[] };

function defaultStats(): CollectionStats {
  return {
    documentCount: null,
    chunkCount: null,
    fileCount: null,
    indexStatus: null,
    lastSyncedAt: null,
    createdAt: null,
    updatedAt: null,
    usageStats: null
  };
}

function coerceCollectionRow(raw: unknown): CollectionRow | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string") {
    return null;
  }
  const st = row.stats && typeof row.stats === "object" && !Array.isArray(row.stats) ? row.stats : {};
  const s = st as Record<string, unknown>;
  const usageRaw = s.usageStats;
  const usageStats =
    usageRaw && typeof usageRaw === "object" && !Array.isArray(usageRaw)
      ? (usageRaw as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    ...(typeof row.name === "string" ? { name: row.name } : {}),
    stats: {
      documentCount: typeof s.documentCount === "number" ? s.documentCount : null,
      chunkCount: typeof s.chunkCount === "number" ? s.chunkCount : null,
      fileCount: typeof s.fileCount === "number" ? s.fileCount : null,
      indexStatus: typeof s.indexStatus === "string" ? s.indexStatus : null,
      lastSyncedAt: typeof s.lastSyncedAt === "string" ? s.lastSyncedAt : null,
      createdAt: typeof s.createdAt === "string" ? s.createdAt : null,
      updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : null,
      usageStats: usageStats && Object.keys(usageStats).length > 0 ? usageStats : null
    }
  };
}

function readCollectionsCache(): CachedPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(RAG_COLLECTIONS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedPayload;
    if (typeof parsed.ts !== "number" || !Array.isArray(parsed.data)) {
      return null;
    }
    const data = parsed.data.map(coerceCollectionRow).filter((r): r is CollectionRow => r !== null);
    if (data.length !== parsed.data.length) {
      return null;
    }
    return { ts: parsed.ts, data };
  } catch {
    return null;
  }
}

function writeCollectionsCache(data: CollectionRow[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(RAG_COLLECTIONS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* quota / private mode */
  }
}

async function fetchCollectionsFromApi(): Promise<CollectionRow[]> {
  const res = await fetch("/api/personas/collections", { credentials: "include" });
  const payload = await parseJson<{ data: CollectionRow[] }>(res);
  return payload.data.map((row) => {
    const c = coerceCollectionRow(row);
    return c ?? { id: row.id, name: row.name, stats: defaultStats() };
  });
}

function formatWhen(value: string | null): string {
  if (!value) {
    return "—";
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return value;
  }
  return new Date(ms).toLocaleString();
}

function formatUsageStats(stats: Record<string, unknown> | null): { short: string; full: string } {
  if (!stats || Object.keys(stats).length === 0) {
    return { short: "—", full: "" };
  }
  const entries = Object.entries(stats);
  const full = JSON.stringify(stats, null, 2);
  const short = entries
    .slice(0, 6)
    .map(([k, v]) => {
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        return `${k}: ${JSON.stringify(v)}`;
      }
      return `${k}: ${String(v)}`;
    })
    .join(" · ");
  return { short: entries.length > 6 ? `${short} · …` : short, full };
}

async function writeTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* continue to fallback */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) {
    throw new Error("copy_failed");
  }
}

export function RagFilesConsole() {
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [status, setStatus] = useState("Loading collections…");
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleCollections = useMemo(() => {
    const query = nameFilter.trim().toLowerCase();
    const filtered = query
      ? collections.filter((row) => (row.name?.trim() || "").toLowerCase().includes(query))
      : collections;
    const sorted = [...filtered].sort((a, b) => {
      const left = (a.name?.trim() || "").toLowerCase();
      const right = (b.name?.trim() || "").toLowerCase();
      const cmp = left.localeCompare(right, undefined, { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [collections, nameFilter, sortDirection]);

  const totals = useMemo(() => {
    let sumDocs = 0;
    let docRows = 0;
    let sumChunks = 0;
    let chunkRows = 0;
    let sumFiles = 0;
    let fileRows = 0;
    for (const row of visibleCollections) {
      const d = row.stats.documentCount;
      if (typeof d === "number") {
        sumDocs += d;
        docRows += 1;
      }
      const c = row.stats.chunkCount;
      if (typeof c === "number") {
        sumChunks += c;
        chunkRows += 1;
      }
      const f = row.stats.fileCount;
      if (typeof f === "number") {
        sumFiles += f;
        fileRows += 1;
      }
    }
    return {
      collections: visibleCollections.length,
      sumDocs,
      docRows,
      sumChunks,
      chunkRows,
      sumFiles,
      fileRows
    };
  }, [visibleCollections]);

  const allVisibleSelected =
    visibleCollections.length > 0 && visibleCollections.every((row) => selectedCollectionIds.includes(row.id));

  const copyCollectionId = useCallback(async (id: string) => {
    try {
      await writeTextToClipboard(id);
      setCopiedId(id);
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = setTimeout(() => {
        setCopiedId(null);
        copyResetRef.current = null;
      }, 2000);
    } catch {
      setStatus("Could not copy to clipboard — select the collection ID text manually.");
    }
  }, []);

  const refreshCollections = useCallback(async () => {
    setStatus("Loading collections…");
    try {
      const data = await fetchCollectionsFromApi();
      setCollections(data);
      setSelectedCollectionIds((previous) => previous.filter((id) => data.some((row) => row.id === id)));
      writeCollectionsCache(data);
      setStatus(`Loaded ${data.length} collection(s)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load collections";
      setStatus(`${msg} — list unchanged`);
    }
  }, []);

  const toggleRowSelected = useCallback((collectionId: string, selected: boolean) => {
    setSelectedCollectionIds((previous) => {
      if (selected) {
        if (previous.includes(collectionId)) {
          return previous;
        }
        return [...previous, collectionId];
      }
      return previous.filter((id) => id !== collectionId);
    });
  }, []);

  const toggleAllVisible = useCallback(
    (selected: boolean) => {
      setSelectedCollectionIds((previous) => {
        if (!selected) {
          return previous.filter((id) => !visibleCollections.some((row) => row.id === id));
        }
        const next = new Set(previous);
        for (const row of visibleCollections) {
          next.add(row.id);
        }
        return Array.from(next);
      });
    },
    [visibleCollections]
  );

  const deleteSelectedCollections = useCallback(async () => {
    const selectedRows = visibleCollections.filter((row) => selectedCollectionIds.includes(row.id));
    if (selectedRows.length === 0) {
      setStatus("Select at least one collection before deleting.");
      return;
    }
    const label =
      selectedRows.length === 1
        ? `${selectedRows[0]?.name || selectedRows[0]?.id}`
        : `${selectedRows.length} collections`;
    const confirmed = window.confirm(
      `Delete ${label}? This permanently removes the collection from xAI Management API scope for this key.`
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setStatus(`Deleting ${selectedRows.length} collection(s)…`);
    const failed: Array<{ id: string; error: string }> = [];

    for (const row of selectedRows) {
      try {
        const response = await fetch(`/api/personas/collections/${encodeURIComponent(row.id)}`, {
          method: "DELETE",
          credentials: "include"
        });
        if (!response.ok) {
          const payload = await parseJson<{ error?: string; code?: string }>(response);
          failed.push({
            id: row.id,
            error: payload.error || payload.code || `HTTP ${response.status}`
          });
          continue;
        }
        setCollections((previous) => previous.filter((candidate) => candidate.id !== row.id));
        setSelectedCollectionIds((previous) => previous.filter((id) => id !== row.id));
      } catch (error) {
        failed.push({
          id: row.id,
          error: error instanceof Error ? error.message : "Unknown delete error"
        });
      }
    }

    setDeleting(false);
    if (failed.length > 0) {
      setStatus(
        `Deleted ${selectedRows.length - failed.length}/${selectedRows.length} collection(s). Failed: ${failed
          .map((item) => `${item.id} (${item.error})`)
          .join(", ")}`
      );
      return;
    }
    setStatus(`Deleted ${selectedRows.length} collection(s).`);
  }, [selectedCollectionIds, visibleCollections]);

  useEffect(() => {
    let cancelled = false;
    const cached = readCollectionsCache();
    const ageMs = cached ? Date.now() - cached.ts : Infinity;
    const cacheFresh = cached && ageMs < RAG_COLLECTIONS_CACHE_TTL_MS;

    if (cached) {
      setCollections(cached.data);
      if (cacheFresh) {
        setStatus(`Showing ${cached.data.length} cached collection(s) — refreshing…`);
      } else {
        setStatus(`Showing ${cached.data.length} cached collection(s) (stale) — refreshing…`);
      }
    } else {
      setStatus("Loading collections…");
    }

    void (async () => {
      try {
        const data = await fetchCollectionsFromApi();
        if (cancelled) {
          return;
        }
        setCollections(data);
        writeCollectionsCache(data);
        setStatus(`Loaded ${data.length} collection(s)`);
      } catch (e) {
        if (cancelled) {
          return;
        }
        const msg = e instanceof Error ? e.message : "Failed to load collections";
        if (cached && cached.data.length > 0) {
          setStatus(`${msg} — showing cached data (${cached.data.length} collection(s))`);
        } else {
          setStatus(msg);
          setCollections([]);
        }
      } finally {
        if (!cancelled) {
          setInitialFetchDone(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel stack-gap">
      <p className="status-text" style={{ maxWidth: "72ch" }}>
        Collection inventory from the xAI Management API (
        <code style={{ fontSize: "0.85em" }}>GET /v1/collections</code>
        ), scoped to <code style={{ fontSize: "0.85em" }}>XAI_MANAGEMENT_API_KEY</code> in this
        deployment. This page allows <strong>delete</strong> only; use Personas flows or the xAI console for
        create/update.
      </p>
      <p className="status-text">
        <strong>Last sync</strong> uses the vendor&apos;s last-sync field when present; otherwise it falls back to{" "}
        <strong>updated</strong>. <strong>Usage / stats</strong> shows any <code>usage</code>,{" "}
        <code>stats</code>, or related object returned on the collection row.
      </p>
      <p className="status-text">
        <a
          className="xchat-header-link"
          href="https://docs.x.ai/docs/guides/using-collections/api"
          rel="noopener noreferrer"
          target="_blank"
        >
          xAI — Using collections via API
        </a>
        {" · "}
        <a
          className="xchat-header-link"
          href="https://docs.x.ai/developers/collections-api/collection"
          rel="noopener noreferrer"
          target="_blank"
        >
          Collections API reference
        </a>
      </p>

      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshCollections()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh collections
        </button>
        <button
          className="cta cta-danger"
          disabled={deleting || selectedCollectionIds.length === 0}
          onClick={() => void deleteSelectedCollections()}
          type="button"
        >
          <DeleteIcon className="crud-icon" />
          {deleting ? "Deleting…" : `Delete selected (${selectedCollectionIds.length})`}
        </button>
        <p className="status-text">{status}</p>
      </div>
      <div className="tool-row">
        <label className="status-text" htmlFor="rag-name-filter" style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <span>Filter by name</span>
          <input
            id="rag-name-filter"
            type="text"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Type collection name"
            style={{ minWidth: "18rem" }}
          />
        </label>
        <label className="status-text" htmlFor="rag-sort-direction" style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <span>Sort</span>
          <select
            id="rag-sort-direction"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value === "desc" ? "desc" : "asc")}
          >
            <option value="asc">Name A → Z</option>
            <option value="desc">Name Z → A</option>
          </select>
        </label>
      </div>

      {collections.length > 0 ? (
        <p className="status-text" style={{ maxWidth: "72ch" }}>
          Totals: <strong>{totals.collections}</strong> collection(s)
          {nameFilter.trim() ? (
            <>
              {" "}
              shown (of <strong>{collections.length}</strong> loaded)
            </>
          ) : null}
          {totals.docRows > 0 ? (
            <>
              {" "}
              · <strong>{totals.sumDocs}</strong> document(s) across <strong>{totals.docRows}</strong> row(s) with
              counts
            </>
          ) : null}
          {totals.chunkRows > 0 ? (
            <>
              {" "}
              · <strong>{totals.sumChunks}</strong> chunk(s) ({totals.chunkRows} row(s))
            </>
          ) : null}
          {totals.fileRows > 0 ? (
            <>
              {" "}
              · <strong>{totals.sumFiles}</strong> file(s) ({totals.fileRows} row(s))
            </>
          ) : null}
        </p>
      ) : null}

      <article className="surface-card xf-widget section-card">
        <h3>xAI collections</h3>
        {!initialFetchDone && collections.length === 0 ? (
          <p className="status-text">Loading collections…</p>
        ) : collections.length === 0 ? (
          <p className="status-text">No rows — verify management API credentials or create collections from Personas / xAI console.</p>
        ) : visibleCollections.length === 0 ? (
          <p className="status-text">
            No rows match <code>{nameFilter.trim()}</code>. Clear the filter to view all collections.
          </p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "3rem" }}>
                    <input
                      aria-label="Select all visible collections"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleAllVisible(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Collection ID</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Documents
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Chunks
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Files
                  </th>
                  <th scope="col">Index</th>
                  <th scope="col">Last sync</th>
                  <th scope="col">Created</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Usage / stats</th>
                </tr>
              </thead>
              <tbody>
                {visibleCollections.map((row) => {
                  const usage = formatUsageStats(row.stats.usageStats);
                  return (
                    <tr key={row.id}>
                      <td>
                        <input
                          aria-label={`Select collection ${row.name || row.id}`}
                          checked={selectedCollectionIds.includes(row.id)}
                          onChange={(event) => toggleRowSelected(row.id, event.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <strong>{row.name?.trim() || "—"}</strong>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.45rem",
                            flexWrap: "wrap"
                          }}
                        >
                          <code style={{ fontSize: "0.78rem", wordBreak: "break-all", flex: "1 1 10rem" }}>
                            {row.id}
                          </code>
                          <button
                            className="tiny-button"
                            type="button"
                            aria-label={
                              copiedId === row.id
                                ? "Collection ID copied to clipboard"
                                : `Copy collection ID ${row.id}`
                            }
                            onClick={() => void copyCollectionId(row.id)}
                          >
                            <CopyIcon className="crud-icon" />
                            {copiedId === row.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>{row.stats.documentCount ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{row.stats.chunkCount ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{row.stats.fileCount ?? "—"}</td>
                      <td style={{ maxWidth: "10rem", wordBreak: "break-word" }}>
                        {row.stats.indexStatus ?? "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatWhen(row.stats.lastSyncedAt)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatWhen(row.stats.createdAt)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatWhen(row.stats.updatedAt)}</td>
                      <td
                        style={{ maxWidth: "18rem", fontSize: "0.78rem", wordBreak: "break-word" }}
                        title={usage.full || undefined}
                      >
                        {usage.short}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
