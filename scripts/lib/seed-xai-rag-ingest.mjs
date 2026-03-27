/**
 * Admin seed helpers: upload repo RAG trees to xAI (files API + management link).
 * Used by scripts/seed-admin-user.mjs when XAI_API_KEY + XAI_MANAGEMENT_API_KEY + team id exist.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import {
    pickFirstNonEmpty,
    resolveTrustedAdvisorDeploySlug
} from "./tenant-defaults-seed.mjs";

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
export async function managementListCollectionsRaw(mgmtKey, mgmtBase, teamId) {
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

export function collectionIdFromEntry(c) {
  return String(c?.id ?? c?.collection_id ?? "").trim();
}

export function collectionNameFromEntry(c) {
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

/** @param {string} id */
function maskCollectionId(id) {
  const s = String(id);
  if (s.length <= 28) {
    return s;
  }
  return `${s.slice(0, 24)}…`;
}

/**
 * @param {string} repoRoot
 * @param {string[]} dirNames tried under rag collection roots
 * Tries new canonical: atx-docs/rag-collection, then legacy: atx-rag-collection
 */
function resolveRagSegmentDir(repoRoot, dirNames) {
  const bases = [join(repoRoot, "atx-docs", "rag-collection"), join(repoRoot, "atx-rag-collection")];
  for (const base of bases) {
    for (const name of dirNames) {
      const p = join(base, name);
      if (existsSync(p)) {
        return p;
      }
    }
  }
  return "";
}

