/**
 * Admin seed helpers: upload repo RAG trees to xAI (files API + management link).
 * Used by scripts/seed-admin-user.mjs when XAI_API_KEY + XAI_MANAGEMENT_API_KEY + team KB collection exist.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

/** Stable upload filename: no path separators in the stored name (xAI / OS safe). */
export function normalizeLogicalUploadName(rootLabel, relativePosixPath) {
  const raw = String(relativePosixPath).replace(/\\/g, "/").replace(/^\/+/, "");
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  const prefix = String(rootLabel).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}__${safe}`;
}

const INGEST_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".yaml",
  ".yml",
  ".pdf",
  ".txt",
  ".json"
]);

const SKIP_FILE_NAMES = new Set(["readme.md", ".ds_store"]);

async function readJsonBody(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** @param {string} mgmtBase */
async function managementListCollectionsRaw(mgmtKey, mgmtBase, teamId) {
  const base = mgmtBase.replace(/\/$/, "");
  let url = `${base}/collections`;
  if (teamId) {
    url = `${base}/collections?team_id=${encodeURIComponent(teamId)}`;
  }
  let res = await fetch(url, { headers: { Authorization: `Bearer ${mgmtKey}` } });
  if (!res.ok && teamId) {
    url = `${base}/collections`;
    res = await fetch(url, { headers: { Authorization: `Bearer ${mgmtKey}` } });
  }
  const payload = await readJsonBody(res);
  if (!res.ok) {
    throw new Error(`xAI collections list failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  const candidates = [payload.data, payload.results, payload.collections, payload.items].find(Array.isArray);
  return Array.isArray(candidates) ? candidates : [];
}

function collectionIdFromEntry(c) {
  return String(c?.id ?? c?.collection_id ?? "").trim();
}

function collectionNameFromEntry(c) {
  return String(c?.name ?? c?.collection_name ?? "").trim();
}

/**
 * @returns {{ id: string, name: string }}
 */
export async function findOrCreateManagementCollection({ displayName, teamId, mgmtKey, mgmtBase }) {
  const name = String(displayName).trim();
  if (!name) {
    throw new Error("collection display name required");
  }
  const base = mgmtBase.replace(/\/$/, "");
  const list = await managementListCollectionsRaw(mgmtKey, base, teamId || "");
  for (const c of list) {
    const n = collectionNameFromEntry(c);
    if (n && n.toLowerCase() === name.toLowerCase()) {
      const id = collectionIdFromEntry(c);
      if (id) {
        return { id, name: n };
      }
    }
  }

  const tryBodies = [];
  if (teamId) {
    tryBodies.push(JSON.stringify({ collection_name: name, team_id: teamId }));
  }
  tryBodies.push(JSON.stringify({ collection_name: name }));

  let lastErr = "";
  for (const body of tryBodies) {
    const res = await fetch(`${base}/collections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mgmtKey}`,
        "Content-Type": "application/json"
      },
      body
    });
    const payload = await readJsonBody(res);
    if (res.ok) {
      const id =
        (typeof payload.id === "string" && payload.id) ||
        (typeof payload.collection_id === "string" && payload.collection_id) ||
        "";
      if (!id) {
        throw new Error("xAI collection create returned no id");
      }
      const resolvedName =
        (typeof payload.name === "string" && payload.name) ||
        (typeof payload.collection_name === "string" && payload.collection_name) ||
        name;
      return { id, name: resolvedName };
    }
    lastErr = JSON.stringify(payload.error ?? payload);
  }
  throw new Error(`xAI collection create failed: ${lastErr}`);
}

/**
 * Upload bytes via XAI_API_KEY, link via management.
 * @returns {{ fileId: string, linked: boolean }}
 */
