import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/mongodb";
import type { OptionsActionReport, OptionsActionReportRow } from "@/modules/xchat/options-action-scan";

const OPTIONS_SCAN_REPORTS_COLLECTION = "options_scan_reports";
const OPTIONS_SCAN_SHARE_TTL_HOURS = 24;

export type OptionsScanReportScanData = {
  generatedAt: string;
  planTier: OptionsActionReport["planTier"];
  truncated: boolean;
  rows: OptionsActionReportRow[];
  disclaimer: string;
};

export type OptionsScanSharedReportDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  tenantId?: ObjectId;
  shareToken: string;
  scanData: OptionsScanReportScanData;
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
      const collection = db.collection<OptionsScanSharedReportDoc>(OPTIONS_SCAN_REPORTS_COLLECTION);
      await collection.createIndex({ shareToken: 1 }, { name: "idx_options_scan_reports_share_token", unique: true });
      await collection.createIndex({ userId: 1, createdAt: -1 }, { name: "idx_options_scan_reports_user_created" });
      await collection.createIndex({ tenantId: 1, createdAt: -1 }, { name: "idx_options_scan_reports_tenant_created" });
      await collection.createIndex(
        { expiresAt: 1 },
        { name: "ttl_options_scan_reports_expires_at", expireAfterSeconds: 0 }
      );
    })().catch((error) => {
      ensureIndexesPromise = null;
      throw error;
    });
  }
  await ensureIndexesPromise;
}

export async function createOptionsScanSharedReport(input: {
  userId: ObjectId;
  tenantId?: ObjectId;
  scanData: OptionsScanReportScanData;
}): Promise<{ shareToken: string; expiresAt: Date }> {
  await ensureIndexes();
  const db = await getDb();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + OPTIONS_SCAN_SHARE_TTL_HOURS * 60 * 60 * 1000);
  const shareToken = randomUUID();
  const doc: OptionsScanSharedReportDoc = {
    userId: input.userId,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    shareToken,
    scanData: input.scanData,
    createdAt,
    expiresAt,
    accessCount: 0
  };
  await db.collection<OptionsScanSharedReportDoc>(OPTIONS_SCAN_REPORTS_COLLECTION).insertOne(doc);
  return { shareToken, expiresAt };
}

export async function getOptionsScanSharedReportForPublicView(
  shareToken: string
): Promise<OptionsScanSharedReportDoc | null> {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<OptionsScanSharedReportDoc>(OPTIONS_SCAN_REPORTS_COLLECTION);
  const now = new Date();
  const result = await collection.findOneAndUpdate(
    { shareToken, expiresAt: { $gt: now } },
    { $inc: { accessCount: 1 }, $set: { lastAccessedAt: now } },
    { returnDocument: "after" }
  );
  return result ?? null;
}
