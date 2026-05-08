import { MongoServerError, ObjectId, type UpdateFilter } from "mongodb";

import { getDb } from "@/lib/mongodb";

const COLLECTION = "xchat_user_preferences" as const;

export type XchatUserPreferences = {
  _id?: ObjectId;
  userId: ObjectId;
  tenantId?: ObjectId;
  keepLastTenMessages: boolean;
  /** Requires `keepLastTenMessages`; drives xAI `user_history` collection + `user-history` agent sync. */
  enableLongTermXaiMemory?: boolean;
  consentedAt?: Date;
  xaiMemoryConsentedAt?: Date;
  updatedAt: Date;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      await db.collection<XchatUserPreferences>(COLLECTION).createIndex(
        { userId: 1, tenantId: 1 },
        { unique: true, name: "uniq_xchat_user_preferences_user_tenant" }
      );
      await db
        .collection<XchatUserPreferences>(COLLECTION)
        .createIndex({ updatedAt: -1 }, { name: "idx_xchat_user_preferences_updated_desc" });
    })();
  }
  await ensureIndexesPromise;
}

export async function getXchatUserPreferences(input: {
  userId: ObjectId;
  tenantId?: ObjectId | null;
}): Promise<XchatUserPreferences | null> {
  await ensureIndexes();
  const db = await getDb();
  const query: Record<string, unknown> = { userId: input.userId };
  if (input.tenantId) {
    query.$or = [{ tenantId: input.tenantId }, { tenantId: { $exists: false } }];
  } else {
    query.$or = [{ tenantId: null }, { tenantId: { $exists: false } }];
  }
  return db
    .collection<XchatUserPreferences>(COLLECTION)
    .find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(1)
    .next();
}

/** Opt-in xAI `user_history` uploads + agent sync; never true without Mongo history retention. */
export async function userHasLongTermXaiMemoryEnabled(input: {
  userId: ObjectId;
  tenantId?: ObjectId | null;
}): Promise<boolean> {
  const prefs = await getXchatUserPreferences(input);
  return prefs?.keepLastTenMessages === true && prefs?.enableLongTermXaiMemory === true;
}

export async function upsertXchatUserPreferences(input: {
  userId: ObjectId;
  tenantId?: ObjectId | null;
  keepLastTenMessages: boolean;
  enableLongTermXaiMemory?: boolean;
}): Promise<XchatUserPreferences> {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<XchatUserPreferences>(COLLECTION);
  const existing = await getXchatUserPreferences({ userId: input.userId, tenantId: input.tenantId });
  let enableLongTerm =
    input.enableLongTermXaiMemory !== undefined
      ? input.enableLongTermXaiMemory
      : Boolean(existing?.enableLongTermXaiMemory);
  if (!input.keepLastTenMessages) {
    enableLongTerm = false;
  }

  const now = new Date();
  const setFields: Record<string, unknown> = {
    userId: input.userId,
    keepLastTenMessages: input.keepLastTenMessages,
    enableLongTermXaiMemory: enableLongTerm,
    updatedAt: now
  };
  if (input.tenantId) {
    setFields.tenantId = input.tenantId;
  }
  if (input.keepLastTenMessages) {
    setFields.consentedAt = now;
  }
  if (enableLongTerm) {
    setFields.xaiMemoryConsentedAt =
      existing?.enableLongTermXaiMemory === true && existing.xaiMemoryConsentedAt
        ? existing.xaiMemoryConsentedAt
        : now;
  }

  const updateModifiers: UpdateFilter<XchatUserPreferences> = { $set: setFields as never };
  if (!enableLongTerm) {
    updateModifiers.$unset = { xaiMemoryConsentedAt: "" };
  }

  if (input.tenantId) {
    const query: Record<string, unknown> = { userId: input.userId, tenantId: input.tenantId };
    await collection.updateOne(query, updateModifiers, { upsert: true });
    const updated = await collection.findOne(query);
    if (!updated) {
      throw new Error("Failed to upsert xChat user preferences");
    }
    return updated;
  }

  const noTenantQuery: Record<string, unknown> = {
    userId: input.userId,
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }]
  };
  const existingRow = await collection.find(noTenantQuery).sort({ updatedAt: -1, _id: -1 }).limit(1).next();

  if (existingRow?._id) {
    await collection.updateOne({ _id: existingRow._id }, updateModifiers);
  } else {
    const insertDoc: XchatUserPreferences = {
      userId: input.userId,
      keepLastTenMessages: input.keepLastTenMessages,
      enableLongTermXaiMemory: enableLongTerm,
      updatedAt: now,
      ...(input.keepLastTenMessages ? { consentedAt: now } : {}),
      ...(enableLongTerm ? { xaiMemoryConsentedAt: now } : {})
    };
    try {
      await collection.insertOne(insertDoc);
    } catch (error) {
      // Concurrent first-write race: another request inserted the same user/no-tenant row.
      if (!(error instanceof MongoServerError) || error.code !== 11000) {
        throw error;
      }
      const raceWinner = await collection.find(noTenantQuery).sort({ updatedAt: -1, _id: -1 }).limit(1).next();
      if (!raceWinner?._id) {
        throw error;
      }
      await collection.updateOne({ _id: raceWinner._id }, updateModifiers);
    }
  }

  const updated = await collection.find(noTenantQuery).sort({ updatedAt: -1, _id: -1 }).limit(1).next();
  if (!updated) {
    throw new Error("Failed to upsert xChat user preferences");
  }
  return updated;
}
