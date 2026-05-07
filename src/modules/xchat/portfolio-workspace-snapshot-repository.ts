import { ObjectId, type IndexDescription } from "mongodb";

import { getDb } from "@/lib/mongodb";

const COLLECTION = "portfolio_workspace_snapshots";

export type PortfolioWorkspaceSnapshotDoc = {
  portfolioId: ObjectId;
  userId: string;
  tenantId?: ObjectId;
  workspaceContentRev: number;
  /** Same shape as Redis / `WorkspaceSnapshotPreload` JSON. */
  preload: unknown;
  materializedAt: Date;
  source: "scanner_warm" | "xchat_ask";
};

let ensureIndexesPromise: Promise<void> | null = null;

/**
 * Seconds after `materializedAt` when Mongo may delete the document (TTL).
 * **0** = do not create a TTL index (purge job on Spring can still remove old rows).
 * When set, clamped to **60 seconds** … **90 days** (Mongo `expireAfterSeconds`).
 */
export function getPortfolioWorkspaceSnapshotTtlAfterSeconds(): number {
  const raw = process.env.PORTFOLIO_WORKSPACE_SNAPSHOT_TTL_SECONDS?.trim();
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 0;
  }
  const sec = Math.floor(n);
  if (sec <= 0) {
    return 0;
  }
  const min = 60;
  const max = 90 * 24 * 3600;
  return Math.min(max, Math.max(min, sec));
}

export async function ensurePortfolioWorkspaceSnapshotIndexes(): Promise<void> {
  if (ensureIndexesPromise) {
    return ensureIndexesPromise;
  }
  ensureIndexesPromise = (async () => {
    const db = await getDb();
    const ttlAfter = getPortfolioWorkspaceSnapshotTtlAfterSeconds();
    const indexList: IndexDescription[] = [
      {
        key: { portfolioId: 1, workspaceContentRev: 1 },
        name: "uniq_portfolio_workspace_rev",
        unique: true
      },
      { key: { tenantId: 1, materializedAt: -1 }, name: "tenant_materialized" },
      { key: { userId: 1, materializedAt: -1 }, name: "user_materialized" }
    ];
    if (ttlAfter > 0) {
      indexList.push({
        key: { materializedAt: 1 },
        name: "materialized_at_ttl",
        expireAfterSeconds: ttlAfter
      });
    }
    await db.collection(COLLECTION).createIndexes(indexList);
  })();
  return ensureIndexesPromise;
}

export async function findPortfolioWorkspaceSnapshot(input: {
  portfolioIdHex: string;
  workspaceContentRev: number;
}): Promise<unknown | null> {
  if (!ObjectId.isValid(input.portfolioIdHex)) {
    return null;
  }
  await ensurePortfolioWorkspaceSnapshotIndexes();
  const db = await getDb();
  const row = await db.collection<PortfolioWorkspaceSnapshotDoc>(COLLECTION).findOne(
    {
      portfolioId: new ObjectId(input.portfolioIdHex),
      workspaceContentRev: input.workspaceContentRev
    },
    { projection: { preload: 1 } }
  );
  return row?.preload ?? null;
}

export type PortfolioWorkspaceSnapshotRow = {
  preload: unknown;
  workspaceContentRev: number;
  materializedAt: Date;
  source: PortfolioWorkspaceSnapshotDoc["source"];
};

export async function findPortfolioWorkspaceSnapshotRow(input: {
  portfolioIdHex: string;
  workspaceContentRev: number;
}): Promise<PortfolioWorkspaceSnapshotRow | null> {
  if (!ObjectId.isValid(input.portfolioIdHex)) {
    return null;
  }
  await ensurePortfolioWorkspaceSnapshotIndexes();
  const db = await getDb();
  const row = await db.collection<PortfolioWorkspaceSnapshotDoc>(COLLECTION).findOne(
    {
      portfolioId: new ObjectId(input.portfolioIdHex),
      workspaceContentRev: input.workspaceContentRev
    },
    { projection: { preload: 1, workspaceContentRev: 1, materializedAt: 1, source: 1 } }
  );
  if (!row?.preload || row.materializedAt === undefined) {
    return null;
  }
  return {
    preload: row.preload,
    workspaceContentRev: row.workspaceContentRev,
    materializedAt: row.materializedAt,
    source: row.source
  };
}

export async function upsertPortfolioWorkspaceSnapshot(input: {
  portfolioIdHex: string;
  userId: string;
  tenantId?: string;
  workspaceContentRev: number;
  preload: unknown;
  source: PortfolioWorkspaceSnapshotDoc["source"];
}): Promise<void> {
  if (!ObjectId.isValid(input.portfolioIdHex)) {
    return;
  }
  await ensurePortfolioWorkspaceSnapshotIndexes();
  const db = await getDb();
  const tenantOid =
    input.tenantId && ObjectId.isValid(input.tenantId) ? new ObjectId(input.tenantId) : undefined;
  await db.collection<PortfolioWorkspaceSnapshotDoc>(COLLECTION).replaceOne(
    {
      portfolioId: new ObjectId(input.portfolioIdHex),
      workspaceContentRev: input.workspaceContentRev
    },
    {
      portfolioId: new ObjectId(input.portfolioIdHex),
      userId: input.userId.trim(),
      ...(tenantOid ? { tenantId: tenantOid } : {}),
      workspaceContentRev: input.workspaceContentRev,
      preload: input.preload,
      materializedAt: new Date(),
      source: input.source
    },
    { upsert: true }
  );
}
