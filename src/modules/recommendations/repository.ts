import { type Filter, ObjectId } from "mongodb";

import {
    mongoAppUserRecommendationsScope,
    mongoUserIdQuery,
    parseTenantObjectId
} from "@/lib/mongo-tenant-scope";
import { getDb } from "@/lib/mongodb";
import type { Recommendation, RecommendationSource, RecommendationStatus } from "@/modules/recommendations/types";

export const RECOMMENDATIONS_COLLECTION = "app_user_recommendations";

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureRecommendationIndexes(): Promise<void> {
  if (ensureIndexesPromise) {
    return ensureIndexesPromise;
  }
  ensureIndexesPromise = (async () => {
    const db = await getDb();
    const col = db.collection(RECOMMENDATIONS_COLLECTION);
    await col.createIndex({ userId: 1, tenantId: 1, createdAt: -1 });
    await col.createIndex({ tenantId: 1, updatedAt: -1 });
  })();
  return ensureIndexesPromise;
}

export type CreateRecommendationInput = {
  tenantId?: string;
  userId: string;
  title: string;
  summary?: string;
  scopeTags?: string[];
  payload?: Record<string, unknown>;
  status?: RecommendationStatus;
  source?: RecommendationSource;
};

export async function createRecommendation(
  input: CreateRecommendationInput
): Promise<Recommendation> {
  await ensureRecommendationIndexes();
  const db = await getDb();
  const now = new Date();
  const tenantObjectId = parseTenantObjectId(input.tenantId);
  const scopeTags = (input.scopeTags ?? [])
    .map((t) => t.trim().slice(0, 128))
    .filter(Boolean)
    .slice(0, 32);
  const document: Recommendation = {
    tenantId: tenantObjectId,
    userId: input.userId,
    title: input.title.trim().slice(0, 500),
    ...(input.summary !== undefined
      ? { summary: input.summary.trim().slice(0, 4000) }
      : {}),
    scopeTags,
    payload:
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? input.payload
        : {},
    status: input.status ?? "active",
    source: input.source ?? "user",
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection<Recommendation>(RECOMMENDATIONS_COLLECTION).insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function listRecommendationsForUser(options: {
  userId: string;
  tenantId?: string;
  limit?: number;
}): Promise<Recommendation[]> {
  await ensureRecommendationIndexes();
  const db = await getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const filter = mongoAppUserRecommendationsScope(
    {
      ...mongoUserIdQuery(options.userId)
    },
    options.tenantId
  ) as Filter<Recommendation>;

  return db
    .collection<Recommendation>(RECOMMENDATIONS_COLLECTION)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getRecommendationForUser(options: {
  id: string;
  userId: string;
  tenantId?: string;
}): Promise<Recommendation | null> {
  if (!ObjectId.isValid(options.id)) {
    return null;
  }
  await ensureRecommendationIndexes();
  const db = await getDb();
  const filter = mongoAppUserRecommendationsScope(
    {
      _id: new ObjectId(options.id),
      ...mongoUserIdQuery(options.userId)
    },
    options.tenantId
  ) as Filter<Recommendation>;

  return db.collection<Recommendation>(RECOMMENDATIONS_COLLECTION).findOne(filter);
}
