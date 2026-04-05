import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

const COLLECTION = "xchat_user_preferences" as const;

export type XchatUserPreferences = {
  _id?: ObjectId;
  userId: ObjectId;
  tenantId?: ObjectId;
  keepLastTenMessages: boolean;
  consentedAt?: Date;
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
  }
  return db
    .collection<XchatUserPreferences>(COLLECTION)
    .find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(1)
    .next();
}

export async function upsertXchatUserPreferences(input: {
  userId: ObjectId;
  tenantId?: ObjectId | null;
  keepLastTenMessages: boolean;
}): Promise<XchatUserPreferences> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const query: Record<string, unknown> = { userId: input.userId };
  if (input.tenantId) {
    query.tenantId = input.tenantId;
  } else {
    query.tenantId = { $exists: false };
  }
  const setFields: Record<string, unknown> = {
    userId: input.userId,
    keepLastTenMessages: input.keepLastTenMessages,
    updatedAt: now
  };
  if (input.tenantId) {
    setFields.tenantId = input.tenantId;
  }
  if (input.keepLastTenMessages) {
    setFields.consentedAt = now;
  }
  await db.collection<XchatUserPreferences>(COLLECTION).updateOne(
    query,
    {
      $set: setFields,
      ...(input.keepLastTenMessages ? { $setOnInsert: { consentedAt: now } } : {})
    },
    { upsert: true }
  );

  const updated = await db.collection<XchatUserPreferences>(COLLECTION).findOne(query);
  if (!updated) {
    throw new Error("Failed to upsert xChat user preferences");
  }
  return updated;
}
