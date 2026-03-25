/**
 * Upsert xChat personas from repo disk specs (recursive):
 * - `.yaml` / `.yml`: full xPersona YAML (system_prompt, model, …)
 * - `.md`: YAML frontmatter + markdown body → system prompt (e.g. `atx-rag-collection/options-strategy/**`)
 *
 * Default root: `atx-rag-collection/xpersonas`. Override with argv or `--root <path>` (repo-relative or absolute).
 *
 * Modes:
 * - **Mongo** (default): direct `xchat_personas` upsert (same as historical `seed:xpersonas`).
 * - **HTTP** (`--api`): `GET/POST/PUT /api/personas` with admin session cookie — mirrors admin CRUD.
 *
 * Env:
 * - `SKIP_SEED_XPERSONAS`, `SEED_XPERSONAS_MODE`, `SEED_XPERSONAS_STRICT` — Mongo path
 * - `XAI_CHAT_MODEL` — default model when YAML/MD omits `model`
 * - `--api`: `SYNC_PERSONAS_BASE_URL` (default `http://127.0.0.1:3000`), `XF_CORE_SESSION` or `SYNC_PERSONAS_SESSION` (signed `xf_core_session` value)
 */
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";

import {
    buildPersonaInsertSetBody,
    computePersonaSeedUpdatePatch
} from "@/modules/xchat/persona-seed-merge";
import {
    buildYamlDerived,
    injectDefaultModel,
    resolveDefaultPersonaModelFromEnv,
    validateParsedPersonaDoc
} from "@/modules/xchat/persona-yaml-derived";

import { resolveAdminSeedDbName, resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";
import {
    collectionIdFromEntry,
    collectionNameFromEntry,
    managementListCollectionsRaw
} from "./lib/seed-xai-rag-ingest.mjs";
import { loadSeedTenantContext } from "./lib/tenant-defaults-seed.mjs";
import { collectPersonaSpecFiles, loadPersonaDocFromFile } from "./lib/xpersonas-disk";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

const XAI_KB_COLLECTION_RE = /^collection_[A-Za-z0-9_-]+$/;

type CliOpts = {
  rootInput: string;
  useApi: boolean;
};

function parseCliArgs(argv: string[]): CliOpts {
  let rootInput = "atx-rag-collection/xpersonas";
  let useApi = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--api") {
      useApi = true;
      continue;
    }
    if (a === "--root" && argv[i + 1]) {
      rootInput = argv[++i];
      continue;
    }
    if (a.startsWith("-")) {
      console.warn(`[seed:xpersonas] unknown flag ${a} — ignoring`);
      continue;
    }
    rootInput = a;
  }
  return { rootInput, useApi };
}

function resolveRootAbs(rootInput: string): string {
  const trimmed = rootInput.trim();
  if (!trimmed) {
    return join(REPO_ROOT, "atx-rag-collection", "xpersonas");
  }
  return isAbsolute(trimmed) ? trimmed : join(REPO_ROOT, trimmed);
}

function defaultXaiCollectionNameForRoot(absRoot: string, deploySlug: string): string {
  const base = absRoot.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
  if (base === "options-strategy") {
    return `atx-trusted-advisor-${deploySlug}-options-strategy`;
  }
  return `atx-trusted-advisor-${deploySlug}-xpersonas`;
}

function teamUuidForXaiIngest(teamIdMerged: string): string {
  const raw = (teamIdMerged || "").trim();
  if (!raw || XAI_KB_COLLECTION_RE.test(raw)) {
    return "";
  }
  return raw;
}

