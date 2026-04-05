import { getDb } from "@/lib/mongodb";

const COLLECTION = "xchat_platform_settings" as const;
const SINGLETON_KEY = "default" as const;

export type XchatPlatformSettingsDoc = {
  singletonKey: typeof SINGLETON_KEY;
  /** Published xPersona ObjectId hex — default for app_user when no admin-assigned persona. */
  defaultAppUserPersonaId?: string;
  updatedAt: Date;
  updatedByUserId?: string;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      await db
        .collection(COLLECTION)
        .createIndex({ singletonKey: 1 }, { unique: true, name: "uniq_xchat_platform_singleton" });
    })();
  }
  await ensureIndexesPromise;
}

export async function getXchatPlatformSettings(): Promise<XchatPlatformSettingsDoc | null> {
  await ensureIndexes();
  const db = await getDb();
  return db.collection<XchatPlatformSettingsDoc>(COLLECTION).findOne({ singletonKey: SINGLETON_KEY });
}

export async function upsertXchatPlatformSettings(input: {
  defaultAppUserPersonaId: string | null | undefined;
  actorUserId: string;
}): Promise<XchatPlatformSettingsDoc> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const set: Partial<XchatPlatformSettingsDoc> = {
    updatedAt: now,
    updatedByUserId: input.actorUserId.trim() || undefined
  };
  if (input.defaultAppUserPersonaId === null || input.defaultAppUserPersonaId === undefined) {
    set.defaultAppUserPersonaId = undefined;
  } else {
    set.defaultAppUserPersonaId = input.defaultAppUserPersonaId.trim();
  }

  await db.collection<XchatPlatformSettingsDoc>(COLLECTION).updateOne(
    { singletonKey: SINGLETON_KEY },
    {
      $set: set,
      $setOnInsert: { singletonKey: SINGLETON_KEY }
    },
    { upsert: true }
  );

  const next = await getXchatPlatformSettings();
  if (!next) {
    throw new Error("xchat_platform_settings upsert failed");
  }
  return next;
}

export function isXchatUserHistoryXaiCollectionEnabled(): boolean {
  return false;
}

/**
 * When enabled, xChat ask uses xAI hosted conversation state (`store_messages` + `previous_response_id`)
 * for turn-to-turn continuity instead of injecting prior Mongo turns into prompts.
 */
export function isXchatRemoteHistoryEnabled(): boolean {
  return false;
}
