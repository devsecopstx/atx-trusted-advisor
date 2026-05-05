import { ObjectId } from "mongodb";
import { createHash } from "node:crypto";

import {
    resolveNormalizedAtxInstanceCollectionRoot,
    resolveUserHistoryXaiCollectionDisplayName
} from "@/lib/atx-instance-collection-root";
import { getDb } from "@/lib/mongodb";
import { DEFAULT_SCHEDULED_TASK_CRON } from "@/lib/scheduled-task-category-schema";
import { sendSlackNotification } from "@/lib/slack";
import type { SubscriptionPlan } from "@/lib/subscription-plan";
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
import { ensureTenantBootstrapForUser } from "@/modules/core-admin/tenant-user-bootstrap";
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
  requestedPlan: SubscriptionPlan;
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
  requestedPlan?: SubscriptionPlan;
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

/**
 * After admin approves an access request, the **default book is already created** in the same API
 * request via `provisionDefaultPortfolioForUser` (default portfolio + paper account with **$25,000**
 * cash + watchlist seeded with **TSLA**) before the request row is marked reviewed.
 *
 * This function: (1) records `admin_user_bootstrap_profiles` as pending, (2) inserts a **disabled**
 * `admin_scheduled_tasks` row (`nextRunAt: now`) as an audit/trace line in Admin → Tasks — **do not**
 * enable it expecting book provisioning; the `notifications` category handler does not run this
 * bootstrap. (3) Immediately schedules `runAccessRequestBootstrap` on a microtask (xAI collection +
 * idempotent re-provision + profile `synced`).
 */
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
    scheduleCron: DEFAULT_SCHEDULED_TASK_CRON,
    scheduleDescription:
      "Trace row for access approval: default portfolio + $25k paper account + TSLA watchlist are created synchronously when the request is approved (Admin → Access requests). xChat/xAI bootstrap runs immediately after in-process (microtask). Task stays disabled — not used to provision the book.",
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

export type XchatTurnMarkdownInput = {
  userId: string;
  tenantId?: string;
  personaName?: string;
  model?: string;
  scope?: string;
  prompt: string;
  response: string;
  createdAt?: Date;
};

/** Markdown + hashes for one xChat turn (user_history xAI upload). */
export function buildXchatTurnMarkdownPayload(input: XchatTurnMarkdownInput): {
  markdown: string;
  payloadHash: string;
  retentionExpiresAt: Date;
  filename: string;
} {
  const createdAt = input.createdAt ?? new Date();
  const retentionExpiresAt = new Date(
    createdAt.getTime() + XCHAT_TURN_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const uid = input.userId.trim();
  const suffix = uid.length >= 8 ? uid.slice(-8) : uid.padStart(8, "0");
  const turnDoc = [
    "# xChat Prompt/Response",
    "",
    `userId: ${uid}`,
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
  const filename = `xchat-turn-${toFileTimestamp(createdAt)}-${suffix}.md`;
  return { markdown: turnDoc, payloadHash, retentionExpiresAt, filename };
}

export async function uploadBuiltXchatTurnToXaiCollection(
  collectionId: string,
  built: ReturnType<typeof buildXchatTurnMarkdownPayload>
): Promise<{ fileId: string }> {
  const cid = collectionId.trim();
  if (!cid) {
    throw new Error("collectionId is required");
  }
  const bytes = new TextEncoder().encode(built.markdown);
  const uploaded = await uploadFileToXai(built.filename, bytes);
  await addFileToXaiCollection({
    collectionId: cid,
    fileId: uploaded.fileId
  });
  return { fileId: uploaded.fileId };
}

/** Writes a retention-bounded markdown file into the user xAI collection. Does not include persona systemPrompt, overridePrompt, or injected system instructions — only user prompt + assistant response + turn metadata. */
export async function appendXchatTurnToUserCollection(
  input: XchatTurnMarkdownInput & {
    email?: string;
    collectionId?: string;
  }
): Promise<{
  fileId: string;
  payloadHash: string;
  retentionExpiresAt: Date;
}> {
  const resolved =
    input.collectionId?.trim() ||
    (await resolveOrCreateUserBootstrapCollection({
      userId: input.userId,
      tenantId: input.tenantId,
      email: input.email
    }))?.collectionId;
  if (!resolved) {
    throw new Error("Missing user xAI collection for xchat turn sync");
  }
  const built = buildXchatTurnMarkdownPayload(input);
  const { fileId } = await uploadBuiltXchatTurnToXaiCollection(resolved, built);
  return {
    fileId,
    payloadHash: built.payloadHash,
    retentionExpiresAt: built.retentionExpiresAt
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

  let portfolioIdHex: string | undefined;
  let accountIdHex: string | undefined;
  let watchlistIdHex: string | undefined;

  if (input.tenantId?.trim()) {
    const bootstrapResult = await ensureTenantBootstrapForUser({
      userId: input.userId,
      tenantId: input.tenantId.trim(),
      trigger: "run_access_request_bootstrap",
      emitAudit: false
    });
    if (bootstrapResult.didProvision) {
      portfolioIdHex = bootstrapResult.result.portfolio._id!.toHexString();
      accountIdHex = bootstrapResult.result.account._id!.toHexString();
      watchlistIdHex = bootstrapResult.result.watchlist._id!.toHexString();
    }
  } else {
    const provisioned = await provisionDefaultPortfolioForUser({
      userId: input.userId,
      tenantId: input.tenantId
    });
    portfolioIdHex = provisioned.portfolio._id!.toHexString();
    accountIdHex = provisioned.account._id!.toHexString();
    watchlistIdHex = provisioned.watchlist._id!.toHexString();
  }

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
    portfolioId: portfolioIdHex,
    accountId: accountIdHex,
    watchlistId: watchlistIdHex
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROFILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await upsertBootstrapProfile({
    emailNormalized: normalizedEmail,
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: portfolioIdHex ? new ObjectId(portfolioIdHex) : undefined,
    accountId: accountIdHex ? new ObjectId(accountIdHex) : undefined,
    watchlistId: watchlistIdHex ? new ObjectId(watchlistIdHex) : undefined,
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
  const legacyName = legacyUserXchatBootstrapCollectionName(input.userId);
  const want = collectionName.trim().toLowerCase();
  const legacyWant = legacyName.trim().toLowerCase();
  const uid = input.userId.trim().toLowerCase();
  const legacyAtxChat = `atx-chat-${uid}-history`;
  const namesToMatch = new Set([want, legacyWant]);
  if (resolveNormalizedAtxInstanceCollectionRoot() && legacyAtxChat !== want) {
    namesToMatch.add(legacyAtxChat);
  }
  const found = inventory.find((item) => {
    const n = item.name?.trim().toLowerCase();
    return n != null && namesToMatch.has(n);
  });
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

/** xAI collection display name for per-user chat history (`user_history` in xChat collections API). */
export function buildUserXchatHistoryCollectionName(userId: string): string {
  return resolveUserHistoryXaiCollectionDisplayName(userId);
}

/** Legacy name from earlier deploys; still matched when listing xAI collections to avoid duplicates. */
export function legacyUserXchatBootstrapCollectionName(userId: string): string {
  return `atx-finance-user-${userId.trim().toLowerCase()}-xchat`;
}

function buildUserCollectionNameByUserId(userId: string): string {
  return buildUserXchatHistoryCollectionName(userId);
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