function dedupeIds(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const t = String(id ?? "").trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * Creates instance-scoped xAI collections `atx-trusted-advisor-<dev|stage|prod>` plus segment buckets and uploads
 * `atx-rag-collection/{finance-reference-docs,xpersonas,example-prompts,options-strategy}` (legacy folder names still resolved as fallbacks).
 *
 * @param {{
 *   repoRoot: string;
 *   teamId?: string;
 *   xaiApiKey: string;
 *   xaiBaseUrl: string;
 *   mgmtKey: string;
 *   mgmtBase: string;
 *   maxFileBytes?: number;
 *   trustedAdvisorDeploySlug?: string;
 * }} opts
 */
export async function runSeedXaiRagIngest(opts) {
  const maxBytes = opts.maxFileBytes ?? 24 * 1024 * 1024;
  const teamId = (opts.teamId || "").trim();
  const warnings = [];

  const empty = () => ({
    ragUploaded: 0,
    ragFileCandidates: 0,
    strategyCollectionIds: [],
    strategyCollectionsDetail: [],
    strategyFilesUploaded: 0,
    tenantTrustedAdvisorRootDisplayName: "",
    tenantTrustedAdvisorRootCollectionId: "",
    warnings
  });

  if (!opts.xaiApiKey?.trim() || !opts.mgmtKey?.trim()) {
    warnings.push("missing XAI_API_KEY or XAI_MANAGEMENT_API_KEY — skip RAG ingest");
    return empty();
  }
  if (!teamId) {
    warnings.push("XAI_TEAM_ID unset — skip trusted-advisor tenant collections (team-scoped create)");
    return empty();
  }

  const deploy = pickFirstNonEmpty(opts.trustedAdvisorDeploySlug, resolveTrustedAdvisorDeploySlug({}, null));
  const tenantBase = `atx-trusted-advisor-${deploy}`;

  /** @type {{ collectionId: string; displayName: string; filesUploaded: number }[]} */
  const strategyCollectionsDetail = [];
  let ragUploaded = 0;
  let ragFileCandidates = 0;
  /** @type {string[]} */
  const segmentIds = [];
  let tenantRootId = "";

  const segments = [
    {
      suffix: "xchat-history",
      repoCandidates: /** @type {string[]} */ ([]),
      placeholder:
        `# xChat history (${tenantBase})\n\n` +
        `Reserved for per-user chat sync into xAI; populated by the app after sessions.\n` +
        `Suggested logical document path format: \`xchat-<user>-<date>\`.\n`
    },
    { suffix: "finance-reference-docs", repoCandidates: ["finance-reference-docs"] },
    {
      suffix: "xpersonas",
      repoCandidates: ["xpersonas", "personas-trusted-family", "atx-personas-trusted-family"]
    },
    {
      suffix: "example-prompts",
      repoCandidates: ["example-prompts", "xchat-example-prompts", "atx-xchat-example-prompts"]
    },
    { suffix: "options-strategy", repoCandidates: ["options-strategy", "atx-options-strategy"] }
  ];

  try {
    const root = await findOrCreateManagementCollection({
      displayName: tenantBase,
      teamId,
      mgmtKey: opts.mgmtKey,
      mgmtBase: opts.mgmtBase
    });
    tenantRootId = root.id;
    console.log(
      `[seed:xai-ingest] tenant collection verified: displayName=${root.name} id=${maskCollectionId(root.id)}`
    );

    const rootReadme = Buffer.from(
      `# ${tenantBase}\n\n` +
        `Instance-scoped xAI RAG for this app (deploy **${deploy}**).\n\n` +
        `Segments: ${segments.map((s) => `\`${tenantBase}/${s.suffix}\``).join(", ")}.\n`,
      "utf8"
    );
    await uploadBytesAndLinkToCollection({
      xaiApiKey: opts.xaiApiKey,
      xaiBaseUrl: opts.xaiBaseUrl,
      mgmtKey: opts.mgmtKey,
      mgmtBase: opts.mgmtBase,
      collectionId: root.id,
      logicalFilename: "atx_trusted_advisor__README.md",
      bytes: rootReadme
    });
    ragUploaded += 1;
    strategyCollectionsDetail.push({
      collectionId: root.id,
      displayName: root.name,
      filesUploaded: 1
    });

    for (const seg of segments) {
      const displayName = `${tenantBase}/${seg.suffix}`;
      const { id } = await findOrCreateManagementCollection({
        displayName,
        teamId,
        mgmtKey: opts.mgmtKey,
        mgmtBase: opts.mgmtBase
      });
      segmentIds.push(id);
      console.log(
        `[seed:xai-ingest] tenant subcollection verified: displayName=${displayName} id=${maskCollectionId(id)}`
      );

      let uploaded = 0;
      if ("placeholder" in seg && seg.placeholder) {
        const bytes = Buffer.from(seg.placeholder, "utf8");
        await uploadBytesAndLinkToCollection({
          xaiApiKey: opts.xaiApiKey,
          xaiBaseUrl: opts.xaiBaseUrl,
          mgmtKey: opts.mgmtKey,
          mgmtBase: opts.mgmtBase,
          collectionId: id,
          logicalFilename: "xchat_history__README.md",
          bytes
        });
        uploaded = 1;
        ragUploaded += 1;
      } else {
        const dir = resolveRagSegmentDir(opts.repoRoot, seg.repoCandidates);
        if (!dir) {
          warnings.push(
            `segment ${seg.suffix}: repo dir not found under atx-rag-collection/ (tried ${seg.repoCandidates.join(", ") || "—"})`
          );
        } else {
          const files = await walkIngestFiles(dir, { maxBytes });
          ragFileCandidates += files.length;
          const label = seg.suffix.replace(/-/g, "_");
          for (const f of files) {
            const logical = normalizeLogicalUploadName(label, f.rel);
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
              uploaded += 1;
              ragUploaded += 1;
              console.log(`[seed:xai-ingest] ${displayName}: ${logical}`);
            } catch (e) {
              warnings.push(`${displayName} ${f.rel}: ${e instanceof Error ? e.message : e}`);
              console.warn("[seed:xai-ingest]", displayName, f.rel, e);
            }
          }
        }
      }

      strategyCollectionsDetail.push({
        collectionId: id,
        displayName,
        filesUploaded: uploaded
      });
    }
  } catch (e) {
    warnings.push(`trusted-advisor tenant ingest: ${e instanceof Error ? e.message : e}`);
    console.warn("[seed:xai-ingest]", e);
    return {
      ...empty(),
      warnings
    };
  }

  const strategyCollectionIds = dedupeIds([tenantRootId, ...segmentIds]);
  const strategyFilesUploaded = strategyCollectionsDetail.reduce((n, s) => n + s.filesUploaded, 0);

  return {
    ragUploaded,
    ragFileCandidates,
    strategyCollectionIds,
    strategyCollectionsDetail,
    strategyFilesUploaded,
    tenantTrustedAdvisorRootDisplayName: tenantBase,
    tenantTrustedAdvisorRootCollectionId: tenantRootId,
    warnings
  };
}
