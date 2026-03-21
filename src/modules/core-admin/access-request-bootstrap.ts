import { ObjectId } from "mongodb";
import { createHash } from "node:crypto";

import { getDb } from "@/lib/mongodb";
import { sendSlackNotification } from "@/lib/slack";
import {
  addFileToXaiCollection,
  createXaiCollection,
  getXaiCollectionById,
  listXaiCollections,
  uploadFileToXai,
  XaiCollectionNotFoundError
} from "@/lib/xai";
import { createAuditEvent } from "@/modules/audit/repository";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import {
  createScheduledTask,
  provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { getCoreUserById, updateCoreUserXaiCollection } from "@/modules/identity/repository";

const USER_BOOTSTRAP_COLLECTION = "admin_user_bootstrap_profiles";
const PROFILE_RETENTION_DAYS = 30;
export const XCHAT_TURN_RETENTION_DAYS = 30;
const PORTFOLIO_COLLECTION = TENANT_PORTFOLIO_COLLECTION;
const ACCOUNT_COLLECTION = "portfolio_accounts";
const WATCHLIST_COLLECTION = "portfolio_watchlists";

type BootstrapActor = {
  userId: string;
  email?: string;
  username?: string;
};

type EnqueueAccessRequestBootstrapInput = {
  requestId: string;
  userId: string;
  userEmail: string;
  tenantId?: string;
  requestedPlan: "free" | "pro" | "enterprise";
  actor: BootstrapActor;
};

type UserBootstrapProfile = {
  _id?: ObjectId;
  emailNormalized: string;
  userId: string;
  tenantId?: string;
  portfolioId?: ObjectId;
  accountId?: ObjectId;
  watchlistId?: ObjectId;
  xaiCollectionId?: string;
  xaiCollectionName?: string;
  requestedPlan?: "free" | "pro" | "enterprise";
  syncStatus: "pending" | "synced" | "warning";
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type UserBootstrapCollectionContext = {
  collectionId: string;
  collectionName?: string;
};

let ensureBootstrapIndexesPromise: Promise<void> | null = null;

export async function enqueueAccessRequestBootstrap(
  input: EnqueueAccessRequestBootstrapInput
): Promise<void> {
  await ensureBootstrapIndexes();

  const normalizedEmail = normalizeEmail(input.userEmail);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROFILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await upsertBootstrapProfile({
    emailNormalized: normalizedEmail,
    userId: input.userId,
    tenantId: input.tenantId,
    requestedPlan: input.requestedPlan,
    syncStatus: "pending",
    syncError: undefined,
    expiresAt
  });

  await createScheduledTask({
    tenantId: input.tenantId,
    name: `access-request-bootstrap:${normalizedEmail}`,
    category: "notifications",
    scheduleCron: "*/15 * * * *",
    enabled: false,
    maxRetries: 3,
    runTimeoutSeconds: 60,
    nextRunAt: now
  });

  // Fire-and-forget until backend task engine ships; this keeps approval latency low.
  queueMicrotask(() => {
    void runAccessRequestBootstrap(input).catch(async (error) => {
      await markBootstrapWarning({
        requestId: input.requestId,
        userId: input.userId,
        userEmail: input.userEmail,
        actor: input.actor,
        reason: error instanceof Error ? error.message : "unknown bootstrap error"
      });
    });
  });
}

export async function getUserBootstrapCollectionByUserId(input: {
  userId: string;
  tenantId?: string;
}): Promise<UserBootstrapCollectionContext | null> {
  const normalizedUserId = input.userId.trim();
  if (!normalizedUserId) {
    return null;
  }
  const filter: { userId: string; tenantId?: string } = {
    userId: normalizedUserId
  };
  if (input.tenantId) {
    filter.tenantId = input.tenantId.trim();
  }
  const db = await getDb();
  const profile = await db
    .collection<UserBootstrapProfile>(USER_BOOTSTRAP_COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();
  const collectionId = profile?.xaiCollectionId?.trim();
  if (!collectionId) {
    return null;
  }
  return {
    collectionId,
    collectionName: profile?.xaiCollectionName?.trim() || undefined
  };
}

export async function resolveOrCreateUserBootstrapCollection(input: {
  userId: string;
  tenantId?: string;
  email?: string;
}): Promise<UserBootstrapCollectionContext | null> {
  const normalizedUserId = input.userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  const existing = await getUserBootstrapCollectionByUserId({
    userId: normalizedUserId,
    tenantId: input.tenantId
  });
  if (existing) {
    await persistCoreUserCollectionBinding({
      userId: normalizedUserId,
      collectionId: existing.collectionId,
      collectionName: existing.collectionName
    });
    return existing;
  }

  await ensureBootstrapIndexes();
  const coreUser = ObjectId.isValid(normalizedUserId)
    ? await getCoreUserById(new ObjectId(normalizedUserId))
    : null;
  const collection = await ensureUserCollection({
    userId: normalizedUserId,
    existingCollectionId: coreUser?.xaiCollectionId
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROFILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await upsertBootstrapProfile({
    emailNormalized: resolveBootstrapProfileKey({
      userId: normalizedUserId,
      email: coreUser?.email ?? input.email
    }),
    userId: normalizedUserId,
    tenantId: input.tenantId,
    xaiCollectionId: collection.id,
    xaiCollectionName: collection.name,
    syncStatus: "synced",
    syncError: undefined,
    expiresAt
  });
  await persistCoreUserCollectionBinding({
    userId: normalizedUserId,
    collectionId: collection.id,
    collectionName: collection.name
  });

  return {
    collectionId: collection.id,
    collectionName: collection.name
  };
}

/** Writes a retention-bounded markdown file into the user xAI collection. Does not include persona systemPrompt, overridePrompt, or injected system instructions — only user prompt + assistant response + turn metadata. */
export async function appendXchatTurnToUserCollection(input: {
  userId: string;
  tenantId?: string;
  email?: string;
  collectionId?: string;
  personaName?: string;
  model?: string;
  scope?: string;
  prompt: string;
  response: string;
  createdAt?: Date;
}): Promise<{
  fileId: string;
  payloadHash: string;
  retentionExpiresAt: Date;
}> {
  const collectionId =
    input.collectionId?.trim() ||
    (await resolveOrCreateUserBootstrapCollection({
      userId: input.userId,
      tenantId: input.tenantId,
      email: input.email
    }))?.collectionId;
  if (!collectionId) {
    throw new Error("Missing user xAI collection for xchat turn sync");
  }

  const createdAt = input.createdAt ?? new Date();
  const retentionExpiresAt = new Date(
    createdAt.getTime() + XCHAT_TURN_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const turnDoc = [
    "# xChat Prompt/Response",
    "",
    `userId: ${input.userId}`,
    `tenantId: ${input.tenantId ?? "none"}`,
    `persona: ${input.personaName ?? "unknown"}`,
    `model: ${input.model ?? "unknown"}`,
    `scope: ${input.scope ?? "global"}`,
    `createdAt: ${createdAt.toISOString()}`,
    `retentionDays: ${String(XCHAT_TURN_RETENTION_DAYS)}`,
    `retentionExpiresAt: ${retentionExpiresAt.toISOString()}`,
    "",
    "## Prompt",
    input.prompt,
    "",
    "## Response",
    input.response
  ].join("\n");
  const payloadHash = createHash("sha256").update(turnDoc).digest("hex");
  const filename = `xchat-turn-${toFileTimestamp(createdAt)}-${input.userId.slice(-8)}.md`;
  const bytes = new TextEncoder().encode(turnDoc);
  const uploaded = await uploadFileToXai(filename, bytes);
  await addFileToXaiCollection({
    collectionId,
    fileId: uploaded.fileId
  });
  return {
    fileId: uploaded.fileId,
    payloadHash,
    retentionExpiresAt
  };
}

async function runAccessRequestBootstrap(
  input: EnqueueAccessRequestBootstrapInput
): Promise<void> {
  const normalizedEmail = normalizeEmail(input.userEmail);
  const existing = await getBootstrapProfileByEmail(normalizedEmail);

  if (existing && existing.userId !== input.userId) {
    await rebindExistingResourcesToUser(existing, input.userId);
  }

  const provisioned = await provisionDefaultPortfolioForUser({
    userId: input.userId,
    tenantId: input.tenantId
  });

  const collection = await ensureUserCollection({
    userId: input.userId,
    existingCollectionId: existing?.xaiCollectionId
  });
  await persistCoreUserCollectionBinding({
    userId: input.userId,
    collectionId: collection.id,
    collectionName: collection.name
  });

  await seedInitialCollectionContext({
    collectionId: collection.id,
    email: normalizedEmail,
    userId: input.userId,
    portfolioId: provisioned.portfolio._id?.toHexString(),
    accountId: provisioned.account._id?.toHexString(),
    watchlistId: provisioned.watchlist._id?.toHexString()
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROFILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await upsertBootstrapProfile({
    emailNormalized: normalizedEmail,
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: provisioned.portfolio._id,
    accountId: provisioned.account._id,
    watchlistId: provisioned.watchlist._id,
    xaiCollectionId: collection.id,
    xaiCollectionName: collection.name,
    requestedPlan: input.requestedPlan,
    syncStatus: "synced",
    syncError: undefined,
    expiresAt
  });

  await createAuditEvent({
    entityType: "access_request",
    entityId: input.requestId,
    action: "bootstrap-synced",
    actor: input.actor,
    details: {
      userId: input.userId,
      email: normalizedEmail,
      xaiCollectionId: collection.id
    }
  });
}

async function ensureUserCollection(input: {
  userId: string;
  existingCollectionId?: string;
}): Promise<{ id: string; name: string }> {
  const collectionName = buildUserCollectionNameByUserId(input.userId);
  const existingCollectionId = input.existingCollectionId?.trim();

  if (existingCollectionId) {
    try {
      const existingCollection = await getXaiCollectionById(existingCollectionId);
      return {
        id: existingCollection.id,
        name: existingCollection.name ?? collectionName
      };
    } catch (error) {
      if (!(error instanceof XaiCollectionNotFoundError)) {
        throw error;
      }
    }
  }

  const inventory = await listXaiCollections();
  const found = inventory.find(
    (item) => item.name?.trim().toLowerCase() === collectionName.toLowerCase()
  );
  if (found) {
    return {
      id: found.id,
      name: found.name ?? collectionName
    };
  }

  return createXaiCollection(collectionName);
}

async function seedInitialCollectionContext(input: {
  collectionId: string;
  email: string;
  userId: string;
  portfolioId?: string;
  accountId?: string;
  watchlistId?: string;
}): Promise<void> {
  const body = [
    "# atxFinance User Bootstrap Context",
    "",
    `email: ${input.email}`,
    `userId: ${input.userId}`,
    `collectionId: ${input.collectionId}`,
    `portfolioId: ${input.portfolioId ?? "pending"}`,
    `accountId: ${input.accountId ?? "pending"}`,
    `watchlistId: ${input.watchlistId ?? "pending"}`,
    `seededAt: ${new Date().toISOString()}`,
    "",
    "This document links approved user portfolio/account/watchlist bootstrap resources to the xAI collection."
  ].join("\n");

  const filename = `bootstrap-${slugifyEmail(input.email)}.md`;
  const bytes = new TextEncoder().encode(body);
  const uploaded = await uploadFileToXai(filename, bytes);
  await addFileToXaiCollection({
    collectionId: input.collectionId,
    fileId: uploaded.fileId
  });
}

async function markBootstrapWarning(input: {
  requestId: string;
  userId: string;
  userEmail: string;
  actor: BootstrapActor;
  reason: string;
}): Promise<void> {
  const normalizedEmail = normalizeEmail(input.userEmail);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROFILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await upsertBootstrapProfile({
    emailNormalized: normalizedEmail,
    userId: input.userId,
    syncStatus: "warning",
    syncError: input.reason,
    expiresAt
  });

  await createAuditEvent({
    entityType: "access_request",
    entityId: input.requestId,
    action: "alert-user-not-sync-warning",
    actor: input.actor,
    details: {
      userId: input.userId,
      email: normalizedEmail,
      reason: input.reason
    }
  });

  await sendSlackNotification({
    text: `alert-user-not-sync-warning: ${normalizedEmail} bootstrap sync failed`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "⚠️ User bootstrap sync warning" }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*User:*\n${normalizedEmail}` },
          { type: "mrkdwn", text: `*User ID:*\n\`${input.userId}\`` }
        ]
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Reason:*\n${input.reason}` }
      }
    ]
  });
}

async function ensureBootstrapIndexes(): Promise<void> {
  if (!ensureBootstrapIndexesPromise) {
    ensureBootstrapIndexesPromise = createBootstrapIndexes();
  }
  await ensureBootstrapIndexesPromise;
}

async function createBootstrapIndexes(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection<UserBootstrapProfile>(USER_BOOTSTRAP_COLLECTION).createIndex(
      { emailNormalized: 1 },
      { unique: true, name: "uniq_bootstrap_email" }
    ),
    db.collection<UserBootstrapProfile>(USER_BOOTSTRAP_COLLECTION).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "ttl_bootstrap_profile" }
    )
  ]);
}

async function getBootstrapProfileByEmail(
  emailNormalized: string
): Promise<UserBootstrapProfile | null> {
  const db = await getDb();
  return db
    .collection<UserBootstrapProfile>(USER_BOOTSTRAP_COLLECTION)
    .findOne({ emailNormalized });
}

async function upsertBootstrapProfile(
  payload: Partial<UserBootstrapProfile> & { emailNormalized: string; userId: string; expiresAt: Date }
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db.collection<UserBootstrapProfile>(USER_BOOTSTRAP_COLLECTION).updateOne(
    { emailNormalized: payload.emailNormalized },
    {
      $setOnInsert: {
        createdAt: now
      },
      $set: {
        userId: payload.userId,
        tenantId: payload.tenantId,
        portfolioId: payload.portfolioId,
        accountId: payload.accountId,
        watchlistId: payload.watchlistId,
        xaiCollectionId: payload.xaiCollectionId,
        xaiCollectionName: payload.xaiCollectionName,
        requestedPlan: payload.requestedPlan,
        syncStatus: payload.syncStatus,
        syncError: payload.syncError,
        updatedAt: now,
        expiresAt: payload.expiresAt
      }
    },
    { upsert: true }
  );
}

async function rebindExistingResourcesToUser(
  profile: UserBootstrapProfile,
  nextUserId: string
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const updates: Promise<unknown>[] = [];

  if (profile.portfolioId) {
    updates.push(
      db.collection(PORTFOLIO_COLLECTION).updateOne(
        { _id: profile.portfolioId },
        { $set: { userId: nextUserId, updatedAt: now } }
      )
    );
  }
  if (profile.accountId) {
    updates.push(
      db.collection(ACCOUNT_COLLECTION).updateOne(
        { _id: profile.accountId },
        { $set: { userId: nextUserId, updatedAt: now } }
      )
    );
  }
  if (profile.watchlistId) {
    updates.push(
      db.collection(WATCHLIST_COLLECTION).updateOne(
        { _id: profile.watchlistId },
        { $set: { userId: nextUserId, updatedAt: now } }
      )
    );
  }
  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildUserCollectionNameByUserId(userId: string): string {
  return `atx-finance-user-${userId.trim().toLowerCase()}-xchat`;
}

function resolveBootstrapProfileKey(input: { userId: string; email?: string }): string {
  const normalizedEmail = input.email?.trim().toLowerCase();
  if (normalizedEmail) {
    return normalizedEmail;
  }
  return `user:${input.userId.trim().toLowerCase()}`;
}

async function persistCoreUserCollectionBinding(input: {
  userId: string;
  collectionId: string;
  collectionName?: string;
}): Promise<void> {
  if (!ObjectId.isValid(input.userId)) {
    return;
  }
  await updateCoreUserXaiCollection({
    userId: new ObjectId(input.userId),
    xaiCollectionId: input.collectionId,
    xaiCollectionName: input.collectionName
  });
}

function toFileTimestamp(value: Date): string {
  return value.toISOString().replace(/[:.]/g, "-");
}

function slugifyEmail(email: string): string {
  return normalizeEmail(email).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
