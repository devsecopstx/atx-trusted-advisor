import { ObjectId } from "mongodb";

import { mongoPortfolioFamilyUserScope } from "@/lib/mongo-tenant-scope";
import { getDb } from "@/lib/mongodb";
import type { PortfolioPriceAlertDoc, PortfolioPriceAlertStatus } from "@/modules/price-alerts/portfolio-price-alert-types";

const COLLECTION = "portfolio_price_alerts";

let ensureIndexesPromise: Promise<void> | null = null;

async function ensurePortfolioPriceAlertIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      const c = db.collection(COLLECTION);
      await c.createIndex(
        { tenantId: 1, userId: 1, symbolNorm: 1 },
        {
          unique: true,
          partialFilterExpression: { status: "active" },
          name: "uniq_active_user_symbol"
        }
      );
      await c.createIndex({ tenantId: 1, status: 1, expiresAt: 1 }, { name: "tenant_status_expires" });
      await c.createIndex({ tenantId: 1, symbolNorm: 1, status: 1 }, { name: "tenant_symbol_active" });
    })().catch((err: unknown) => {
      ensureIndexesPromise = null;
      throw err;
    });
  }
  await ensureIndexesPromise;
}

function normUserId(userId: string): string {
  return userId.trim();
}

function normSymbol(sym: string): string {
  return sym.trim().toUpperCase().slice(0, 32);
}

function userActiveFilter(userId: string, tenantId?: string): Record<string, unknown> {
  return {
    ...mongoPortfolioFamilyUserScope(normUserId(userId), tenantId, "allowLegacyUserScope"),
    status: "active"
  };
}

export async function countActivePortfolioPriceAlertsForTenant(tenantIdHex: string | undefined): Promise<number> {
  await ensurePortfolioPriceAlertIndexes();
  if (!tenantIdHex || !ObjectId.isValid(tenantIdHex)) {
    return 0;
  }
  const db = await getDb();
  return db.collection(COLLECTION).countDocuments({
    tenantId: new ObjectId(tenantIdHex),
    status: "active"
  });
}

export async function countActivePortfolioPriceAlertsForUser(input: {
  userId: string;
  tenantId?: string;
}): Promise<number> {
  await ensurePortfolioPriceAlertIndexes();
  const db = await getDb();
  return db.collection(COLLECTION).countDocuments(userActiveFilter(input.userId, input.tenantId));
}

export async function listActivePortfolioPriceAlertsForUser(input: {
  userId: string;
  tenantId?: string;
}): Promise<PortfolioPriceAlertDoc[]> {
  await ensurePortfolioPriceAlertIndexes();
  const db = await getDb();
  const rows = await db
    .collection(COLLECTION)
    .find(userActiveFilter(input.userId, input.tenantId))
    .sort({ symbolNorm: 1 })
    .limit(200)
    .toArray();
  return rows as PortfolioPriceAlertDoc[];
}

export async function listActivePortfolioPriceAlertsForTenantBySymbols(input: {
  tenantIdHex: string;
  symbolNormsUpper: string[];
}): Promise<PortfolioPriceAlertDoc[]> {
  await ensurePortfolioPriceAlertIndexes();
  if (!ObjectId.isValid(input.tenantIdHex)) {
    return [];
  }
  const syms = [...new Set(input.symbolNormsUpper.map((s) => normSymbol(s)).filter(Boolean))];
  if (syms.length === 0) {
    return [];
  }
  const db = await getDb();
  const rows = await db
    .collection(COLLECTION)
    .find({
      tenantId: new ObjectId(input.tenantIdHex),
      status: "active",
      symbolNorm: { $in: syms }
    })
    .limit(5000)
    .toArray();
  return rows as PortfolioPriceAlertDoc[];
}

