import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

import { IBKR_CONSENT_VERSION } from "@/modules/ibkr-integration/constants";

export const IBKR_USER_CONSENTS_COLLECTION = "ibkr_user_consents";

export type IbkrUserConsentDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  tenantId: ObjectId;
  consentVersion: number;
  /** Null when user withdrew consent */
  consentedAt: Date | null;
  updatedAt: Date;
};

let ensureIndexesPromise: Promise<void> | null = null;

export async function ensureIbkrConsentIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      await db.collection(IBKR_USER_CONSENTS_COLLECTION).createIndex(
        { userId: 1, tenantId: 1 },
        { unique: true, name: "uniq_ibkr_consent_user_tenant" }
      );
    })();
  }
  await ensureIndexesPromise;
}

export async function getIbkrConsent(
  userIdHex: string,
  tenantIdHex: string
): Promise<IbkrUserConsentDoc | null> {
  if (!ObjectId.isValid(userIdHex) || !ObjectId.isValid(tenantIdHex)) {
    return null;
  }
  const db = await getDb();
  return db.collection<IbkrUserConsentDoc>(IBKR_USER_CONSENTS_COLLECTION).findOne({
    userId: new ObjectId(userIdHex),
    tenantId: new ObjectId(tenantIdHex)
  });
}

export async function upsertIbkrConsent(input: {
  userIdHex: string;
  tenantIdHex: string;
  accepted: boolean;
}): Promise<IbkrUserConsentDoc | null> {
  if (!ObjectId.isValid(input.userIdHex) || !ObjectId.isValid(input.tenantIdHex)) {
    return null;
  }
  await ensureIbkrConsentIndexes();
  const now = new Date();
  const userId = new ObjectId(input.userIdHex);
  const tenantId = new ObjectId(input.tenantIdHex);
  const db = await getDb();
  await db.collection<IbkrUserConsentDoc>(IBKR_USER_CONSENTS_COLLECTION).updateOne(
    { userId, tenantId },
    {
      $set: {
        consentVersion: IBKR_CONSENT_VERSION,
        consentedAt: input.accepted ? now : null,
        updatedAt: now
      },
      $setOnInsert: {
        userId,
        tenantId
      }
    },
    { upsert: true }
  );
  return getIbkrConsent(input.userIdHex, input.tenantIdHex);
}
