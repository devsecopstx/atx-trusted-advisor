import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import type { OptionsActionReportRow } from "@/modules/xchat/options-action-scan";

const OPTIONS_ACTION_REPORT_COLLECTION = "user_options_scan_reports";
const REPORT_RETENTION_DAYS = 90;

export type UserOptionsScanReport = {
  _id?: ObjectId;
  userId: ObjectId;
  tenantId?: ObjectId;
  source: "on_demand" | "scheduled";
  frequency: "weekly" | "monthly" | "off";
  deliveryChannel: "inapp" | "email";
  rows: OptionsActionReportRow[];
  truncated: boolean;
  reportMarkdown: string;
  createdAt: Date;
  retentionExpiresAt: Date;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      const collection = db.collection<UserOptionsScanReport>(OPTIONS_ACTION_REPORT_COLLECTION);
      await collection.createIndex(
        { userId: 1, createdAt: -1, _id: -1 },
        { name: "idx_options_scan_reports_user_created_desc" }
      );
      await collection.createIndex(
        { tenantId: 1, createdAt: -1 },
        { name: "idx_options_scan_reports_tenant_created_desc" }
      );
      await collection.createIndex(
        { retentionExpiresAt: 1 },
        { name: "ttl_options_scan_reports_retention", expireAfterSeconds: 0 }
      );
    })().catch((error) => {
      ensureIndexesPromise = null;
      throw error;
    });
  }
  await ensureIndexesPromise;
}

export async function createOptionsScanReport(input: {
  userId: ObjectId;
  tenantId?: ObjectId;
  source: UserOptionsScanReport["source"];
  frequency: UserOptionsScanReport["frequency"];
  deliveryChannel: UserOptionsScanReport["deliveryChannel"];
  rows: OptionsActionReportRow[];
  truncated: boolean;
  reportMarkdown: string;
}): Promise<ObjectId> {
  await ensureIndexes();
  const db = await getDb();
  const createdAt = new Date();
  const retentionExpiresAt = new Date(
    createdAt.getTime() + REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const doc: UserOptionsScanReport = {
    userId: input.userId,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    source: input.source,
    frequency: input.frequency,
    deliveryChannel: input.deliveryChannel,
    rows: input.rows,
    truncated: input.truncated,
    reportMarkdown: input.reportMarkdown,
    createdAt,
    retentionExpiresAt
  };
  const result = await db.collection<UserOptionsScanReport>(OPTIONS_ACTION_REPORT_COLLECTION).insertOne(doc);
  return result.insertedId;
}
