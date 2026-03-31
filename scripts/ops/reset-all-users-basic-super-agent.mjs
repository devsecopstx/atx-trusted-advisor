#!/usr/bin/env node
/**
 * One-off: set every `core_users.subscriptionPlan` to **basic**, every
 * `admin_user_settings.assignedPersonaId` to **Super-Agent**, and **platform** xChat default
 * (`xchat_platform_settings.defaultAppUserPersonaId` — Admin → Tenant preferences → Default xChat persona).
 *
 * Prerequisites:
 * - Super-Agent exists in `xchat_personas` (`nameNormalized: super-agent`).
 * - `status` must be **published**, **or** omitted (legacy `seed:admin` never set `status`); omitted rows
 *   are upgraded to **published** on `--apply` unless `--no-fix-persona-status`.
 * - Explicit **draft** / **archived** still blocks (publish in Admin → Personas first).
 *
 * Usage:
 *   node scripts/ops/reset-all-users-basic-super-agent.mjs --file=.env.prod --apply
 *   node --env-file=.env.prod scripts/ops/reset-all-users-basic-super-agent.mjs --apply
 *
 * Without `--apply`, prints the plan and exits without writing.
 *
 * @see `.cursor/agents/sre.md` § *Bulk reset users — Basic plan + Super-Agent*
 */

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "node:fs";

import { resolveMongoUri, resolveSeedDbName } from "../lib/resolve-mongo-uri.mjs";

const SUPER_AGENT_NORMALIZED = "super-agent";
const TARGET_PLAN = "basic";

const COLLECTIONS = {
  users: "core_users",
  personas: "xchat_personas",
  userSettings: "admin_user_settings",
  /** @see `src/modules/xchat/xchat-platform-settings.ts` */
  xchatPlatformSettings: "xchat_platform_settings"
};

const PLATFORM_SETTINGS_SINGLETON_KEY = "default";
/** Actor id for `updatedByUserId` (no interactive admin session in CLI). */
const OPS_SCRIPT_ACTOR_USER_ID = "ops-reset-basic-super-agent";

const DEFAULT_ADMIN_SETTINGS_BODY = {
  broker: { provider: "paper", accountRef: "paper-main", enabled: true },
  portfolio: {
    riskProfile: "balanced",
    investmentStrategy: "balanced",
    baseCurrency: "USD",
    rebalanceFrequencyDays: 14
  },
  account: { accountStatus: "active", maxConcurrentSessions: 2, timezone: "America/New_York" },
  notificationDefaults: { email: true, push: true, sms: false, digestHourUTC: 13 }
};

function loadEnvFromFile(filePath) {
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

function rawPersonaStatus(persona) {
  const s = persona.status;
  if (s === undefined || s === null || s === "") {
    return null;
  }
  return String(s);
}

function parseArgs(argv) {
  let envFile = null;
  let apply = false;
  let noFixPersonaStatus = false;
  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--no-fix-persona-status") {
      noFixPersonaStatus = true;
      continue;
    }
    const fileMatch = arg.match(/^--file=(.+)$/) || arg.match(/^-file=(.+)$/);
    if (fileMatch) {
      envFile = fileMatch[1].trim();
      continue;
    }
    const envFileMatch = arg.match(/^--env-file=(.+)$/);
    if (envFileMatch) {
      envFile = envFileMatch[1].trim();
    }
  }
  return { envFile, apply, noFixPersonaStatus };
}

