/**
 * Sync `admin_scheduled_tasks` to canonical **categories** + **default crons** from
 * `src/lib/scheduled-task-category-schema.ts` (`SCHEDULED_TASK_CATEGORY_DEFAULT_CRON`), with human-readable names from
 * `src/lib/scheduled-task-category-catalog.ts` (`SCHEDULED_TASK_CATEGORY_DISPLAY_NAME`).
 *
 * - **Tenant:** first `core_tenants` row (sorted by `_id`), or `SCHEDULED_TASKS_SYNC_TENANT_ID` / `--tenant=<hex>`.
 * - **Upsert key:** `tenantId` + `category` + no `portfolioId` (tenant-level tasks only).
 * - **Legacy:** rows with `category: daily_options_scanner` are rewritten to `options_scanner` on `--apply` (count shown in dry-run).
 * - **`--seed-if-empty`:** if the tenant has **zero** tenant-level tasks before sync, runs `npm run seed:admin` (requires `.env` / `--file` with `ADMIN_SEED_EMAIL`, etc.) then continues.
 *
 * Usage:
 *   npm run ops:scheduled-tasks:sync -- --dry-run
 *   npm run ops:scheduled-tasks:sync -- --apply
 *   npm run ops:scheduled-tasks:sync -- --file=.env.stage --apply --seed-if-empty
 *
 * @see `atx-docs/design-system/scheduled-task/schedule-tasks-admin.md` · `.cursor/agents/sre.md`
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Collection, type Db, MongoClient, ObjectId } from "mongodb";

import cronstrue from "cronstrue";

import { SCHEDULED_TASK_CATEGORY_DISPLAY_NAME } from "@/lib/scheduled-task-category-catalog";
import {
    SCHEDULED_TASK_CATEGORIES,
    SCHEDULED_TASK_CATEGORY_DEFAULT_CRON
} from "@/lib/scheduled-task-category-schema";
import { computeNextRunAtFromCron } from "@/lib/scheduled-task-cron";

import { resolveMongoUri } from "../lib/resolve-mongo-uri.mjs";
import { resolveSyncTargetMongoDatabaseName } from "../lib/sync-target-mongo-db";

const COLLECTION = "admin_scheduled_tasks";
const TENANTS = "core_tenants";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "../..");

function describeCron(scheduleCron: string): string {
  try {
    return cronstrue.toString(scheduleCron).slice(0, 280);
  } catch {
    return "Custom cron schedule";
  }
}

type Cli = {
  apply: boolean;
  dryRun: boolean;
  seedIfEmpty: boolean;
  force: boolean;
  tenantId: string | null;
  envFile: string | null;
};

function loadEnvFromFile(filePath: string): void {
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) {
      process.env[key] = val;
    }
  }
}

function parseArgs(argv: string[]): Cli {
  let apply = false;
  let dryRun = true;
  let seedIfEmpty = false;
  let force = false;
  let tenantId: string | null = process.env.SCHEDULED_TASKS_SYNC_TENANT_ID?.trim() || null;
  let envFile: string | null = null;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      apply = false;
      continue;
    }
    if (arg === "--seed-if-empty") {
      seedIfEmpty = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    const tenantM = arg.match(/^--tenant=(.+)$/);
    if (tenantM) {
      tenantId = tenantM[1]!.trim();
      continue;
    }
    const fileM = arg.match(/^--file=(.+)$/) || arg.match(/^--env-file=(.+)$/);
    if (fileM) {
      envFile = fileM[1]!.trim();
    }
  }

  return { apply, dryRun, seedIfEmpty, force, tenantId, envFile };
}

async function resolveTenantId(db: Db, explicit: string | null): Promise<ObjectId> {
  if (explicit && ObjectId.isValid(explicit)) {
    return new ObjectId(explicit);
  }
  const row = await db.collection(TENANTS).findOne({}, { sort: { _id: 1 } });
  if (!row?._id) {
    throw new Error(
      `[sync-scheduled-tasks] No document in ${TENANTS}. Run: npm run seed:admin (set ADMIN_SEED_EMAIL in .env), then re-run.`
    );
  }
  return row._id as ObjectId;
}

function tenantLevelFilter(tenantId: ObjectId) {
  return {
    tenantId,
    $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
  };
}

async function countTenantTasks(coll: Collection, tenantId: ObjectId): Promise<number> {
  return coll.countDocuments(tenantLevelFilter(tenantId));
}

function runSeedAdmin(envFile: string | null): void {
  const seedScript = join(REPO_ROOT, "scripts/seed-admin-user.mjs");
  if (envFile) {
    console.log(`[sync-scheduled-tasks] node --env-file=${envFile} scripts/seed-admin-user.mjs …`);
    execFileSync("node", ["--env-file=" + envFile, seedScript], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env
    });
  } else {
    console.log("[sync-scheduled-tasks] npm run seed:admin …");
    execFileSync("npm", ["run", "seed:admin"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env
    });
  }
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.envFile) {
    loadEnvFromFile(cli.envFile);
  }

  const uri = resolveMongoUri();
  const dbName = resolveSyncTargetMongoDatabaseName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection(COLLECTION);

  const tenantId = await resolveTenantId(db, cli.tenantId);
  console.log(
    `[sync-scheduled-tasks] db=${dbName} tenantId=${tenantId.toHexString()} mode=${cli.apply ? "apply" : "dry-run"}`
  );

  let nExisting = await countTenantTasks(coll, tenantId);
  if (cli.seedIfEmpty && nExisting === 0) {
    if (!cli.apply) {
      console.log(
        "[sync-scheduled-tasks] --seed-if-empty: would run npm run seed:admin (tenant has 0 tasks); use --apply to execute."
      );
    } else {
      runSeedAdmin(cli.envFile);
      nExisting = await countTenantTasks(coll, tenantId);
      console.log(`[sync-scheduled-tasks] after seed: tenant task count=${nExisting}`);
    }
  }

  const now = new Date();
  const plan: string[] = [];

  for (const category of SCHEDULED_TASK_CATEGORIES) {
    const scheduleCron = SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[category];
    const name = SCHEDULED_TASK_CATEGORY_DISPLAY_NAME[category];
    const scheduleDescription = describeCron(scheduleCron);
    const nextRunAt =
      computeNextRunAtFromCron(scheduleCron, now) ?? new Date(now.getTime() + 5 * 60 * 1000);

    const existing = await coll.findOne({
      ...tenantLevelFilter(tenantId),
      category
    });

    if (!existing) {
      plan.push(`CREATE ${category} cron=${scheduleCron} name=${name}`);
      if (cli.apply) {
        await coll.insertOne({
          name,
          category,
          scheduleCron,
          scheduleDescription,
          enabled: true,
          nextRunAt,
          tenantId
        });
      }
      continue;
    }

    const cronDrift = (existing.scheduleCron ?? "").trim() !== scheduleCron;
    const nameDrift = (existing.name ?? "").trim() !== name;
    if (!cronDrift && !nameDrift && !cli.force) {
      plan.push(`OK ${category} (matches spec)`);
      continue;
    }

    plan.push(
      `UPDATE ${category} cron ${existing.scheduleCron ?? "(none)"} -> ${scheduleCron}` +
        (nameDrift ? ` name -> ${name}` : "") +
        (cli.force ? " (force)" : "")
    );
    if (cli.apply) {
      const $set: Record<string, unknown> = {
        name,
        scheduleCron,
        scheduleDescription
      };
      if (cronDrift || cli.force) {
        $set.nextRunAt =
          computeNextRunAtFromCron(scheduleCron, now) ?? new Date(now.getTime() + 5 * 60 * 1000);
      }
      await coll.updateOne({ _id: existing._id }, { $set });
    }
  }

  const legacyDailyOptions = await coll.countDocuments({
    ...tenantLevelFilter(tenantId),
    category: "daily_options_scanner"
  });
  if (legacyDailyOptions > 0) {
    plan.push(
      `MIGRATE ${legacyDailyOptions} task(s): category daily_options_scanner -> options_scanner (removed alias)`
    );
    if (cli.apply) {
      await coll.updateMany(
        { ...tenantLevelFilter(tenantId), category: "daily_options_scanner" },
        { $set: { category: "options_scanner" } }
      );
    }
  }

  console.log("[sync-scheduled-tasks] plan:\n" + plan.map((l) => `  ${l}`).join("\n"));

  if (!cli.apply) {
    console.log("[sync-scheduled-tasks] dry-run only. Re-run with --apply to write.");
  }

  await client.close();
}

main().catch((e) => {
  console.error("[sync-scheduled-tasks] failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
