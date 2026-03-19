"use client";

import { useCallback, useRef, useState } from "react";

import { CopyIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type CollectionRow = {
  id: string;
  name?: string;
  stats: {
    documentCount: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

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
  const [status, setStatus] = useState("Ready — refresh to load xAI collections");
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
      const payload = await parseJson<{ data: CollectionRow[] }>(
        await fetch("/api/personas/collections")
      );
      setCollections(payload.data);
      setStatus(`Loaded ${payload.data.length} collection(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load collections");
      setCollections([]);
    }
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
        {collections.length === 0 ? (
          <p className="status-text">No rows yet — refresh above, or verify management API credentials.</p>
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
