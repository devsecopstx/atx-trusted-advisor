import { MongoServerError, ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import {
    buildDefaultXfinancePersonaPayload,
    XPERSONA_SUPER_AGENT_NAME,
    XPERSONA_XFINANCE_NAME
} from "@/modules/xchat/default-xpersonas";
import type {
    PersonaCollectionVerification,
    PersonaConfig,
    PersonaStatus,
    PersonaVersionSnapshot,
    RagChunk,
    RagSourceFile,
    XChatHistoryItem,
    XChatHistoryStats,
    XChatSessionLog
} from "@/modules/xchat/types";

const collections = {
  personas: "xchat_personas",
  personaVersions: "xchat_persona_versions",
  /** Canonical inventory for admin GET `/api/rag/files` + Spring BFF (replaces legacy `xchat_rag_files`). */
  ragFiles: "xai_collections",
  ragChunks: "xchat_rag_chunks",
  chatLogs: "xchat_logs"
} as const;

let ensurePersonaIndexesPromise: Promise<void> | null = null;
let ensureXchatLogIndexesPromise: Promise<void> | null = null;
const XCHAT_LOG_RETENTION_DAYS = 30;

export class PersonaNameConflictError extends Error {
  readonly code = "PERSONA_NAME_CONFLICT";

  constructor() {
    super("A persona with that name already exists");
    this.name = "PersonaNameConflictError";
  }
}

export async function ensurePersonaIndexes(): Promise<void> {
  if (!ensurePersonaIndexesPromise) {
    ensurePersonaIndexesPromise = createPersonaIndexes();
  }
  await ensurePersonaIndexesPromise;
}

export async function ensureXchatLogIndexes(): Promise<void> {
  if (!ensureXchatLogIndexesPromise) {
    ensureXchatLogIndexesPromise = createXchatLogIndexes();
  }
  await ensureXchatLogIndexesPromise;
}

async function createPersonaIndexes(): Promise<void> {
  const db = await getDb();
  const personaCollection = db.collection<PersonaConfig>(collections.personas);
  const legacyPersonas = await personaCollection
    .find(
      {
        $or: [{ nameNormalized: { $exists: false } }, { nameNormalized: "" }]
      },
      { projection: { _id: 1, name: 1 } }
    )
    .toArray();

  for (const persona of legacyPersonas) {
    if (!persona._id) {
      continue;
    }
    await personaCollection.updateOne(
      { _id: persona._id },
      { $set: { nameNormalized: normalizePersonaNameKey(persona.name) } }
    );
  }

  const duplicates = await personaCollection
    .aggregate<{ _id: string; count: number }>([
      {
        $group: {
          _id: "$nameNormalized",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          _id: { $nin: [null, ""] },
          count: { $gt: 1 }
        }
      },
      { $limit: 5 }
    ])
    .toArray();

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate persona names found for normalized keys: ${duplicates
        .map((entry) => entry._id)
        .join(", ")}`
    );
  }

  await personaCollection.createIndex(
    { nameNormalized: 1 },
    { unique: true, name: "uniq_xpersona_name_normalized" }
  );
}

async function createXchatLogIndexes(): Promise<void> {
  const db = await getDb();
  const chatLogCollection = db.collection<XChatSessionLog>(collections.chatLogs);
  await chatLogCollection.createIndex(
    { userId: 1, createdAt: -1, _id: -1 },
    { name: "idx_xchat_logs_user_created_desc" }
  );
  await chatLogCollection.createIndex(
    { tenantId: 1, userId: 1, createdAt: -1, _id: -1 },
    { name: "idx_xchat_logs_tenant_user_created_desc" }
  );
  await chatLogCollection.createIndex(
    { retentionExpiresAt: 1 },
    { expireAfterSeconds: 0, name: "ttl_xchat_logs_retention_expires_at" }
  );
}

export async function listPersonas(): Promise<PersonaConfig[]> {
  await ensurePersonaIndexes();
  const db = await getDb();
  return db
    .collection<PersonaConfig>(collections.personas)
    .find({})
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function createPersona(
  payload: Omit<PersonaConfig, "_id" | "createdAt" | "updatedAt" | "nameNormalized">
): Promise<PersonaConfig> {
  await ensurePersonaIndexes();
  const db = await getDb();
  const now = new Date();
  const document: PersonaConfig = {
    ...payload,
    nameNormalized: normalizePersonaNameKey(payload.name),
    createdAt: now,
    updatedAt: now
  };
  try {
    const result = await db.collection<PersonaConfig>(collections.personas).insertOne(document);
    return { ...document, _id: result.insertedId };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new PersonaNameConflictError();
    }
    throw error;
  }
}

export async function getPersonaById(id: string): Promise<PersonaConfig | null> {
  await ensurePersonaIndexes();
  const db = await getDb();
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return db
    .collection<PersonaConfig>(collections.personas)
    .findOne({ _id: new ObjectId(id) });
}

export async function getPersonaByNormalizedName(
  nameNormalized: string
): Promise<PersonaConfig | null> {
  await ensurePersonaIndexes();
  const db = await getDb();
  const key = nameNormalized.trim().toLowerCase();
  if (!key) {
    return null;
  }
  return db.collection<PersonaConfig>(collections.personas).findOne({ nameNormalized: key });
}

export async function ensureDefaultXfinancePersonaExists(): Promise<PersonaConfig> {
  const key = normalizePersonaNameKey(XPERSONA_XFINANCE_NAME);
  const existing = await getPersonaByNormalizedName(key);
  if (existing) {
    return existing;
  }
  try {
    return await createPersona(buildDefaultXfinancePersonaPayload());
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const again = await getPersonaByNormalizedName(key);
      if (again) {
        return again;
      }
    }
    throw error;
  }
}

/**
 * Default persona when the client does not select one: **Super-Agent** for `global_admin` when seeded;
 * **xFinance** (created if missing) for app_user and other non-admin roles.
 */
export async function resolveDefaultXchatPersonaForSession(
  roles: string[]
): Promise<PersonaConfig | null> {
  if (isGlobalAdmin(roles)) {
    const superAgent = await getPersonaByNormalizedName(
      normalizePersonaNameKey(XPERSONA_SUPER_AGENT_NAME)
    );
    if (superAgent) {
      return superAgent;
    }
  }
  return ensureDefaultXfinancePersonaExists();
}

export async function updatePersona(
  id: string,
  payload: Partial<Omit<PersonaConfig, "_id" | "createdAt" | "updatedAt" | "nameNormalized">>
): Promise<PersonaConfig | null> {
  await ensurePersonaIndexes();
  const db = await getDb();
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const _id = new ObjectId(id);
  const setPayload: Partial<PersonaConfig> = {
    ...payload,
    updatedAt: new Date()
  };
  if (payload.name !== undefined) {
    setPayload.nameNormalized = normalizePersonaNameKey(payload.name);
  }

  try {
    await db.collection<PersonaConfig>(collections.personas).updateOne(
      { _id },
      {
        $set: setPayload
      }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new PersonaNameConflictError();
    }
    throw error;
  }

  return db.collection<PersonaConfig>(collections.personas).findOne({ _id });
}

export async function deletePersona(id: string): Promise<boolean> {
  await ensurePersonaIndexes();
  const db = await getDb();
  if (!ObjectId.isValid(id)) {
    return false;
  }
  const result = await db
    .collection<PersonaConfig>(collections.personas)
    .deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

export async function createRagFile(
  payload: Omit<RagSourceFile, "_id" | "createdAt">
): Promise<RagSourceFile> {
  const db = await getDb();
  const document: RagSourceFile = {
    ...payload,
    createdAt: new Date()
  };
  const result = await db.collection<RagSourceFile>(collections.ragFiles).insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function listRagFiles(input?: {
  scope?: string;
  tenantId?: ObjectId;
}): Promise<RagSourceFile[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (input?.scope) {
    query.scope = input.scope;
  }
  if (input?.tenantId) {
    query.$or = [{ tenantId: input.tenantId }, { tenantId: { $exists: false } }];
  }
  return db
    .collection<RagSourceFile>(collections.ragFiles)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
}

export async function getRagFileById(fileId: ObjectId): Promise<RagSourceFile | null> {
  const db = await getDb();
  return db.collection<RagSourceFile>(collections.ragFiles).findOne({ _id: fileId });
}

export async function updateRagFileProcessingState(
  fileId: ObjectId,
  payload: Pick<RagSourceFile, "xaiProcessingStatus" | "xaiProcessingCheckedAt" | "xaiUploadError">
): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection<RagSourceFile>(collections.ragFiles).updateOne(
    { _id: fileId },
    {
      $set: {
        xaiProcessingStatus: payload.xaiProcessingStatus,
        xaiProcessingCheckedAt: payload.xaiProcessingCheckedAt,
        xaiUploadError: payload.xaiUploadError
      }
    }
  );
  return result.modifiedCount === 1;
}

export async function replaceRagChunks(
  fileId: ObjectId,
  scope: string,
  identity: { userId?: ObjectId; tenantId?: ObjectId },
  chunks: Array<{ text: string; tokenEstimate: number }>
): Promise<number> {
  const db = await getDb();
  await db.collection<RagChunk>(collections.ragChunks).deleteMany({ fileId });
  if (chunks.length === 0) {
    return 0;
  }

  const docs: RagChunk[] = chunks.map((chunk, index) => ({
    fileId,
    userId: identity.userId,
    tenantId: identity.tenantId,
    scope,
    chunkIndex: index,
    text: chunk.text,
    tokenEstimate: chunk.tokenEstimate,
    createdAt: new Date()
  }));

  const result = await db.collection<RagChunk>(collections.ragChunks).insertMany(docs);
  return result.insertedCount;
}

export async function retrieveRagChunks(
  tenantId: ObjectId | null,
  scope: string,
  query: string,
  limit: number
): Promise<RagChunk[]> {
  const db = await getDb();
  const queryWords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length >= 3)
    .slice(0, 8);

  if (queryWords.length === 0) {
    return db
      .collection<RagChunk>(collections.ragChunks)
      .find(
        tenantId
          ? {
              scope,
              $or: [{ tenantId }, { tenantId: { $exists: false } }]
            }
          : { scope }
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  const regex = new RegExp(queryWords.map((word) => escapeRegex(word)).join("|"), "i");
  return db
    .collection<RagChunk>(collections.ragChunks)
    .find(
      tenantId
        ? {
            scope,
            text: { $regex: regex },
            $or: [{ tenantId }, { tenantId: { $exists: false } }]
          }
        : { scope, text: { $regex: regex } }
    )
    .limit(limit)
    .toArray();
}

export async function saveXChatLog(
  payload: Omit<XChatSessionLog, "_id" | "createdAt">
): Promise<void> {
  await ensureXchatLogIndexes();
  const db = await getDb();
  const createdAt = new Date();
  const retentionExpiresAt =
    payload.retentionExpiresAt ??
    new Date(createdAt.getTime() + XCHAT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.collection<XChatSessionLog>(collections.chatLogs).insertOne({
    ...payload,
    createdAt,
    retentionExpiresAt
  });
}

export async function listXChatHistoryByUser(input: {
  userId: ObjectId;
  tenantId?: ObjectId | null;
  limit: number;
  before?: Date;
  beforeId?: ObjectId;
}): Promise<XChatHistoryItem[]> {
  await ensureXchatLogIndexes();
  const db = await getDb();
  const query: Record<string, unknown> = {
    userId: input.userId
  };
  if (input.before) {
    if (input.beforeId) {
      query.$or = [
        { createdAt: { $lt: input.before } },
        { createdAt: input.before, _id: { $lt: input.beforeId } }
      ];
    } else {
      query.createdAt = { $lt: input.before };
    }
  }
  const scopedQuery = withTenantScopeForLogs(query, input.tenantId);
  const logs = await db
    .collection<XChatSessionLog>(collections.chatLogs)
    .find(scopedQuery)
    .sort({ createdAt: -1, _id: -1 })
    .limit(input.limit)
    .toArray();

  return logs.map((log) => ({
    id: log._id?.toHexString() ?? "",
    message: log.message,
    response: log.response,
    model: log.model,
    createdAt: log.createdAt,
    personaId: log.personaId?.toHexString(),
    contextReferenceCount: log.collectionContextReferences?.length ?? 0,
    toolCallCount: log.xapiToolCalls?.length ?? 0
  }));
}

export async function getXChatHistoryStatsByUser(input: {
  userId: ObjectId;
  tenantId?: ObjectId | null;
}): Promise<XChatHistoryStats> {
  await ensureXchatLogIndexes();
  const db = await getDb();
  const match = withTenantScopeForLogs({ userId: input.userId }, input.tenantId);

  const totals = await db
    .collection<XChatSessionLog>(collections.chatLogs)
    .aggregate<{
      totalPrompts: number;
      lastPromptAt?: Date;
      activeDays: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPrompts: { $sum: 1 },
          lastPromptAt: { $max: "$createdAt" },
          days: {
            $addToSet: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalPrompts: 1,
          lastPromptAt: 1,
          activeDays: { $size: "$days" }
        }
      }
    ])
    .toArray();

  const referencedFiles = await db
    .collection<XChatSessionLog>(collections.chatLogs)
    .aggregate<{ referencedFileCount: number }>([
      { $match: match },
      { $unwind: { path: "$collectionContextReferences", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          refKey: {
            $ifNull: [
              "$collectionContextReferences.documentId",
              "$collectionContextReferences.documentName"
            ]
          }
        }
      },
      { $match: { refKey: { $type: "string" } } },
      { $group: { _id: "$refKey" } },
      { $group: { _id: null, referencedFileCount: { $sum: 1 } } },
      { $project: { _id: 0, referencedFileCount: 1 } }
    ])
    .toArray();

  const totalRow = totals[0];
  return {
    totalPrompts: totalRow?.totalPrompts ?? 0,
    activeDays: totalRow?.activeDays ?? 0,
    referencedFileCount: referencedFiles[0]?.referencedFileCount ?? 0,
    lastPromptAt: totalRow?.lastPromptAt
  };
}

export async function updatePersonasCollectionVerification(
  collectionId: string,
  verification: PersonaCollectionVerification
): Promise<number> {
  await ensurePersonaIndexes();
  const db = await getDb();
  const result = await db.collection<PersonaConfig>(collections.personas).updateMany(
    { "xaiCollection.collectionId": collectionId.trim() },
    {
      $set: {
        xaiCollectionVerification: verification,
        updatedAt: new Date()
      }
    }
  );
  return result.modifiedCount;
}

export async function listPersonasByStatus(status: PersonaStatus): Promise<PersonaConfig[]> {
  await ensurePersonaIndexes();
  const db = await getDb();
  return db
    .collection<PersonaConfig>(collections.personas)
    .find({ status })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function publishPersona(
  id: string,
  actor: PersonaVersionSnapshot["actor"]
): Promise<PersonaConfig | null> {
  await ensurePersonaIndexes();
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;

  const _id = new ObjectId(id);
  const persona = await db.collection<PersonaConfig>(collections.personas).findOne({ _id });
  if (!persona) return null;

  const nextVersion = (persona.version ?? 0) + 1;
  const now = new Date();

  const { _id: _personaOid, ...personaFields } = persona;
  void _personaOid;
  const snapshot: PersonaVersionSnapshot = {
    personaId: _id,
    version: nextVersion,
    snapshot: personaFields,
    action: "published",
    actor,
    createdAt: now
  };
  await db.collection<PersonaVersionSnapshot>(collections.personaVersions).insertOne(snapshot);

  await db.collection<PersonaConfig>(collections.personas).updateOne(
    { _id },
    { $set: { status: "published" as const, version: nextVersion, publishedAt: now, updatedAt: now } }
  );

  return db.collection<PersonaConfig>(collections.personas).findOne({ _id });
}

export async function archivePersona(
  id: string,
  actor: PersonaVersionSnapshot["actor"]
): Promise<PersonaConfig | null> {
  await ensurePersonaIndexes();
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;

  const _id = new ObjectId(id);
  const persona = await db.collection<PersonaConfig>(collections.personas).findOne({ _id });
  if (!persona) return null;

  const now = new Date();
  const { _id: _archiveOid, ...archiveFields } = persona;
  void _archiveOid;
  const snapshot: PersonaVersionSnapshot = {
    personaId: _id,
    version: persona.version ?? 0,
    snapshot: archiveFields,
    action: "archived",
    actor,
    createdAt: now
  };
  await db.collection<PersonaVersionSnapshot>(collections.personaVersions).insertOne(snapshot);

  await db.collection<PersonaConfig>(collections.personas).updateOne(
    { _id },
    { $set: { status: "archived" as const, updatedAt: now } }
  );

  return db.collection<PersonaConfig>(collections.personas).findOne({ _id });
}

export async function rollbackPersona(
  id: string,
  targetVersion: number,
  actor: PersonaVersionSnapshot["actor"]
): Promise<PersonaConfig | null> {
  await ensurePersonaIndexes();
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;

  const _id = new ObjectId(id);
  const versionDoc = await db
    .collection<PersonaVersionSnapshot>(collections.personaVersions)
    .findOne({ personaId: _id, version: targetVersion });

  if (!versionDoc) return null;

  const now = new Date();
  const currentPersona = await db.collection<PersonaConfig>(collections.personas).findOne({ _id });
  if (!currentPersona) return null;

  const rollbackSnapshot: PersonaVersionSnapshot = {
    personaId: _id,
    version: (currentPersona.version ?? 0) + 1,
    snapshot: { ...versionDoc.snapshot },
    action: "rolled_back",
    actor,
    createdAt: now
  };
  await db.collection<PersonaVersionSnapshot>(collections.personaVersions).insertOne(rollbackSnapshot);

  const restoreFields = versionDoc.snapshot;
  await db.collection<PersonaConfig>(collections.personas).updateOne(
    { _id },
    {
      $set: {
        ...restoreFields,
        status: "published" as const,
        version: rollbackSnapshot.version,
        publishedAt: now,
        updatedAt: now
      }
    }
  );

  return db.collection<PersonaConfig>(collections.personas).findOne({ _id });
}

export async function listPersonaVersions(
  personaId: string,
  limit = 20
): Promise<PersonaVersionSnapshot[]> {
  const db = await getDb();
  if (!ObjectId.isValid(personaId)) return [];
  return db
    .collection<PersonaVersionSnapshot>(collections.personaVersions)
    .find({ personaId: new ObjectId(personaId) })
    .sort({ version: -1 })
    .limit(limit)
    .toArray();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizePersonaNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

function withTenantScopeForLogs(
  query: Record<string, unknown>,
  tenantId?: ObjectId | null
): Record<string, unknown> {
  if (!tenantId) {
    return query;
  }
  const tenantScope: Record<string, unknown> = {
    $or: [{ tenantId }, { tenantId: { $exists: false } }]
  };
  if ("$or" in query || "$and" in query) {
    return {
      $and: [query, tenantScope]
    };
  }
  return {
    ...query,
    ...tenantScope
  };
}