export async function uploadBytesAndLinkToCollection({
  xaiApiKey,
  xaiBaseUrl,
  mgmtKey,
  mgmtBase,
  collectionId,
  logicalFilename,
  bytes
}) {
  const base = xaiBaseUrl.replace(/\/$/, "");
  const form = new FormData();
  form.set(
    "file",
    new Blob([Uint8Array.from(bytes)], { type: "application/octet-stream" }),
    logicalFilename
  );
  const up = await fetch(`${base}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${xaiApiKey}` },
    body: form
  });
  const upPayload = await readJsonBody(up);
  const fileId =
    (typeof upPayload.id === "string" && upPayload.id) ||
    (typeof upPayload.file_id === "string" && upPayload.file_id) ||
    "";
  if (!up.ok || !fileId) {
    throw new Error(`xAI file upload failed: ${JSON.stringify(upPayload.error ?? upPayload)}`);
  }

  const mbase = mgmtBase.replace(/\/$/, "");
  const link = await fetch(`${mbase}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtKey}` }
  });
  if (link.ok) {
    return { fileId, linked: true };
  }
  if (link.status === 409) {
    return { fileId, linked: true };
  }
  const linkPayload = await readJsonBody(link);
  throw new Error(`xAI link file to collection failed: ${JSON.stringify(linkPayload.error ?? linkPayload)}`);
}

async function walkIngestFiles(rootDir, { maxBytes }) {
  /** @type {{ abs: string, rel: string }[]} */
  const out = [];
  async function walk(absDir, rel = "") {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".")) {
        continue;
      }
      const abs = join(absDir, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(abs, r);
      } else if (ent.isFile()) {
        const low = ent.name.toLowerCase();
        if (SKIP_FILE_NAMES.has(low)) {
          continue;
        }
        const ext = low.slice(low.lastIndexOf("."));
        if (!INGEST_EXTENSIONS.has(ext)) {
          continue;
        }
        const st = await stat(abs);
        if (st.size > maxBytes) {
          console.warn(`[seed:xai-ingest] skip (too large ${st.size}B): ${r}`);
          continue;
        }
        out.push({ abs, rel: r.replace(/\\/g, "/") });
      }
    }
  }
  await walk(rootDir);
  return out;
}

/**
 * @param {{
 *   repoRoot: string;
 *   teamId?: string;
 *   teamKbCollectionId?: string;
 *   xaiApiKey: string;
 *   xaiBaseUrl: string;
 *   mgmtKey: string;
 *   mgmtBase: string;
 *   maxFileBytes?: number;
 *   skipAtxRag?: boolean;
 *   skipStrategyTemplates?: boolean;
 *   instanceRootPrefix?: string; when set, strategy collections are `${instanceRootPrefix}-xoption--<slug>` (and `--core`).
 * }} opts
 */
