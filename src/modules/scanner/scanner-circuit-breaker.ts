import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

import { SCANNER_CIRCUIT_STATE_COLLECTION } from "@/modules/scanner/scanner-collection-names";
import {
    isScannerCircuitBreakerEnabled,
    scannerCircuitCooldownSeconds,
    scannerCircuitFailureThreshold
} from "@/modules/scanner/scanner-platform-env";

export type ScannerUpstreamProvider = "yahoo";

type CircuitDoc = {
  _id?: ObjectId;
  /** Stable scope key: ObjectId hex or `global`. */
  tenantKey: string;
  tenantId?: ObjectId;
  provider: ScannerUpstreamProvider;
  failureStreak: number;
  circuitOpenUntil?: Date | null;
  updatedAt: Date;
};

export function scannerCircuitTenantKey(tenantId: ObjectId | undefined): string {
  return tenantId ? tenantId.toHexString() : "global";
}

export type CircuitAllowResult = { allowed: true } | { allowed: false; reason: "circuit_open" };

export async function scannerCircuitAllow(
  tenantId: ObjectId | undefined,
  provider: ScannerUpstreamProvider
): Promise<CircuitAllowResult> {
  if (!isScannerCircuitBreakerEnabled()) {
    return { allowed: true };
  }
  const db = await getDb();
  const tk = scannerCircuitTenantKey(tenantId);
  const doc = await db.collection<CircuitDoc>(SCANNER_CIRCUIT_STATE_COLLECTION).findOne({
    tenantKey: tk,
    provider
  });
  const now = Date.now();
  if (doc?.circuitOpenUntil && doc.circuitOpenUntil.getTime() > now) {
    return { allowed: false, reason: "circuit_open" };
  }
  return { allowed: true };
}

export async function scannerCircuitRecordSuccess(
  tenantId: ObjectId | undefined,
  provider: ScannerUpstreamProvider
): Promise<void> {
  if (!isScannerCircuitBreakerEnabled()) {
    return;
  }
  const db = await getDb();
  const tk = scannerCircuitTenantKey(tenantId);
  const now = new Date();
  await db.collection<CircuitDoc>(SCANNER_CIRCUIT_STATE_COLLECTION).updateOne(
    { tenantKey: tk, provider },
    {
      $set: {
        tenantKey: tk,
        tenantId,
        provider,
        failureStreak: 0,
        circuitOpenUntil: null,
        updatedAt: now
      }
    },
    { upsert: true }
  );
}

export async function scannerCircuitRecordFailure(
  tenantId: ObjectId | undefined,
  provider: ScannerUpstreamProvider
): Promise<void> {
  if (!isScannerCircuitBreakerEnabled()) {
    return;
  }
  const db = await getDb();
  const tk = scannerCircuitTenantKey(tenantId);
  const filter = { tenantKey: tk, provider };
  const doc = await db.collection<CircuitDoc>(SCANNER_CIRCUIT_STATE_COLLECTION).findOne(filter);
  const streak = (doc?.failureStreak ?? 0) + 1;
  const thr = scannerCircuitFailureThreshold();
  const now = new Date();
  if (streak >= thr) {
    await db.collection<CircuitDoc>(SCANNER_CIRCUIT_STATE_COLLECTION).updateOne(
      filter,
      {
        $set: {
          tenantKey: tk,
          tenantId,
          provider,
          failureStreak: 0,
          circuitOpenUntil: new Date(Date.now() + scannerCircuitCooldownSeconds() * 1000),
          updatedAt: now
        }
      },
      { upsert: true }
    );
    return;
  }
  await db.collection<CircuitDoc>(SCANNER_CIRCUIT_STATE_COLLECTION).updateOne(
    filter,
    {
      $set: {
        tenantKey: tk,
        tenantId,
        provider,
        failureStreak: streak,
        updatedAt: now
      }
    },
    { upsert: true }
  );
}