async function main() {
  const { envFile, apply, noFixPersonaStatus } = parseArgs(process.argv.slice(2));
  if (envFile) {
    loadEnvFromFile(envFile);
    console.error(`[reset-users] Loaded env from ${envFile}`);
  }

  const uri = resolveMongoUri();
  const dbName = resolveSeedDbName();
  console.error(`[reset-users] DB: ${dbName}`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const persona = await db.collection(COLLECTIONS.personas).findOne({
      nameNormalized: SUPER_AGENT_NORMALIZED
    });
    if (!persona?._id) {
      throw new Error(
        `Super-Agent persona not found (nameNormalized "${SUPER_AGENT_NORMALIZED}"). Run seed:xpersonas or sync personas first.`
      );
    }
    const statusRaw = rawPersonaStatus(persona);
    const legacyMissingStatus = statusRaw === null;
    if (statusRaw !== null && statusRaw !== "published") {
      throw new Error(
        `Super-Agent exists but status is "${statusRaw}", not "published". Publish in Admin → Personas before running this script.`
      );
    }
    if (legacyMissingStatus) {
      console.error(
        "[reset-users] Super-Agent has no `status` field (legacy seed). API treats that as draft for app users; on `--apply` we set status=published unless `--no-fix-persona-status`."
      );
    }

    const personaIdHex = persona._id instanceof ObjectId ? persona._id.toHexString() : String(persona._id);
    const userCount = await db.collection(COLLECTIONS.users).countDocuments({});
    const settingsCount = await db.collection(COLLECTIONS.userSettings).countDocuments({});
    const platformDoc = await db.collection(COLLECTIONS.xchatPlatformSettings).findOne({
      singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY
    });

    const plan = {
      ok: true,
      dryRun: !apply,
      database: dbName,
      superAgentPersonaId: personaIdHex,
      superAgentName: persona.name ?? "Super-Agent",
      superAgentStatusInDb: statusRaw ?? "(missing — legacy seed)",
      legacyPersonaStatusMissing: legacyMissingStatus,
      onApplyWillSetPersonaPublished:
        apply && legacyMissingStatus && !noFixPersonaStatus,
      coreUsersToTouch: userCount,
      adminUserSettingsRows: settingsCount,
      updates: {
        core_users: { subscriptionPlan: TARGET_PLAN },
        admin_user_settings: { assignedPersonaId: personaIdHex },
        xchat_platform_settings: {
          singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY,
          defaultAppUserPersonaId: personaIdHex,
          previousDefaultAppUserPersonaId: platformDoc?.defaultAppUserPersonaId ?? null
        }
      }
    };

    console.log(JSON.stringify(plan, null, 2));

    if (!apply) {
      console.error(
        "[reset-users] Dry run only. Re-run with `--apply` after review (and use a targeted `--file=` / `--env-file=` for the right Mongo)."
      );
      await client.close();
      process.exit(0);
    }

    const now = new Date();

    if (legacyMissingStatus && !noFixPersonaStatus) {
      const nextVersion = (persona.version ?? 0) + 1;
      const personaColl = db.collection(COLLECTIONS.personas);
      const fixRes = await personaColl.updateOne(
        { _id: persona._id },
        {
          $set: {
            status: "published",
            publishedAt: now,
            updatedAt: now,
            version: nextVersion
          }
        }
      );
      console.error(
        `[reset-users] Super-Agent persona updated: status=published (matched ${fixRes.matchedCount}, modified ${fixRes.modifiedCount}).`
      );
    } else if (legacyMissingStatus && noFixPersonaStatus) {
      console.error(
        "[reset-users] WARN: `--no-fix-persona-status` — persona row still has no status; app_user xChat may reject this persona until published."
      );
    }

    const platformColl = db.collection(COLLECTIONS.xchatPlatformSettings);
    const platformRes = await platformColl.updateOne(
      { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY },
      {
        $set: {
          defaultAppUserPersonaId: personaIdHex,
          updatedAt: now,
          updatedByUserId: OPS_SCRIPT_ACTOR_USER_ID
        },
        $setOnInsert: { singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY }
      },
      { upsert: true }
    );
    console.error(
      `[reset-users] xchat_platform_settings (Admin → default xChat persona): defaultAppUserPersonaId=${personaIdHex} matched=${platformRes.matchedCount} modified=${platformRes.modifiedCount} upserted=${platformRes.upsertedCount ?? 0}`
    );

    const usersResult = await db.collection(COLLECTIONS.users).updateMany(
      {},
      { $set: { subscriptionPlan: TARGET_PLAN, updatedAt: now } }
    );

    const settingsResult = await db.collection(COLLECTIONS.userSettings).updateMany(
      {},
      { $set: { assignedPersonaId: personaIdHex, updatedAt: now } }
    );

    const users = await db
      .collection(COLLECTIONS.users)
      .find({}, { projection: { _id: 1 } })
      .toArray();

    let inserted = 0;
    for (const u of users) {
      const uid = String(u._id);
      const existing = await db.collection(COLLECTIONS.userSettings).findOne({
        $or: [{ userId: uid }, { userId: u._id }]
      });
      if (existing) {
        continue;
      }
      const membership = await db.collection("core_tenant_memberships").findOne({ userId: u._id });
      const tenantId = membership?.tenantId;
      if (!tenantId) {
        console.error(`[reset-users] skip admin_user_settings for user ${uid}: no tenant membership`);
        continue;
      }
      await db.collection(COLLECTIONS.userSettings).insertOne({
        userId: uid,
        tenantId,
        assignedPersonaId: personaIdHex,
        ...DEFAULT_ADMIN_SETTINGS_BODY,
        updatedAt: now,
        createdAt: now
      });
      inserted += 1;
    }

    const summary = {
      ok: true,
      xchat_platform_settings: {
        defaultAppUserPersonaId: personaIdHex,
        matched: platformRes.matchedCount,
        modified: platformRes.modifiedCount,
        upsertedCount: platformRes.upsertedCount ?? 0
      },
      core_users: {
        matched: usersResult.matchedCount,
        modified: usersResult.modifiedCount
      },
      admin_user_settings: {
        matched: settingsResult.matchedCount,
        modified: settingsResult.modifiedCount
      },
      admin_user_settings_inserted_for_users_without_row: inserted
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("[reset-users] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
