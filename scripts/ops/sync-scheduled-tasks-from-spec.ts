/**
 * Sync `admin_scheduled_tasks` to canonical **categories** + **default crons** from
 * `src/lib/scheduled-task-category-schema.ts` (`SCHEDULED_TASK_CATEGORY_DEFAULT_CRON`), with human-readable names from
 * `src/lib/scheduled-task-category-catalog.ts` (`SCHEDULED_TASK_CATEGORY_DISPLAY_NAME`).
 *
 * - **Task scope (default):** **system-wide** — upserts rows **without** `tenantId`; scheduler runs each category **once per
 *   `core_tenants` document** per tick (`listCoreTenantObjectIds` + `executeSystemWideScheduledTask` in `task-runner.ts`).
 * - **Per-tenant scope (legacy):** set `SCHEDULED_TASKS_SYNC_TENANT_ID` and/or pass **`--tenant=<hex>`** on the CLI — upserts
 *   `tenantId` + `category` + no `portfolioId` (duplicate rows if you also keep system-wide rows; prefer one model).
 * - **Delivery channels:** still seeded/updated against **one** tenant (first `core_tenants` row, or `SCHEDULED_TASKS_SYNC_TENANT_ID` / `--tenant=` when set).
 * - **Legacy:** rows with `category: daily_options_scanner` are rewritten to `options_scanner` on `--apply` (count shown in dry-run).
 * - **`--seed-if-empty`:** if the tenant has **zero** tenant-level tasks before sync, runs `npm run seed:admin` (requires `.env` / `--file` with `ADMIN_SEED_EMAIL`, etc.) then continues.
 * - **`seed:admin`:** `scripts/seed-admin-user.mjs` runs this script with **`--apply --tenant=<seeded tenant>`** after options-strategy sync (unless **`SKIP_SEED_SCHEDULED_TASKS_SYNC=1`**).
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
    SCHEDULED_TASK_CATEGORY_DEFAULT_CRON,
    type ScheduledTaskCategory
} from "@/lib/scheduled-task-category-schema";
import { computeNextRunAtFromCron } from "@/lib/scheduled-task-cron";

/** Categories omitted from automatic upsert (operators create rows manually). */
const SCHEDULED_TASK_CATEGORIES_EXCLUDED_FROM_SPEC_SYNC: ReadonlySet<ScheduledTaskCategory> = new Set([
  "xchat_spend_alert"
]);

import { resolveMongoUri } from "../lib/resolve-mongo-uri.mjs";
import { resolveSyncTargetMongoDatabaseName } from "../lib/sync-target-mongo-db";

const COLLECTION = "admin_scheduled_tasks";
const ADMIN_DELIVERY_CHANNELS_COLLECTION = "admin_delivery_channels";
const TENANTS = "core_tenants";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "../..");

type DeliveryTarget = "in_app" | "slack";

type SeededAdminDeliveryChannel = {
  name: string;
  deliveryTarget: DeliveryTarget;
  /** Required for slack targets on create; value loaded from process.env[slackWebhookEnv]. */
  slackWebhookEnv?: string;
};

const SEEDED_ADMIN_DELIVERY_CHANNELS: readonly SeededAdminDeliveryChannel[] = [
  {
    name: "trusted-advisor",
    deliveryTarget: "slack",
    slackWebhookEnv: "SCHEDULED_TASKS_SYNC_TRUSTED_ADVISOR_SLACK_WEBHOOK_URL"
  },
  {
    name: "in-app-alert",
    deliveryTarget: "in_app"
  },
  {
    name: "atx-admin-channel",
    deliveryTarget: "slack",
    slackWebhookEnv: "SCHEDULED_TASKS_SYNC_ATX_ADMIN_CHANNEL_SLACK_WEBHOOK_URL"
  }
] as const;

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
  /** True only when `--tenant=…` was passed (not env-only). */
  tenantIdFromCli: boolean;
  envFile: string | null;
};