export async function runSeedXaiRagIngest(opts) {
  const maxBytes = opts.maxFileBytes ?? 24 * 1024 * 1024;
  const teamId = (opts.teamId || "").trim();
  const kbId = (opts.teamKbCollectionId || "").trim();
  const strategyPrefix = (opts.instanceRootPrefix || "").trim();
  const warnings = [];

  /** @type {string[]} */
  const strategyCollectionIds = [];
  let ragUploaded = 0;

  if (!opts.xaiApiKey?.trim() || !opts.mgmtKey?.trim()) {
    warnings.push("missing XAI_API_KEY or XAI_MANAGEMENT_API_KEY — skip RAG ingest");
    return { ragUploaded: 0, strategyCollectionIds, warnings };
  }

  if (!opts.skipAtxRag && kbId) {
    const ragRoot = join(opts.repoRoot, "atx-rag-collection");
    try {
      const files = await walkIngestFiles(ragRoot, { maxBytes: maxBytes });
      for (const f of files) {
        const logical = normalizeLogicalUploadName("atx-rag", f.rel);
        const bytes = await readFile(f.abs);
        try {
          await uploadBytesAndLinkToCollection({
            xaiApiKey: opts.xaiApiKey,
            xaiBaseUrl: opts.xaiBaseUrl,
            mgmtKey: opts.mgmtKey,
            mgmtBase: opts.mgmtBase,
            collectionId: kbId,
            logicalFilename: logical,
            bytes
          });
          ragUploaded += 1;
          console.log(`[seed:xai-ingest] atx-rag → KB: ${logical}`);
        } catch (e) {
          warnings.push(`atx-rag ${f.rel}: ${e instanceof Error ? e.message : e}`);
          console.warn("[seed:xai-ingest]", f.rel, e);
        }
      }
    } catch (e) {
      warnings.push(`atx-rag-collection walk: ${e instanceof Error ? e.message : e}`);
    }
  } else if (!opts.skipAtxRag && !kbId) {
    warnings.push("no team KB collection id — skip atx-rag-collection upload (set XAI_TEAM_ID + keys)");
  }

  if (!opts.skipStrategyTemplates && teamId) {
    const stratRoot = join(opts.repoRoot, "atx-docs/atx-options/atx-strategy-templates");
    /** @type {string[]} */
    const rootFiles = [];
    try {
      const entries = await readdir(stratRoot, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.name.startsWith(".")) {
          continue;
        }
        const abs = join(stratRoot, ent.name);
        if (ent.isDirectory()) {
          const displayName = `atx-xoption-templates--${slugFolderName(ent.name)}`;
          try {
            const { id } = await findOrCreateManagementCollection({
              displayName,
              teamId,
              mgmtKey: opts.mgmtKey,
              mgmtBase: opts.mgmtBase
            });
            strategyCollectionIds.push(id);
            const subFiles = await walkIngestFiles(abs, { maxBytes: maxBytes });
            for (const f of subFiles) {
              const rel = `${ent.name}/${f.rel}`;
              const logical = normalizeLogicalUploadName("atx-xoption", rel);
              const bytes = await readFile(f.abs);
              try {
                await uploadBytesAndLinkToCollection({
                  xaiApiKey: opts.xaiApiKey,
                  xaiBaseUrl: opts.xaiBaseUrl,
                  mgmtKey: opts.mgmtKey,
                  mgmtBase: opts.mgmtBase,
                  collectionId: id,
                  logicalFilename: logical,
                  bytes
                });
                console.log(`[seed:xai-ingest] ${displayName}: ${logical}`);
              } catch (e) {
                warnings.push(`strategy ${rel}: ${e instanceof Error ? e.message : e}`);
              }
            }
          } catch (e) {
            warnings.push(`collection ${displayName}: ${e instanceof Error ? e.message : e}`);
          }
        } else if (ent.isFile()) {
          const low = ent.name.toLowerCase();
          if (!SKIP_FILE_NAMES.has(low)) {
            const ext = low.slice(low.lastIndexOf("."));
            if (INGEST_EXTENSIONS.has(ext)) {
              rootFiles.push(abs);
            }
          }
        }
      }

      if (rootFiles.length > 0) {
        const displayName = strategyPrefix ? `${strategyPrefix}-xoption--core` : "atx-xoption-templates--core";
        try {
          const { id } = await findOrCreateManagementCollection({
            displayName,
            teamId,
            mgmtKey: opts.mgmtKey,
            mgmtBase: opts.mgmtBase
          });
          if (!strategyCollectionIds.includes(id)) {
            strategyCollectionIds.push(id);
          }
          for (const abs of rootFiles) {
            const st = await stat(abs);
            if (st.size > maxBytes) {
              continue;
            }
            const logical = normalizeLogicalUploadName("atx-xoption", basename(abs));
            const bytes = await readFile(abs);
            try {
              await uploadBytesAndLinkToCollection({
                xaiApiKey: opts.xaiApiKey,
                xaiBaseUrl: opts.xaiBaseUrl,
                mgmtKey: opts.mgmtKey,
                mgmtBase: opts.mgmtBase,
                collectionId: id,
                logicalFilename: logical,
                bytes
              });
              console.log(`[seed:xai-ingest] ${displayName}: ${logical}`);
            } catch (e) {
              warnings.push(`strategy root ${basename(abs)}: ${e instanceof Error ? e.message : e}`);
            }
          }
        } catch (e) {
          warnings.push(`collection ${displayName}: ${e instanceof Error ? e.message : e}`);
        }
      }
    } catch (e) {
      warnings.push(`strategy templates walk: ${e instanceof Error ? e.message : e}`);
    }
  } else if (!opts.skipStrategyTemplates && !teamId) {
    warnings.push("XAI_TEAM_ID unset — skip atx-xoption-templates collections (team-scoped create)");
  }

  return { ragUploaded, strategyCollectionIds, warnings };
}

function slugFolderName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
