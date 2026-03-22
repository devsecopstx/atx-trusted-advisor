"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CopyIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

const RAG_COLLECTIONS_CACHE_KEY = "xfinance:admin:rag-collections:v1";
const RAG_COLLECTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

type CollectionRow = {
  id: string;
  name?: string;
  stats: {
    documentCount: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

type CachedPayload = { ts: number; data: CollectionRow[] };

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
    if (
      typeof parsed.ts !== "number" ||
      !Array.isArray(parsed.data) ||
      parsed.data.some((r) => !r || typeof r.id !== "string")
    ) {
      return null;
    }
    return parsed;
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
  return payload.data;
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
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      writeCollectionsCache(data);
      setStatus(`Loaded ${data.length} collection(s)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load collections";
      setStatus(`${msg} — list unchanged`);
    }
  }, []);

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
        Read-only inventory from the xAI Management API (
        <code style={{ fontSize: "0.85em" }}>GET /v1/collections</code>
        ), scoped to <code style={{ fontSize: "0.85em" }}>XAI_MANAGEMENT_API_KEY</code> in this
        deployment. Create or mutate collections from{" "}
        <strong>Personas</strong> flows or the xAI console — not from this page.
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
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>xAI collections</h3>
        {!initialFetchDone && collections.length === 0 ? (
          <p className="status-text">Loading collections…</p>
        ) : collections.length === 0 ? (
          <p className="status-text">No rows — verify management API credentials or create collections from Personas / xAI console.</p>
        ) : (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Collection ID</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Documents
                  </th>
                  <th scope="col">Created</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((row) => (
                  <tr key={row.id}>
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
                    <td style={{ whiteSpace: "nowrap" }}>{formatWhen(row.stats.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatWhen(row.stats.updatedAt)}</td>
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
