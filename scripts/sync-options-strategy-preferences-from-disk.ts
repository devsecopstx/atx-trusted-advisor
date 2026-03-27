/**
 * Upserts `options_strategy_preferences` from `atx-docs/rag-collection/options-strategy/<slug>/<file>.md` (falls back to legacy `atx-rag-collection/options-strategy`).
 * Invoked by `npm run seed:options-strategy-prefs` and post-`seed:admin` unless SKIP_SEED_OPTIONS_STRATEGY_PREFS=1.
 */
import { access, constants as fsConstants, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";

import { resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";
import { formatSyncTargetMongoDatabaseLogSuffix, resolveSyncTargetMongoDatabaseName } from "./lib/sync-target-mongo-db";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const PREFERRED_STRATEGY_ROOT = join(REPO_ROOT, "atx-docs/rag-collection/options-strategy");
const LEGACY_STRATEGY_ROOT = join(REPO_ROOT, "atx-rag-collection/options-strategy");
const STRATEGY_ROOT = await (async () => {
  try {
    await access(PREFERRED_STRATEGY_ROOT, fsConstants.R_OK);
    return PREFERRED_STRATEGY_ROOT;
  } catch {
    return LEGACY_STRATEGY_ROOT;
  }
})();
const COLLECTION = "options_strategy_preferences";

const SLUG_RE = /^[a-z][a-z0-9-]{0,62}$/;

type StrategyDiskRow = {
  slug: string;
  name: string;
  description: string;
  sourceRelPath: string;
};

type StrategySyncSummary = {
  root: string;
  filesDiscovered: number;
  upserted: number;
};

async function collectMarkdownFilesRecursive(absDir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith(".")) {
      continue;
    }
    const abs = join(absDir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectMarkdownFilesRecursive(abs)));
      continue;
    }
    if (!ent.isFile()) {
      continue;
    }
    const low = ent.name.toLowerCase();
    if (!low.endsWith(".md") || low === "readme.md") {
      continue;
    }
    out.push(abs);
  }
  return out.sort();
}

function toKebabSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromRelativeMarkdownPath(relPath: string): string {
  const noExt = relPath.replace(/\.md$/i, "");
  const rawSegments = noExt.split("/").filter(Boolean).map((s) => toKebabSlug(s));
  const segments = rawSegments.filter(Boolean);
  if (segments.length >= 2 && segments.at(-1) === segments.at(-2)) {
    segments.pop();
  }
  return toKebabSlug(segments.join("-"));
}

async function listStrategyRowsFromDisk(): Promise<StrategyDiskRow[]> {
  const mdFiles = await collectMarkdownFilesRecursive(STRATEGY_ROOT);
  const rows: StrategyDiskRow[] = [];

  for (const mdAbs of mdFiles) {
    const rel = relative(STRATEGY_ROOT, mdAbs).replaceAll("\\", "/");
    const slug = slugFromRelativeMarkdownPath(rel);
    if (!SLUG_RE.test(slug)) {
      console.warn(`[seed:options-strategy-prefs] skip invalid slug for path ${rel}: ${slug || "(empty)"}`);
      continue;
    }
    const raw = await readFile(mdAbs, "utf8");
    const fileStem = basename(mdAbs).replace(/\.md$/i, "");
    const dirStem = basename(dirname(mdAbs));
    const name = toKebabSlug(fileStem) === toKebabSlug(dirStem) ? dirStem : fileStem;

    rows.push({
      slug,
      name,
      description: raw,
      sourceRelPath: rel.replaceAll("\\", "/")
    });
  }

  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

async function main(): Promise<void> {
  const rows = await listStrategyRowsFromDisk();
  if (rows.length === 0) {
    console.warn("[seed:options-strategy-prefs] no strategy folders with markdown — nothing to upsert");
    return;
  }

  const mongoUri = resolveMongoUri();
  const dbName = resolveSyncTargetMongoDatabaseName();
  console.log(`[seed:options-strategy-prefs] Mongo database: ${dbName}${formatSyncTargetMongoDatabaseLogSuffix()}`);
  const client = new MongoClient(mongoUri);
  await client.connect();
  const col = client.db(dbName).collection(COLLECTION);
  const now = new Date();
  const summary: StrategySyncSummary = {
    root: STRATEGY_ROOT.replace(REPO_ROOT + "/", ""),
    filesDiscovered: rows.length,
    upserted: 0
  };

  try {
    await col.createIndex({ slug: 1 }, { name: "uniq_options_strategy_preferences_slug", unique: true });

    for (const row of rows) {
      await col.updateOne(
        { slug: row.slug },
        {
          $setOnInsert: { createdAt: now },
          $set: {
            name: row.name,
            description: row.description,
            sourceRelPath: row.sourceRelPath,
            updatedAt: now
          }
        },
        { upsert: true }
      );
      console.log(`[seed:options-strategy-prefs] upserted ${row.slug} ← ${row.sourceRelPath}`);
      summary.upserted += 1;
    }
  } finally {
    await client.close();
  }
  console.log(`[seed:options-strategy-prefs] concise summary: ${JSON.stringify(summary)}`);
  if (String(process.env.SEED_SYNC_SUMMARY_JSON ?? "").trim() === "1") {
    console.log(`SEED_SUMMARY_JSON=${JSON.stringify(summary)}`);
  }
}

main().catch((e: unknown) => {
  console.error("[seed:options-strategy-prefs] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
