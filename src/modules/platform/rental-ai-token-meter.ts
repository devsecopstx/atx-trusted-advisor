import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

const COLLECTION = "rental_ai_token_usage";
const XCHAT_USAGE_COLLECTION = "xchat_usage_limits";

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
  const roundedTokens = Math.floor(tokens);
  const dayUtc = utcDayKey();
  await db.collection(COLLECTION).updateOne(
    { tenantId, dayUtc },
    {
      $inc: { tokensUsed: roundedTokens },
      $setOnInsert: { tenantId, dayUtc, createdAt: new Date() },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
  await db.collection(XCHAT_USAGE_COLLECTION).updateOne(
    { key: `rental_tokens_day:${tenantId.toHexString()}:${dayUtc}` },
    {
      $setOnInsert: {
        key: `rental_tokens_day:${tenantId.toHexString()}:${dayUtc}`,
        kind: "rental_tokens_day",
        tenantId: tenantId.toHexString(),
        dayUtc,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)
      },
      $inc: { rentalTokensUsed: roundedTokens },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}