function shouldSkip(): boolean {
  const s = String(process.env.SKIP_SEED_XPERSONAS ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function resolveMode(): "merge" | "replace" {
  const m = String(process.env.SEED_XPERSONAS_MODE ?? "merge")
    .trim()
    .toLowerCase();
  if (m === "replace") {
    return "replace";
  }
  return "merge";
}

function resolveSessionCookieHeader(): string {
  const c = process.env.XF_CORE_SESSION?.trim() || process.env.SYNC_PERSONAS_SESSION?.trim();
  if (!c) {
    throw new Error(
      "For --api, set XF_CORE_SESSION (or SYNC_PERSONAS_SESSION) to your signed session cookie payload (see AGENTS.md)."
    );
  }
  if (c.toLowerCase().includes("xf_core_session=")) {
    return c;
  }
  return `xf_core_session=${c}`;
}

function findCollectionByDisplayName(list: unknown[], displayName: string): { id: string; name: string } {
  const want = String(displayName).trim().toLowerCase();
  if (!want) {
    return { id: "", name: "" };
  }
  for (const c of list) {
    const n = collectionNameFromEntry(c);
    if (n && n.toLowerCase() === want) {
      const id = collectionIdFromEntry(c);
      if (id) {
        return { id, name: n };
      }
    }
  }
  return { id: "", name: "" };
}

function toApiCreateBody(derived: ReturnType<typeof buildYamlDerived>): Record<string, unknown> {
  const xc = derived.xaiCollection;
  const body: Record<string, unknown> = {
    name: derived.name,
    systemPrompt: derived.systemPrompt,
    model: derived.model,
    temperature: derived.temperature,
    enableRag: derived.enableRag,
    defaultScope: derived.defaultScope,
    xapi: derived.xapi
  };
  if (derived.overridePrompt) {
    body.overridePrompt = derived.overridePrompt;
  }
  if (xc.collectionId) {
    body.xaiCollection = {
      collectionId: xc.collectionId,
      ...(xc.collectionName ? { collectionName: xc.collectionName } : {})
    };
  }
  return body;
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

async function loadPersonaIndex(
  baseUrl: string,
  cookie: string
): Promise<Map<string, { _id: string; raw: Record<string, unknown> }>> {
  const res = await fetch(`${baseUrl}/api/personas`, {
    headers: { Cookie: cookie }
  });
  const j = (await res.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> };
  if (!res.ok) {
    throw new Error(`GET /api/personas failed: HTTP ${res.status} ${JSON.stringify(j)}`);
  }
  const list = Array.isArray(j.data) ? j.data : [];
  const map = new Map<string, { _id: string; raw: Record<string, unknown> }>();
  for (const row of list) {
    const name = String(row.name ?? "").trim().toLowerCase();
    const id = String(row._id ?? "").trim();
    if (name && id) {
      map.set(name, { _id: id, raw: row });
    }
  }
  return map;
}

async function syncOneViaApi(
  baseUrl: string,
  cookie: string,
  index: Map<string, { _id: string; raw: Record<string, unknown> }>,
  derived: ReturnType<typeof buildYamlDerived>,
  mode: "merge" | "replace",
  rel: string
): Promise<void> {
  const key = derived.name.trim().toLowerCase();
  const headers = {
    "Content-Type": "application/json",
    Cookie: cookie
  };
  const hit = index.get(key);

  if (!hit) {
    const res = await fetch(`${baseUrl}/api/personas`, {
      method: "POST",
      headers,
      body: JSON.stringify(toApiCreateBody(derived))
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[seed:xpersonas:api] POST ${key} failed HTTP ${res.status}:`, j);
      return;
    }
    const data = (j as { data?: Record<string, unknown> }).data;
    const id = data?._id != null ? String(data._id) : "";
    if (id) {
      index.set(key, { _id: id, raw: data ?? {} });
    }
    console.log(`[seed:xpersonas:api] created ${key} ← ${rel}`);
    return;
  }

  const patch = computePersonaSeedUpdatePatch(hit.raw, derived as Record<string, unknown>, mode);
  delete patch.isSystem;
  const body = stripUndefined(patch as Record<string, unknown>);
  if (Object.keys(body).length === 0) {
    console.log(`[seed:xpersonas:api] merge noop ${key} ← ${rel}`);
    return;
  }

  const res = await fetch(`${baseUrl}/api/personas/${hit._id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn(`[seed:xpersonas:api] PUT ${key} failed HTTP ${res.status}:`, j);
    return;
  }
  const data = (j as { data?: Record<string, unknown> }).data;
  if (data && data._id) {
    index.set(key, { _id: String(data._id), raw: data });
  }
  console.log(`[seed:xpersonas:api] updated (${mode}) ${key} ← ${rel}`);
}

async function main(): Promise<void> {
  const { rootInput, useApi } = parseCliArgs(process.argv.slice(2));
  const rootAbs = resolveRootAbs(rootInput);

  if (shouldSkip()) {
    console.log("[seed:xpersonas] SKIP_SEED_XPERSONAS set — skipping");
    return;
  }

  const mode = resolveMode();
  if (process.env.NODE_ENV === "production" && mode === "replace") {
    console.warn(
      "[seed:xpersonas] WARNING: SEED_XPERSONAS_MODE=replace in production overwrites prompts, xapi, and collection linkage fields."
    );
    if (String(process.env.SEED_XPERSONAS_STRICT ?? "").trim() === "1") {
      console.error("[seed:xpersonas] SEED_XPERSONAS_STRICT=1 — exiting.");
      process.exit(1);
    }
  }

  try {
    await stat(rootAbs);
  } catch {
    console.error(`[seed:xpersonas] root not found: ${rootAbs}`);
    process.exit(1);
  }

  const seedTenant = loadSeedTenantContext(REPO_ROOT);
  const deploySlug = seedTenant.trustedAdvisorDeploySlug;
  const defaultXaiCollectionName = defaultXaiCollectionNameForRoot(rootAbs, deploySlug);

  const specFiles = await collectPersonaSpecFiles(rootAbs);
  if (specFiles.length === 0) {
    console.warn(`[seed:xpersonas] no .yaml/.yml/.md specs under ${rootAbs}`);
    return;
  }

  const defaultModel = resolveDefaultPersonaModelFromEnv();
  const m = seedTenant.merged;
  const mgmtKey = (m.xaiMgmtKey || "").trim();
  const mgmtBase = (m.xaiMgmtBaseUrl || "https://management-api.x.ai/v1").replace(/\/$/, "");
  const teamForList = teamUuidForXaiIngest(m.xaiTeamId);

  let collectionList: unknown[] = [];
  if (mgmtKey) {
    try {
      collectionList = await managementListCollectionsRaw(mgmtKey, mgmtBase, teamForList);
      console.log(
        `[seed:xpersonas] listed ${collectionList.length} xAI collections (team scoped: ${Boolean(teamForList)})`
      );
    } catch (e) {
      console.warn(
        "[seed:xpersonas] xAI collections list failed — continuing without collection ids:",
        e instanceof Error ? e.message : e
      );
    }
  } else {
    console.warn("[seed:xpersonas] XAI_MANAGEMENT_API_KEY unset — cannot resolve collection ids by name");
  }

  const logPrefix = useApi ? "[seed:xpersonas:api]" : "[seed:xpersonas]";
  console.log(
    `${logPrefix} root=${rootAbs.replace(REPO_ROOT + "/", "")} defaultCollection=${defaultXaiCollectionName} mode=${mode}`
  );

  if (useApi) {
    const baseUrl = String(process.env.SYNC_PERSONAS_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
    const cookie = resolveSessionCookieHeader();
    const index = await loadPersonaIndex(baseUrl, cookie);

    for (const abs of specFiles) {
      const loaded = await loadPersonaDocFromFile(abs, REPO_ROOT);
      if ("error" in loaded) {
        console.warn(`[seed:xpersonas] ${loaded.error}`);
        continue;
      }
      const doc = injectDefaultModel(loaded.doc, defaultModel);
      const err = validateParsedPersonaDoc(doc, loaded.rel, defaultModel);
      if (err) {
        console.warn(`[seed:xpersonas] ${err}`);
        continue;
      }

      const displayNameOverride =
        typeof doc.xai_collection_name === "string" ? doc.xai_collection_name.trim() : "";
      const targetDisplayName = displayNameOverride || defaultXaiCollectionName;
      const found = findCollectionByDisplayName(collectionList, targetDisplayName);
      if (mgmtKey && !found.id) {
        console.warn(
          `[seed:xpersonas] no xAI collection named "${targetDisplayName}" — ${loaded.rel} will sync without collectionId`
        );
      }
      const colRef = {
        collectionId: found.id,
        collectionDisplayName: found.name || targetDisplayName
      };
      const derived = buildYamlDerived(doc, colRef);
      await syncOneViaApi(baseUrl, cookie, index, derived, mode, loaded.rel);
    }
    return;
  }

  const mongoUri = resolveMongoUri();
  const dbName = resolveAdminSeedDbName();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const personasCol = client.db(dbName).collection("xchat_personas");
  const now = new Date();

  try {
    for (const abs of specFiles) {
      const loaded = await loadPersonaDocFromFile(abs, REPO_ROOT);
      if ("error" in loaded) {
        console.warn(`[seed:xpersonas] ${loaded.error}`);
        continue;
      }
      const doc = injectDefaultModel(loaded.doc, defaultModel);
      const err = validateParsedPersonaDoc(doc, loaded.rel, defaultModel);
      if (err) {
        console.warn(`[seed:xpersonas] ${err}`);
        continue;
      }
      const name = String(doc.name).trim();
      const nameNormalized = name.toLowerCase();

      const displayNameOverride =
        typeof doc.xai_collection_name === "string" ? doc.xai_collection_name.trim() : "";
      const targetDisplayName = displayNameOverride || defaultXaiCollectionName;
      const found = findCollectionByDisplayName(collectionList, targetDisplayName);
      if (mgmtKey && !found.id) {
        console.warn(
          `[seed:xpersonas] no xAI collection named "${targetDisplayName}" — ${loaded.rel} will sync without collectionId`
        );
      }

      const colRef = {
        collectionId: found.id,
        collectionDisplayName: found.name || targetDisplayName
      };
      const derived = buildYamlDerived(doc, colRef);

      const existing = await personasCol.findOne({ nameNormalized });

      if (!existing) {
        await personasCol.updateOne(
          { nameNormalized },
          {
            $setOnInsert: {
              name,
              nameNormalized,
              createdAt: now,
              status: "draft"
            },
            $set: {
              ...buildPersonaInsertSetBody(derived as Record<string, unknown>),
              updatedAt: now
            }
          },
          { upsert: true }
        );
        console.log(`[seed:xpersonas] upserted (new) ${nameNormalized} ← ${loaded.rel}`);
      } else {
        const patch = computePersonaSeedUpdatePatch(
          existing as Record<string, unknown>,
          derived as Record<string, unknown>,
          mode
        );
        await personasCol.updateOne({ nameNormalized }, { $set: { ...patch, updatedAt: now } });
        console.log(`[seed:xpersonas] updated (${mode}) ${nameNormalized} ← ${loaded.rel}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((e: unknown) => {
  console.error("[seed:xpersonas] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
