/**
 * Upsert `xchat_personas` from all `.yaml` files under `atx-rag-collection/xpersonas/` (recursive).
 * Resolves xAI collection id by display name (management API list).
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";
import { parse as parseYaml } from "yaml";

import {
    buildPersonaInsertSetBody,
    computePersonaSeedUpdatePatch
} from "@/modules/xchat/persona-seed-merge";

import { buildSuperAgentXapiTools } from "./lib/persona-xapi-tools.mjs";
import { resolveAdminSeedDbName, resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";
import {
    collectionIdFromEntry,
    collectionNameFromEntry,
    managementListCollectionsRaw
} from "./lib/seed-xai-rag-ingest.mjs";
import { loadSeedTenantContext } from "./lib/tenant-defaults-seed.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

const XAI_KB_COLLECTION_RE = /^collection_[A-Za-z0-9_-]+$/;

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

function coerceBool(v: unknown, defaultVal = true): boolean {
  if (v === undefined || v === null) {
    return defaultVal;
  }
  if (typeof v === "boolean") {
    return v;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "false" || s === "0" || s === "no") {
    return false;
  }
  if (s === "true" || s === "1" || s === "yes") {
    return true;
  }
  return defaultVal;
}

function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", ".").trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

async function collectXpersonaYamlFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(absDir: string): Promise<void> {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith(".")) {
        continue;
      }
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith(".yaml")) {
        out.push(abs);
      }
    }
  }
  await walk(rootDir);
  return out.sort();
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

function buildXapiFromYaml(raw: Record<string, unknown>, collectionId: string) {
  const defaultTools = buildSuperAgentXapiTools(collectionId ? [collectionId] : []);
  const x = raw.xapi;
  if (x && typeof x === "object" && x !== null && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    const mode = typeof o.mode === "string" ? o.mode : "responses";
    const toolChoice = typeof o.toolChoice === "string" ? o.toolChoice : "auto";
    const maxTurns = coerceNumber(o.maxTurns, 5);
    const tools = Array.isArray(o.tools) && o.tools.length > 0 ? o.tools : defaultTools;
    return {
      mode: mode === "chat_completions" ? ("chat_completions" as const) : ("responses" as const),
      toolChoice:
        toolChoice === "required" || toolChoice === "none"
          ? (toolChoice as "required" | "none")
          : ("auto" as const),
      maxTurns: Math.min(10, Math.max(1, Math.floor(maxTurns))),
      tools
    };
  }
  return {
    mode: "responses" as const,
    toolChoice: "auto" as const,
    maxTurns: 5,
    tools: defaultTools
  };
}

function buildYamlDerived(
  doc: Record<string, unknown>,
  col: { collectionId: string; collectionDisplayName: string }
) {
  const name = String(doc.name ?? "").trim();
  const systemPrompt = String(doc.system_prompt ?? "").trim();
  const overridePrompt = typeof doc.override_prompt === "string" ? doc.override_prompt.trim() : "";
  const model = String(doc.model ?? "").trim();
  const enableRag = coerceBool(doc.enable_rag, true);
  const defaultScope = String(doc.default_scope ?? "global").trim() || "global";
  const temperature = coerceNumber(doc.temperature, 0.2);
  const t = Math.min(1, Math.max(0, temperature));

  const xaiCollection: { collectionId?: string; collectionName?: string } = {};
  if (col.collectionId) {
    xaiCollection.collectionId = col.collectionId;
    xaiCollection.collectionName = col.collectionDisplayName || undefined;
  }

  return {
    name,
    systemPrompt,
    overridePrompt,
    model,
    enableRag,
    defaultScope,
    temperature: t,
    xaiCollection,
    xapi: buildXapiFromYaml(doc, col.collectionId)
  };
}

function validateParsedPersonaYaml(parsed: unknown, fileLabel: string): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return `${fileLabel}: invalid YAML root`;
  }
  const o = parsed as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return `${fileLabel}: name must be 2–80 chars`;
  }
  const sp = String(o.system_prompt ?? "").trim();
  if (sp.length < 10) {
    return `${fileLabel}: system_prompt must be at least 10 characters`;
  }
  const model = String(o.model ?? "").trim();
  if (!model) {
    return `${fileLabel}: model is required`;
  }
  if (model.length > 120) {
    return `${fileLabel}: model too long`;
  }
  return null;
}

async function main(): Promise<void> {
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

  const seedTenant = loadSeedTenantContext(REPO_ROOT);
  const deploySlug = seedTenant.trustedAdvisorDeploySlug;
  const defaultXaiCollectionName = `atx-trusted-advisor-${deploySlug}-xpersonas`;

  const xpersonasDir = join(REPO_ROOT, "atx-rag-collection", "xpersonas");
  const yamlFiles = await collectXpersonaYamlFiles(xpersonasDir);
  if (yamlFiles.length === 0) {
    console.warn(`[seed:xpersonas] no YAML under ${xpersonasDir}`);
    return;
  }

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

  const mongoUri = resolveMongoUri();
  const dbName = resolveAdminSeedDbName();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const personasCol = client.db(dbName).collection("xchat_personas");
  const now = new Date();

  try {
    for (const abs of yamlFiles) {
      const rel = abs.replace(REPO_ROOT + "/", "");
      let text: string;
      try {
        text = await readFile(abs, "utf8");
      } catch (e) {
        console.warn(`[seed:xpersonas] skip read ${rel}:`, e instanceof Error ? e.message : e);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = parseYaml(text);
      } catch (e) {
        console.warn(`[seed:xpersonas] skip parse ${rel}:`, e instanceof Error ? e.message : e);
        continue;
      }
      const err = validateParsedPersonaYaml(parsed, rel);
      if (err) {
        console.warn(`[seed:xpersonas] ${err}`);
        continue;
      }
      const doc = parsed as Record<string, unknown>;
      const name = String(doc.name).trim();
      const nameNormalized = name.toLowerCase();

      const displayNameOverride =
        typeof doc.xai_collection_name === "string" ? doc.xai_collection_name.trim() : "";
      const targetDisplayName = displayNameOverride || defaultXaiCollectionName;
      const found = findCollectionByDisplayName(collectionList, targetDisplayName);
      if (mgmtKey && !found.id) {
        console.warn(
          `[seed:xpersonas] no xAI collection named "${targetDisplayName}" — ${rel} will sync without collectionId`
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
              ...buildPersonaInsertSetBody(derived),
              updatedAt: now
            }
          },
          { upsert: true }
        );
        console.log(`[seed:xpersonas] upserted (new) ${nameNormalized} ← ${rel}`);
      } else {
        const patch = computePersonaSeedUpdatePatch(
          existing as Record<string, unknown>,
          derived as Record<string, unknown>,
          mode
        );
        await personasCol.updateOne({ nameNormalized }, { $set: { ...patch, updatedAt: now } });
        console.log(`[seed:xpersonas] updated (${mode}) ${nameNormalized} ← ${rel}`);
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