function extractEnvFilePath(argv: string[]): string | null {
  for (const arg of argv) {
    const m = arg.match(/^--(?:file|env-file)=(.+)$/);
    if (m?.[1]) {
      return m[1]!.trim();
    }
  }
  return null;
}

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
  let tenantIdFromCli = false;
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
      tenantIdFromCli = true;
      continue;
    }
    const fileM = arg.match(/^--file=(.+)$/) || arg.match(/^--env-file=(.+)$/);
    if (fileM) {
      envFile = fileM[1]!.trim();
    }
  }

  return { apply, dryRun, seedIfEmpty, force, tenantId, tenantIdFromCli, envFile };
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

function globalSystemTaskFilter(category: string) {
  return {
    category,
    $and: [
      { $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }] },
      { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] }
    ]
  };
}

async function countTenantTasks(coll: Collection, tenantId: ObjectId): Promise<number> {
  return coll.countDocuments(tenantLevelFilter(tenantId));
}

async function countGlobalSystemTasks(coll: Collection): Promise<number> {
  return coll.countDocuments({
    $and: [
      { $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }] },
      { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] }
    ]
  });
}

function nonEmptyEnv(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function syncAdminDeliveryChannelsFromSeedSpec(input: {
  coll: Collection;
  tenantId: ObjectId;
  apply: boolean;
  plan: string[];
}): Promise<void> {
  const now = new Date();
  for (const def of SEEDED_ADMIN_DELIVERY_CHANNELS) {
    const slackWebhookUrl = nonEmptyEnv(def.slackWebhookEnv);
    const existing = await input.coll.findOne({
      tenantId: input.tenantId,
      name: def.name
    });

    if (!existing) {
      if (def.deliveryTarget === "slack" && !slackWebhookUrl) {
        input.plan.push(
          `SKIP admin_delivery_channels ${def.name} (missing ${def.slackWebhookEnv} for slack create)`
        );
        continue;
      }
      input.plan.push(`CREATE admin_delivery_channels ${def.name} target=${def.deliveryTarget}`);
      if (input.apply) {
        await input.coll.insertOne({
          tenantId: input.tenantId,
          name: def.name,
          deliveryTarget: def.deliveryTarget,
          ...(def.deliveryTarget === "slack" ? { slackWebhookUrl } : {}),
          createdAt: now,
          updatedAt: now
        });
      }
      continue;
    }

    const existingTarget = String(existing.deliveryTarget ?? "").trim();
    const targetDrift = existingTarget !== def.deliveryTarget;
    const existingWebhook = String(existing.slackWebhookUrl ?? "").trim();
    const webhookDrift =
      def.deliveryTarget === "slack" && Boolean(slackWebhookUrl) && existingWebhook !== slackWebhookUrl;
    if (!targetDrift && !webhookDrift) {
      input.plan.push(`OK admin_delivery_channels ${def.name}`);
      continue;
    }
    if (def.deliveryTarget === "slack" && targetDrift && !slackWebhookUrl) {
      input.plan.push(
        `SKIP UPDATE admin_delivery_channels ${def.name} (target->slack needs ${def.slackWebhookEnv})`
      );
      continue;
    }

    const updateLabel =
      def.deliveryTarget === "slack" && webhookDrift
        ? `UPDATE admin_delivery_channels ${def.name} target=${def.deliveryTarget} webhook=updated`
        : `UPDATE admin_delivery_channels ${def.name} target=${def.deliveryTarget}`;
    input.plan.push(updateLabel);
    if (input.apply) {
      const setDoc: Record<string, unknown> = {
        deliveryTarget: def.deliveryTarget,
        updatedAt: now
      };
      const unsetDoc: Record<string, "" | 1> = {};
      if (def.deliveryTarget === "slack") {
        if (slackWebhookUrl) {
          setDoc.slackWebhookUrl = slackWebhookUrl;
        }
        unsetDoc.emailTo = "";
      } else {
        unsetDoc.slackWebhookUrl = "";
        unsetDoc.emailTo = "";
      }
      await input.coll.updateOne(
        { _id: existing._id },
        { $set: setDoc, ...(Object.keys(unsetDoc).length > 0 ? { $unset: unsetDoc } : {}) }
      );
    }
  }
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
  const argv = process.argv.slice(2);
  const earlyEnv = extractEnvFilePath(argv);
  if (earlyEnv) {
    loadEnvFromFile(earlyEnv);
  }
  const cli = parseArgs(argv);
  if (cli.envFile && cli.envFile !== earlyEnv) {
    loadEnvFromFile(cli.envFile);
  }

  const uri = resolveMongoUri();
  const dbName = resolveSyncTargetMongoDatabaseName();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection(COLLECTION);
  const deliveryChannelsColl = db.collection(ADMIN_DELIVERY_CHANNELS_COLLECTION);

  const useGlobalTaskRows =
    !cli.tenantIdFromCli && !(process.env.SCHEDULED_TASKS_SYNC_TENANT_ID ?? "").trim();
  const channelTenantId = await resolveTenantId(db, cli.tenantId);
  const scopedTenantId = useGlobalTaskRows ? null : channelTenantId;

  console.log(
    `[sync-scheduled-tasks] db=${dbName} taskScope=${useGlobalTaskRows ? "all_tenants (no task.tenantId)" : `tenant=${channelTenantId.toHexString()}`} deliveryChannelTenant=${channelTenantId.toHexString()} mode=${cli.apply ? "apply" : "dry-run"}`
  );

  let nExisting = useGlobalTaskRows
    ? await countGlobalSystemTasks(coll)
    : await countTenantTasks(coll, channelTenantId);
  if (cli.seedIfEmpty && nExisting === 0) {
    if (!cli.apply) {
      console.log(
        "[sync-scheduled-tasks] --seed-if-empty: would run npm run seed:admin (no matching scheduled tasks yet); use --apply to execute."
      );
    } else {
      runSeedAdmin(cli.envFile);
      nExisting = useGlobalTaskRows
        ? await countGlobalSystemTasks(coll)
        : await countTenantTasks(coll, channelTenantId);
      console.log(`[sync-scheduled-tasks] after seed: task count=${nExisting}`);
    }
  }

  const now = new Date();
  const plan: string[] = [];
  await syncAdminDeliveryChannelsFromSeedSpec({
    coll: deliveryChannelsColl,
    tenantId: channelTenantId,
    apply: cli.apply,
    plan
  });

  for (const category of SCHEDULED_TASK_CATEGORIES) {
    if (SCHEDULED_TASK_CATEGORIES_EXCLUDED_FROM_SPEC_SYNC.has(category)) {
      plan.push(`SKIP ${category} (manual tenant tasks only — not auto-seeded)`);
      continue;
    }
    const scheduleCron = SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[category];
    const name = SCHEDULED_TASK_CATEGORY_DISPLAY_NAME[category];
    const scheduleDescription = describeCron(scheduleCron);
    const nextRunAt =
      computeNextRunAtFromCron(scheduleCron, now) ?? new Date(now.getTime() + 5 * 60 * 1000);

    const existing = await coll.findOne(
      useGlobalTaskRows ? globalSystemTaskFilter(category) : { ...tenantLevelFilter(channelTenantId), category }
    );

    if (!existing) {
      plan.push(
        `CREATE ${category} cron=${scheduleCron} name=${name} scope=${useGlobalTaskRows ? "system" : "tenant"}`
      );
      if (cli.apply) {
        await coll.insertOne({
          name,
          category,
          scheduleCron,
          scheduleDescription,
          enabled: true,
          nextRunAt,
          ...(useGlobalTaskRows ? {} : { tenantId: scopedTenantId! })
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

  const legacyFilter = useGlobalTaskRows
    ? { ...globalSystemTaskFilter("daily_options_scanner") }
    : { ...tenantLevelFilter(channelTenantId), category: "daily_options_scanner" };
  const legacyDailyOptions = await coll.countDocuments(legacyFilter);
  if (legacyDailyOptions > 0) {
    plan.push(
      `MIGRATE ${legacyDailyOptions} task(s): category daily_options_scanner -> options_scanner (removed alias)`
    );
    if (cli.apply) {
      await coll.updateMany(legacyFilter, { $set: { category: "options_scanner" } });
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
