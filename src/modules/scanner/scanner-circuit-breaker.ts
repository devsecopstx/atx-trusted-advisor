import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

import { SCANNER_CIRCUIT_STATE_COLLECTION } from "@/modules/scanner/scanner-collection-names";

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

function tenantKeyFrom(tenantId: ObjectId | undefined): string {
  return tenantId ? tenantId.toHexString() : "global";
}

function breakerEnabled(): boolean {
  return process.env.SCANNER_CIRCUIT_BREAKER_ENABLED !== "false" && process.env.SCANNER_CIRCUIT_BREAKER_ENABLED !== "0";
}

function cooldownMs(): number {
  const sec = Number.parseInt(process.env.SCANNER_CIRCUIT_COOLDOWN_SEC ?? "900", 10);
  const s = Number.isFinite(sec) && sec >= 60 && sec <= 7200 ? sec : 900;
  return s * 1000;
}

function failureThreshold(): number {
  const n = Number.parseInt(process.env.SCANNER_CIRCUIT_FAILURE_THRESHOLD ?? "3", 10);
  return Number.isFinite(n) && n >= 1 && n <= 20 ? n : 3;
}

export type CircuitAllowResult = { allowed: true } | { allowed: false; reason: "circuit_open" };

export async function scannerCircuitAllow(
  tenantId: ObjectId | undefined,
  provider: ScannerUpstreamProvider
): Promise<CircuitAllowResult> {
  if (!breakerEnabled()) {
    return { allowed: true };
  }
  const db = await getDb();
  const tk = tenantKeyFrom(tenantId);
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
  if (!breakerEnabled()) {
    return;
  }
  const db = await getDb();
  const tk = tenantKeyFrom(tenantId);
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
  if (!breakerEnabled()) {
    return;
  }
  const db = await getDb();
  const tk = tenantKeyFrom(tenantId);
  const filter = { tenantKey: tk, provider };
  const doc = await db.collection<CircuitDoc>(SCANNER_CIRCUIT_STATE_COLLECTION).findOne(filter);
  const streak = (doc?.failureStreak ?? 0) + 1;
  const thr = failureThreshold();
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
          circuitOpenUntil: new Date(Date.now() + cooldownMs()),
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