export async function listAllActivePortfolioPriceAlertsForTenant(tenantIdHex: string): Promise<PortfolioPriceAlertDoc[]> {
  await ensurePortfolioPriceAlertIndexes();
  if (!ObjectId.isValid(tenantIdHex)) {
    return [];
  }
  const db = await getDb();
  const rows = await db
    .collection(COLLECTION)
    .find({
      tenantId: new ObjectId(tenantIdHex),
      status: "active"
    })
    .limit(20_000)
    .toArray();
  return rows as PortfolioPriceAlertDoc[];
}

export async function expireActivePortfolioPriceAlertsPastExpiry(input: {
  tenantIdHex: string;
  now?: Date;
}): Promise<number> {
  await ensurePortfolioPriceAlertIndexes();
  if (!ObjectId.isValid(input.tenantIdHex)) {
    return 0;
  }
  const now = input.now ?? new Date();
  const db = await getDb();
  const res = await db.collection(COLLECTION).updateMany(
    {
      tenantId: new ObjectId(input.tenantIdHex),
      status: "active",
      expiresAt: { $lte: now }
    },
    { $set: { status: "expired" as PortfolioPriceAlertStatus, updatedAt: now } }
  );
  return res.modifiedCount ?? 0;
}

export async function bulkExpireActivePortfolioPriceAlertsForTenant(tenantIdHex: string): Promise<number> {
  await ensurePortfolioPriceAlertIndexes();
  if (!ObjectId.isValid(tenantIdHex)) {
    return 0;
  }
  const now = new Date();
  const db = await getDb();
  const res = await db.collection(COLLECTION).updateMany(
    {
      tenantId: new ObjectId(tenantIdHex),
      status: "active"
    },
    { $set: { status: "expired" as PortfolioPriceAlertStatus, updatedAt: now } }
  );
  return res.modifiedCount ?? 0;
}

export async function upsertActivePortfolioPriceAlert(input: {
  userId: string;
  tenantId?: string;
  portfolioIdHex: string;
  portfolioName?: string;
  symbolUpper: string;
  targetPriceUsd: number;
  ruleKind: PortfolioPriceAlertDoc["ruleKind"];
  preserveLastReference?: boolean;
  /** Bootstrap reference from legacy NL rows on migration. */
  seedLastReferencePrice?: number;
}): Promise<{ doc: PortfolioPriceAlertDoc | null; replaced: boolean }> {
  await ensurePortfolioPriceAlertIndexes();
  const sym = normSymbol(input.symbolUpper);
  if (!sym || !ObjectId.isValid(input.portfolioIdHex)) {
    return { doc: null, replaced: false };
  }
  const uid = normUserId(input.userId);
  if (!input.tenantId || !ObjectId.isValid(input.tenantId)) {
    return { doc: null, replaced: false };
  }
  const tenantOid = new ObjectId(input.tenantId);
  const db = await getDb();

  const existing = (await db.collection(COLLECTION).findOne({
    ...userActiveFilter(uid, input.tenantId),
    symbolNorm: sym
  })) as PortfolioPriceAlertDoc | null;

  const now = new Date();
  const expiresAt =
    existing?.expiresAt && existing.expiresAt > now
      ? existing.expiresAt
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const pfOid = new ObjectId(input.portfolioIdHex);

  const nextRef =
    input.preserveLastReference === true && existing?.lastReferencePrice != null
      ? existing.lastReferencePrice
      : input.seedLastReferencePrice != null &&
          Number.isFinite(input.seedLastReferencePrice) &&
          input.seedLastReferencePrice > 0
        ? input.seedLastReferencePrice
        : undefined;

  const replaced = Boolean(existing?._id);

  if (existing?._id) {
    const $set: Record<string, unknown> = {
      tenantId: tenantOid,
      userId: uid,
      portfolioId: pfOid,
      ...(input.portfolioName ? { portfolioName: input.portfolioName } : {}),
      symbol: sym,
      symbolNorm: sym,
      targetPriceUsd: input.targetPriceUsd,
      ruleKind: input.ruleKind,
      status: "active",
      updatedAt: now,
      expiresAt
    };
    if (nextRef !== undefined) {
      $set.lastReferencePrice = nextRef;
    }
    await db.collection(COLLECTION).updateOne({ _id: existing._id }, { $set });
    const saved = (await db.collection(COLLECTION).findOne({ _id: existing._id })) as PortfolioPriceAlertDoc | null;
    return { doc: saved ?? null, replaced };
  }

  const doc: PortfolioPriceAlertDoc = {
    tenantId: tenantOid,
    userId: uid,
    portfolioId: pfOid,
    ...(input.portfolioName ? { portfolioName: input.portfolioName } : {}),
    symbol: sym,
    symbolNorm: sym,
    targetPriceUsd: input.targetPriceUsd,
    ruleKind: input.ruleKind,
    ...(nextRef !== undefined ? { lastReferencePrice: nextRef } : {}),
    status: "active",
    createdAt: now,
    updatedAt: now,
    expiresAt
  };

  const ins = await db.collection(COLLECTION).insertOne(doc);
  const saved = (await db.collection(COLLECTION).findOne({ _id: ins.insertedId })) as PortfolioPriceAlertDoc | null;
  return { doc: saved ?? null, replaced: false };
}

