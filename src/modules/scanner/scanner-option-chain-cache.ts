import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

import type { OptionContractData } from "@/modules/strategy-options/options-chain";

import { SCANNER_OPTION_CHAIN_CACHE_COLLECTION } from "@/modules/scanner/scanner-collection-names";
import {
    isOptionsChainCacheEnabled,
    optionsChainCacheTtlSeconds
} from "@/modules/scanner/scanner-platform-env";

export type CachedOptionChainPayload = {
  optionChain: Array<{
    strike: number;
    call: OptionContractData | null;
    put: OptionContractData | null;
  }>;
  actualExpiration: string;
};

type CacheDoc = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  cacheKey: string;
  underlying: string;
  expirationYmd: string;
  payload: CachedOptionChainPayload;
  expiresAt: Date;
  createdAt: Date;
};

let indexesEnsured = false;

async function ensureOptionChainCacheIndexes(): Promise<void> {
  if (indexesEnsured) {
    return;
  }
  indexesEnsured = true;
  const db = await getDb();
  const coll = db.collection(SCANNER_OPTION_CHAIN_CACHE_COLLECTION);
  try {
    await coll.createIndex({ cacheKey: 1 }, { unique: true });
    await coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch {
    /* non-fatal — TTL may already exist */
  }
}

/** Stable cache key for Mongo + tests (tenant-scoped or global). */
export function computeScannerOptionChainCacheKey(
  tenantId: ObjectId | undefined,
  underlying: string,
  expirationYmd: string
): string {
  const tenantPart = tenantId ? tenantId.toHexString() : "global";
  const raw = `${tenantPart}|${underlying.toUpperCase()}|${expirationYmd.slice(0, 10)}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function getCachedOptionChain(
  tenantId: ObjectId | undefined,
  underlying: string,
  expirationYmd: string
): Promise<CachedOptionChainPayload | null> {
  if (!isOptionsChainCacheEnabled()) {
    return null;
  }
  await ensureOptionChainCacheIndexes();
  const db = await getDb();
  const cacheKey = computeScannerOptionChainCacheKey(tenantId, underlying, expirationYmd);
  const now = new Date();
  const doc = await db.collection<CacheDoc>(SCANNER_OPTION_CHAIN_CACHE_COLLECTION).findOne({
    cacheKey,
    expiresAt: { $gt: now }
  });
  return doc?.payload ?? null;
}

export async function setCachedOptionChain(
  tenantId: ObjectId | undefined,
  underlying: string,
  expirationYmd: string,
  payload: CachedOptionChainPayload
): Promise<void> {
  if (!isOptionsChainCacheEnabled()) {
    return;
  }
  await ensureOptionChainCacheIndexes();
  const db = await getDb();
  const cacheKey = computeScannerOptionChainCacheKey(tenantId, underlying, expirationYmd);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + optionsChainCacheTtlSeconds() * 1000);
  await db.collection<CacheDoc>(SCANNER_OPTION_CHAIN_CACHE_COLLECTION).updateOne(
    { cacheKey },
    {
      $set: {
        tenantId,
        cacheKey,
        underlying: underlying.toUpperCase(),
        expirationYmd: expirationYmd.slice(0, 10),
        payload,
        expiresAt,
        createdAt: now
      }
    },
    { upsert: true }
  );
}
