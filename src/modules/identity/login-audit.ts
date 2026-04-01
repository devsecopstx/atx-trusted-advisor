import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

const COLLECTION = "audit_login" as const;

export type LoginAuditProvider = "x_oauth" | "google_oauth" | "link_email";

export type LoginAuditRecord = {
  _id?: ObjectId;
  outcome: "success" | "failure";
  provider: LoginAuditProvider;
  createdAt: Date;
  /** Machine-readable failure reason (query param / product code). */
  errorCode?: string;
  clientIp?: string;
  country?: string;
  userAgent?: string;
  userId?: string;
  xUserId?: string;
  username?: string;
  email?: string;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureLoginAuditIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = createLoginAuditIndexes();
  }
  await ensureIndexesPromise;
}

async function createLoginAuditIndexes(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection(COLLECTION).createIndex({ createdAt: -1 }, { name: "audit_login_created_desc" }),
    db
      .collection(COLLECTION)
      .createIndex({ outcome: 1, createdAt: -1 }, { name: "audit_login_outcome_created" }),
    db
      .collection(COLLECTION)
      .createIndex({ clientIp: 1, createdAt: -1 }, { name: "audit_login_ip_created", sparse: true })
  ]);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/**
 * Inserts one row into `audit_login`. Swallows errors so auth flows never fail on audit DB issues.
 */
export async function appendLoginAuditRecord(
  input: Omit<LoginAuditRecord, "_id" | "createdAt">
): Promise<void> {
  try {
    await ensureLoginAuditIndexes();
    const db = await getDb();
    const doc: LoginAuditRecord = {
      outcome: input.outcome,
      provider: input.provider,
      createdAt: new Date(),
      ...(input.errorCode !== undefined ? { errorCode: truncate(input.errorCode, 128) } : {}),
      ...(input.clientIp !== undefined ? { clientIp: truncate(input.clientIp, 64) } : {}),
      ...(input.country !== undefined ? { country: truncate(input.country, 8) } : {}),
      ...(input.userAgent !== undefined ? { userAgent: truncate(input.userAgent, 256) } : {}),
      ...(input.userId !== undefined ? { userId: truncate(input.userId, 32) } : {}),
      ...(input.xUserId !== undefined ? { xUserId: truncate(input.xUserId, 128) } : {}),
      ...(input.username !== undefined ? { username: truncate(input.username, 64) } : {}),
      ...(input.email !== undefined ? { email: truncate(input.email.trim().toLowerCase(), 256) } : {})
    };
    await db.collection<LoginAuditRecord>(COLLECTION).insertOne(doc);
  } catch (error) {
    console.warn("[login-audit] appendLoginAuditRecord failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function listLoginAuditRecords(input?: {
  limit?: number;
  outcome?: "success" | "failure";
  clientIp?: string;
  fromDate?: Date;
  toDate?: Date;
}): Promise<LoginAuditRecord[]> {
  await ensureLoginAuditIndexes();
  const db = await getDb();
  const limit = input?.limit ?? 200;
  const query: Record<string, unknown> = {};
  if (input?.outcome) {
    query.outcome = input.outcome;
  }
  if (input?.clientIp?.trim()) {
    query.clientIp = input.clientIp.trim();
  }
  if (input?.fromDate || input?.toDate) {
    query.createdAt = {
      ...(input.fromDate ? { $gte: input.fromDate } : {}),
      ...(input.toDate ? { $lte: input.toDate } : {})
    };
  }
  return db
    .collection<LoginAuditRecord>(COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