export async function patchPortfolioPriceAlertReference(input: {
  alertIdHex: string;
  tenantIdHex: string;
  lastReferencePrice: number;
}): Promise<boolean> {
  await ensurePortfolioPriceAlertIndexes();
  if (!ObjectId.isValid(input.alertIdHex) || !ObjectId.isValid(input.tenantIdHex)) {
    return false;
  }
  const px = input.lastReferencePrice;
  if (!Number.isFinite(px) || px <= 0) {
    return false;
  }
  const db = await getDb();
  const res = await db.collection(COLLECTION).updateOne(
    {
      _id: new ObjectId(input.alertIdHex),
      tenantId: new ObjectId(input.tenantIdHex),
      status: "active"
    },
    { $set: { lastReferencePrice: px, updatedAt: new Date() } }
  );
  return (res.modifiedCount ?? 0) > 0;
}

export async function markPortfolioPriceAlertFired(input: {
  alertIdHex: string;
  tenantIdHex: string;
  firedAt?: Date;
}): Promise<boolean> {
  await ensurePortfolioPriceAlertIndexes();
  if (!ObjectId.isValid(input.alertIdHex) || !ObjectId.isValid(input.tenantIdHex)) {
    return false;
  }
  const now = input.firedAt ?? new Date();
  const db = await getDb();
  const res = await db.collection(COLLECTION).updateOne(
    {
      _id: new ObjectId(input.alertIdHex),
      tenantId: new ObjectId(input.tenantIdHex),
      status: "active"
    },
    { $set: { status: "fired" as PortfolioPriceAlertStatus, firedAt: now, lastTriggeredAt: now, updatedAt: now } }
  );
  return (res.modifiedCount ?? 0) > 0;
}

export async function deleteActivePortfolioPriceAlertForUserSymbol(input: {
  userId: string;
  tenantId?: string;
  symbolUpper: string;
}): Promise<number> {
  await ensurePortfolioPriceAlertIndexes();
  const sym = normSymbol(input.symbolUpper);
  if (!sym) {
    return 0;
  }
  const db = await getDb();
  const res = await db.collection(COLLECTION).deleteMany({
    ...userActiveFilter(input.userId, input.tenantId),
    symbolNorm: sym
  });
  return res.deletedCount ?? 0;
}

export async function deleteAllActivePortfolioPriceAlertsForUser(input: {
  userId: string;
  tenantId?: string;
}): Promise<number> {
  await ensurePortfolioPriceAlertIndexes();
  const db = await getDb();
  const res = await db.collection(COLLECTION).deleteMany(userActiveFilter(input.userId, input.tenantId));
  return res.deletedCount ?? 0;
}
