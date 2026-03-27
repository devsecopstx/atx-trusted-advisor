import { getDb } from "@/lib/mongodb";

const COLLECTION = "app_feature_daily_usage";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type FeatureDailyDoc = {
  key: string;
  feature: string;
  userId: string;
  tenantId?: string;
  bucketStart: Date;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      const coll = db.collection<FeatureDailyDoc>(COLLECTION);
      await coll.createIndex({ key: 1 }, { unique: true, name: "uniq_app_feature_daily_key" });
      await coll.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "ttl_app_feature_daily_expires" }
      );
    })();
  }
  await ensureIndexesPromise;
}

function bucketStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function buildKey(feature: string, userId: string, tenantId: string | undefined, start: Date): string {
  const t = tenantId?.trim() ? tenantId.trim() : "tenant:none";
  return `${feature}:${userId}:${t}:${start.toISOString()}`;
}

export type FeatureDailyUsageResult = {
  allowed: boolean;
  count: number;
  limit: number;
};

/**
 * Increments daily usage for a feature if under limit; otherwise does not increment.
 * Best-effort (non-atomic across read/write); good enough for deck view caps.
 */
export async function tryIncrementFeatureDailyUsage(input: {
  feature: string;
  userId: string;
  tenantId?: string;
  limit: number;
}): Promise<FeatureDailyUsageResult> {
  await ensureIndexes();
  const now = new Date();
  const start = bucketStartUtc(now);
  const key = buildKey(input.feature, input.userId, input.tenantId, start);
  const db = await getDb();
  const coll = db.collection<FeatureDailyDoc>(COLLECTION);

  const existing = await coll.findOne({ key });
  const current = existing?.count ?? 0;
  if (current >= input.limit) {
    return { allowed: false, count: current, limit: input.limit };
  }

  const expiresAt = new Date(start.getTime() + 35 * ONE_DAY_MS);
  await coll.updateOne(
    { key },
    {
      $setOnInsert: {
        key,
        feature: input.feature,
        userId: input.userId,
        tenantId: input.tenantId,
        bucketStart: start,
        expiresAt,
        createdAt: now
      },
      $set: { updatedAt: now },
      $inc: { count: 1 }
    },
    { upsert: true }
  );

  const next = current + 1;
  return {
    allowed: next <= input.limit,
    count: next,
    limit: input.limit
  };
}
