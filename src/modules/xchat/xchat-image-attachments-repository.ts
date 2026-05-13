import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { isVisionVirusScanEnabled } from "@/lib/env";

export const XCHAT_IMAGE_ATTACHMENTS_COLLECTION = "xchat_image_attachments";

export type XchatImageAttachmentDoc = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: ObjectId;
  threadId: string;
  correlationId: string;
  requestId: string;
  mediaType: string;
  caption: string;
  originalSha256Hex: string;
  processedSha256Hex: string;
  width: number;
  height: number;
  virusScanned: boolean;
  createdAt: Date;
};

export async function insertXchatImageAttachmentRows(input: {
  tenantId: ObjectId | null | undefined;
  userId: ObjectId;
  threadId: string;
  correlationId: string;
  requestId: string;
  items: Array<{
    mediaType: string;
    caption: string;
    originalSha256Hex: string;
    processedSha256Hex: string;
    width: number;
    height: number;
  }>;
}): Promise<void> {
  if (input.items.length === 0) {
    return;
  }
  const db = await getDb();
  const virusScanned = isVisionVirusScanEnabled();
  const now = new Date();
  const docs: XchatImageAttachmentDoc[] = input.items.map((row) => ({
    tenantId: input.tenantId ?? undefined,
    userId: input.userId,
    threadId: input.threadId,
    correlationId: input.correlationId,
    requestId: input.requestId,
    mediaType: row.mediaType,
    caption: row.caption,
    originalSha256Hex: row.originalSha256Hex,
    processedSha256Hex: row.processedSha256Hex,
    width: row.width,
    height: row.height,
    virusScanned,
    createdAt: now
  }));
  await db.collection<XchatImageAttachmentDoc>(XCHAT_IMAGE_ATTACHMENTS_COLLECTION).insertMany(docs);
}
