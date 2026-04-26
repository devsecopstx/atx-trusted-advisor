import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/mongodb";

import type { WheelGeneratedPayload, WheelPersistedReport } from "./wheel-types";

const WHEEL_REPORTS_COLLECTION = "user_wheel_reports";
const WHEEL_SHARED_REPORTS_COLLECTION = "wheel_shared_reports";
const SHARE_TTL_HOURS = 24;

type WheelReportDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  userDisplayName: string;
  tenantId?: ObjectId;
  payload: WheelGeneratedPayload;
  createdAt: Date;
};

type WheelSharedReportDoc = {
  _id?: ObjectId;
  shareToken: string;
  reportPayload: WheelGeneratedPayload;
  generatedByUserId: ObjectId;
  generatedByName: string;
  tenantId?: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessedAt?: Date;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      const reports = db.collection<WheelReportDoc>(WHEEL_REPORTS_COLLECTION);
      await reports.createIndex({ userId: 1, createdAt: -1 }, { name: "idx_user_wheel_reports_user_created" });
      await reports.createIndex({ tenantId: 1, createdAt: -1 }, { name: "idx_user_wheel_reports_tenant_created" });

      const shared = db.collection<WheelSharedReportDoc>(WHEEL_SHARED_REPORTS_COLLECTION);
      await shared.createIndex(
        { shareToken: 1 },
        { name: "idx_wheel_shared_reports_share_token", unique: true }
      );
      await shared.createIndex({ expiresAt: 1 }, { name: "ttl_wheel_shared_reports_expires_at", expireAfterSeconds: 0 });
      await shared.createIndex({ generatedByUserId: 1, createdAt: -1 }, { name: "idx_wheel_shared_reports_user_created" });
    })().catch((error) => {
      ensureIndexesPromise = null;
      throw error;
    });
  }
  await ensureIndexesPromise;
}

export async function createWheelReport(input: {
  userId: ObjectId;
  userDisplayName: string;
  tenantId?: ObjectId;
  payload: WheelGeneratedPayload;
}): Promise<WheelPersistedReport> {
  await ensureIndexes();
  const db = await getDb();
  const createdAt = new Date();
  const doc: WheelReportDoc = {
    userId: input.userId,
    userDisplayName: input.userDisplayName,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    payload: input.payload,
    createdAt
  };
  const result = await db.collection<WheelReportDoc>(WHEEL_REPORTS_COLLECTION).insertOne(doc);
  return {
    reportId: result.insertedId.toHexString(),
    generatedByUserId: input.userId.toHexString(),
    generatedByName: input.userDisplayName,
    ...(input.tenantId ? { tenantId: input.tenantId.toHexString() } : {}),
    payload: input.payload,
    createdAtIso: createdAt.toISOString()
  };
}

export async function createWheelSharedReport(input: {
  reportPayload: WheelGeneratedPayload;
  generatedByUserId: ObjectId;
  generatedByName: string;
  tenantId?: ObjectId;
}): Promise<{ shareToken: string; expiresAt: Date }> {
  await ensureIndexes();
  const db = await getDb();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SHARE_TTL_HOURS * 60 * 60 * 1000);
  const shareToken = randomUUID();
  const doc: WheelSharedReportDoc = {
    shareToken,
    reportPayload: input.reportPayload,
    generatedByUserId: input.generatedByUserId,
    generatedByName: input.generatedByName,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    createdAt,
    expiresAt,
    accessCount: 0
  };
  await db.collection<WheelSharedReportDoc>(WHEEL_SHARED_REPORTS_COLLECTION).insertOne(doc);
  return { shareToken, expiresAt };
}

export async function getWheelSharedReportByToken(
  shareToken: string
): Promise<WheelSharedReportDoc | null> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const updated = await db
    .collection<WheelSharedReportDoc>(WHEEL_SHARED_REPORTS_COLLECTION)
    .findOneAndUpdate(
      {
        shareToken,
        expiresAt: { $gt: now }
      },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: now }
      },
      { returnDocument: "after" }
    );
  return updated ?? null;
}
