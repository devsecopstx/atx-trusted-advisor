import { MongoServerError, ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import type {
  PersonaCollectionVerification,
  PersonaConfig,
  RagChunk,
  RagSourceFile,
  XChatSessionLog
} from "@/modules/xchat/types";

const collections = {
  personas: "xchat_personas",
  ragFiles: "xchat_rag_files",
  ragChunks: "xchat_rag_chunks",
  chatLogs: "xchat_logs"
} as const;

let ensurePersonaIndexesPromise: Promise<void> | null = null;

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
      { $set: { nameNormalized: normalizePersonaName(persona.name) } }
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
    nameNormalized: normalizePersonaName(payload.name),
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
    setPayload.nameNormalized = normalizePersonaName(payload.name);
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
  const db = await getDb();
  await db.collection<XChatSessionLog>(collections.chatLogs).insertOne({
    ...payload,
    createdAt: new Date()
  });
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePersonaName(name: string): string {
  return name.trim().toLowerCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}
