/**
 * Upserts `options_strategy` from `atx-rag-collection/options-strategy/<slug>/<file>.md`.
 * Invoked by post-`seed:admin` unless SKIP_SEED_OPTIONS_STRATEGY=1.
 */
import { access, constants as fsConstants, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoClient } from "mongodb";

import { resolveMongoUri } from "./lib/resolve-mongo-uri.mjs";
import { formatSyncTargetMongoDatabaseLogSuffix, resolveSyncTargetMongoDatabaseName } from "./lib/sync-target-mongo-db";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const STRATEGY_ROOT = join(REPO_ROOT, "atx-rag-collection/options-strategy");
const COLLECTION = "options_strategy";

const SLUG_RE = /^[a-z][a-z0-9-]{0,62}$/;

type StrategyDiskRow = {
  slug: string;
  name: string;
  description: string;
  sourceRelPath: string;
};

async function listStrategyRowsFromDisk(): Promise<StrategyDiskRow[]> {
  const entries = await readdir(STRATEGY_ROOT, { withFileTypes: true });
  const rows: StrategyDiskRow[] = [];

  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const slug = ent.name;
    if (!SLUG_RE.test(slug)) {
      console.warn(`[seed:options-strategy] skip invalid slug directory: ${slug}`);
      continue;
    }
    const dir = join(STRATEGY_ROOT, slug);
    const preferred = join(dir, `${slug}.md`);
    let mdPath: string | null = null;
    let rel: string;
    try {
      await access(preferred, fsConstants.R_OK);
      mdPath = preferred;
      rel = `${slug}/${slug}.md`;
    } catch {
      const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".md"));
      if (files.length === 0) {
        console.warn(`[seed:options-strategy] skip ${slug}: no .md file`);
        continue;
      }
      if (files.length > 1) {
        console.warn(
          `[seed:options-strategy] skip ${slug}: multiple .md files — add ${slug}.md or leave a single markdown file`
        );
        continue;
      }
      const only = files[0]!;
      mdPath = join(dir, only);
      rel = `${slug}/${only}`;
    }

    const raw = await readFile(mdPath!, "utf8");
    const base = mdPath!.split(/[/\\]/).pop() ?? `${slug}.md`;
    const name = base.replace(/\.md$/i, "") || slug;

    rows.push({ slug, name, description: raw, sourceRelPath: rel.replaceAll("\\", "/") });
  }

  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

async function main(): Promise<void> {
  const rows = await listStrategyRowsFromDisk();
  if (rows.length === 0) {
    console.warn("[seed:options-strategy] no strategy folders with markdown — nothing to upsert");
    return;
  }

  const mongoUri = resolveMongoUri();
  const dbName = resolveSyncTargetMongoDatabaseName();
  console.log(`[seed:options-strategy] Mongo database: ${dbName}${formatSyncTargetMongoDatabaseLogSuffix()}`);
  const client = new MongoClient(mongoUri);
  await client.connect();
  const col = client.db(dbName).collection(COLLECTION);
  const now = new Date();

  try {
    await col.createIndex({ slug: 1 }, { name: "uniq_options_strategy_slug", unique: true });

    for (const row of rows) {
      await col.updateOne(
        { slug: row.slug },
        {
          $setOnInsert: { createdAt: now, filters: {} },
          $set: {
            name: row.name,
            description: row.description,
            sourceRelPath: row.sourceRelPath,
            updatedAt: now
          }
        },
        { upsert: true }
      );
      console.log(`[seed:options-strategy] upserted ${row.slug} ← ${row.sourceRelPath}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((e: unknown) => {
  console.error("[seed:options-strategy] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
