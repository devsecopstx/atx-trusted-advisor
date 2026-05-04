import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

const COLLECTION = "rental_ai_token_usage";

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function getRentalAiTokensUsedToday(tenantId: ObjectId): Promise<number> {
  const db = await getDb();
  const row = await db.collection<{ tokensUsed: number }>(COLLECTION).findOne({
    tenantId,
    dayUtc: utcDayKey()
  });
  return typeof row?.tokensUsed === "number" && Number.isFinite(row.tokensUsed) ? row.tokensUsed : 0;
}

export async function incrementRentalAiTokensUsed(tenantId: ObjectId, tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return;
  }
  const db = await getDb();
  const dayUtc = utcDayKey();
  await db.collection(COLLECTION).updateOne(
    { tenantId, dayUtc },
    {
      $inc: { tokensUsed: Math.floor(tokens) },
      $setOnInsert: { tenantId, dayUtc, createdAt: new Date() },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}
