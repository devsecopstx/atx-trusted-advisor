import { ObjectId } from "mongodb";
import { z } from "zod";

import { getCurrentAdvisorDisclosureBundle } from "@/lib/advisor-disclosures";
import { getDb } from "@/lib/mongodb";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    isAdvisorComplianceComplete,
    normalizeAdvisorComplianceProfile,
    parseAdvisorComplianceProfileFromUserDoc
} from "@/modules/compliance/advisor-compliance";
import { uploadFinraCredentialEvidenceToUserXchatHistory } from "@/modules/compliance/finra-evidence-upload";
import {
    finraRegistrationBodySchema,
    finraRegistrationPatchSchema
} from "@/modules/compliance/finra-registration-schema";
import type {
    AdvisorComplianceProfile,
    AdvisorFinraEvidenceDocument,
    AdvisorFinraRegistration,
    AdvisorFinraRegistrationStatus,
    AdvisorLicenseType
} from "@/modules/compliance/types";
import type { CoreUser } from "@/modules/identity/types";
import { upsertXchatUserPreferences } from "@/modules/xchat/user-preferences-repository";

const collections = {
  users: "core_users",
  finraRegistrations: "advisor_finra_registrations"
} as const;

let ensureIndexesPromise: Promise<void> | null = null;

export async function ensureComplianceIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = createComplianceIndexes();
  }
  await ensureIndexesPromise;
}

async function createComplianceIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection(collections.finraRegistrations).createIndex(
    { tenantId: 1, advisorUserId: 1, updatedAt: -1 },
    { name: "tenant_advisor_finra_updated" }
  );
}

export async function getAdvisorComplianceProfileForUser(
  userId: string
): Promise<AdvisorComplianceProfile | null> {
  if (!ObjectId.isValid(userId)) {
    return null;
  }
  const db = await getDb();
  const row = await db.collection<CoreUser>(collections.users).findOne(
    { _id: new ObjectId(userId) },
    { projection: { advisorComplianceProfile: 1 } }
  );
  return parseAdvisorComplianceProfileFromUserDoc(row?.advisorComplianceProfile);
}

export async function countActiveFinraRegistrationsForAdvisor(input: {
  tenantId: string;
  advisorUserId: string;
}): Promise<number> {
  if (!ObjectId.isValid(input.tenantId) || !ObjectId.isValid(input.advisorUserId)) {
    return 0;
  }
  await ensureComplianceIndexes();
  const db = await getDb();
  return db.collection<AdvisorFinraRegistration>(collections.finraRegistrations).countDocuments({
    tenantId: new ObjectId(input.tenantId),
    advisorUserId: new ObjectId(input.advisorUserId),
    status: "active"
  });
}

async function resolveAdvisorComplianceCompleteState(input: {
  userId: string;
  tenantId: string;
}): Promise<{
  profile: AdvisorComplianceProfile | null;
  finraRegistrationCount: number;
  complete: boolean;
}> {
  const profile = await getAdvisorComplianceProfileForUser(input.userId);
  const finraRegistrationCount = await countActiveFinraRegistrationsForAdvisor({
    tenantId: input.tenantId,
    advisorUserId: input.userId
  });
  return {
    profile,
    finraRegistrationCount,
    complete: isAdvisorComplianceComplete({ profile, finraRegistrationCount })
  };
}

async function recordAdvisorComplianceCompletionIfNeeded(input: {
  userId: string;
  tenantId: string;
  email: string;
  wasCompleteBefore: boolean;
}): Promise<void> {
  const state = await resolveAdvisorComplianceCompleteState({
    userId: input.userId,
    tenantId: input.tenantId
  });
  if (!state.complete || input.wasCompleteBefore || !state.profile) {
    return;
  }

  const now = new Date();
  const bundle = getCurrentAdvisorDisclosureBundle();
  const db = await getDb();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: new ObjectId(input.userId) },
    {
      $set: {
        "advisorComplianceProfile.complianceCompletedAt": now,
        "advisorComplianceProfile.updatedAt": now,
        updatedAt: now
      }
    }
  );

  await createAuditEvent({
    entityType: "core_user",
    entityId: input.userId,
    action: "advisor_compliance_completed",
    actor: { userId: input.userId, email: input.email },
    details: {
      tenantId: input.tenantId,
      disclosureVersion: bundle.version,
      attestationAcceptedAt: state.profile.attestationAcceptedAt?.toISOString() ?? null,
      aiDisclosureAcceptedAt: state.profile.aiDisclosureAcceptedAt?.toISOString() ?? null,
      complianceCompletedAt: now.toISOString(),
      finraRegistrationCount: state.finraRegistrationCount
    }
  });
}

const advisorAckBodySchema = z.object({
  complianceContactEmail: z.preprocess((value) => {
    if (value == null) {
      return undefined;
    }
    const trimmed = String(value).trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = z.string().email().max(320).safeParse(trimmed);
    return parsed.success ? parsed.data : undefined;
  }, z.string().email().max(320).optional()),
  attestationAccepted: z.literal(true),
  acceptAiDisclosure: z.literal(true)
});

export async function upsertAdvisorComplianceAcknowledgments(input: {
  userId: string;
  tenantId: string;
  email: string;
  body: unknown;
}): Promise<{ profile: AdvisorComplianceProfile } | { error: string }> {
  const parsed = advisorAckBodySchema.safeParse(input.body);
  if (!parsed.success) {
    return { error: "invalid_request" };
  }
  if (!ObjectId.isValid(input.userId)) {
    return { error: "invalid_user" };
  }

  const beforeComplete = await resolveAdvisorComplianceCompleteState({
    userId: input.userId,
    tenantId: input.tenantId
  });

  const now = new Date();
  const bundle = getCurrentAdvisorDisclosureBundle();
  const profile: AdvisorComplianceProfile = normalizeAdvisorComplianceProfile(
    {
      complianceContactEmail: parsed.data.complianceContactEmail,
      attestationAccepted: true,
      attestationAcceptedAt: now,
      aiDisclosureVersionAccepted: bundle.version,
      aiDisclosureAcceptedAt: now,
      updatedAt: now
    },
    now
  )!;

  const db = await getDb();
  await db.collection<CoreUser>(collections.users).updateOne(
    { _id: new ObjectId(input.userId) },
    {
      $set: {
        advisorComplianceProfile: profile,
        updatedAt: now
      }
    }
  );

  const tenantObjectId = ObjectId.isValid(input.tenantId) ? new ObjectId(input.tenantId) : null;
  await upsertXchatUserPreferences({
    userId: new ObjectId(input.userId),
    tenantId: tenantObjectId,
    keepLastTenMessages: true
  });

  await createAuditEvent({
    entityType: "core_user",
    entityId: input.userId,
    action: "advisor_compliance_ack_updated",
    actor: { userId: input.userId, email: input.email },
    details: {
      tenantId: input.tenantId,
      disclosureVersion: bundle.version,
      attestationAcceptedAt: now.toISOString(),
      aiDisclosureAcceptedAt: now.toISOString(),
      chatHistoryRetentionEnabled: true
    }
  });

  await recordAdvisorComplianceCompletionIfNeeded({
    userId: input.userId,
    tenantId: input.tenantId,
    email: input.email,
    wasCompleteBefore: beforeComplete.complete
  });

  const savedProfile = await getAdvisorComplianceProfileForUser(input.userId);
  return { profile: savedProfile ?? profile };
}

export async function listFinraRegistrationsForAdvisor(input: {
  tenantId: string;
  advisorUserId: string;
  limit?: number;
}): Promise<AdvisorFinraRegistration[]> {
  if (!ObjectId.isValid(input.tenantId) || !ObjectId.isValid(input.advisorUserId)) {
    return [];
  }
  await ensureComplianceIndexes();
  const db = await getDb();
  return db
    .collection<AdvisorFinraRegistration>(collections.finraRegistrations)
    .find({
      tenantId: new ObjectId(input.tenantId),
      advisorUserId: new ObjectId(input.advisorUserId)
    })
    .sort({ updatedAt: -1 })
    .limit(input.limit ?? 50)
    .toArray();
}

export async function createFinraRegistration(input: {
  tenantId: string;
  advisorUserId: string;
  email: string;
  body: unknown;
  evidenceFile?: {
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
  };
  evidenceFiles?: Array<{
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
  }>;
}): Promise<{ registration: AdvisorFinraRegistration } | { error: string }> {
  const parsed = finraRegistrationBodySchema.safeParse(input.body);
  if (!parsed.success) {
    return { error: "invalid_request" };
  }
  if (!ObjectId.isValid(input.tenantId) || !ObjectId.isValid(input.advisorUserId)) {
    return { error: "invalid_scope" };
  }

  const beforeComplete = await resolveAdvisorComplianceCompleteState({
    userId: input.advisorUserId,
    tenantId: input.tenantId
  });

  const uploadCandidates = [
    ...(input.evidenceFiles ?? []),
    ...(input.evidenceFile ? [input.evidenceFile] : [])
  ];
  const evidenceDocuments: AdvisorFinraEvidenceDocument[] = [];
  let evidenceFields: Pick<
    AdvisorFinraRegistration,
    "evidenceFilename" | "evidenceXaiFileId" | "evidenceRagFileId" | "evidenceCollectionId"
  > = {};

  for (const file of uploadCandidates) {
    const uploaded = await uploadFinraCredentialEvidenceToUserXchatHistory({
      userId: input.advisorUserId,
      tenantId: input.tenantId,
      email: input.email,
      filename: file.filename,
      mimeType: file.mimeType,
      bytes: file.bytes
    });
    if ("error" in uploaded) {
      return { error: uploaded.error };
    }
    const document: AdvisorFinraEvidenceDocument = {
      evidenceFilename: uploaded.evidenceFilename,
      evidenceXaiFileId: uploaded.evidenceXaiFileId,
      evidenceRagFileId: uploaded.evidenceRagFileId.toHexString(),
      evidenceCollectionId: uploaded.evidenceCollectionId,
      linkedToCollection: uploaded.linkedToCollection
    };
    evidenceDocuments.push(document);
    if (!evidenceFields.evidenceFilename) {
      evidenceFields = {
        evidenceFilename: uploaded.evidenceFilename,
        evidenceXaiFileId: uploaded.evidenceXaiFileId,
        evidenceRagFileId: uploaded.evidenceRagFileId,
        evidenceCollectionId: uploaded.evidenceCollectionId
      };
    }
  }

  const now = new Date();
  const registration: AdvisorFinraRegistration = {
    tenantId: new ObjectId(input.tenantId),
    advisorUserId: new ObjectId(input.advisorUserId),
    crdNumber: parsed.data.crdNumber,
    licenseType: parsed.data.licenseType as AdvisorLicenseType,
    jurisdiction: parsed.data.jurisdiction,
    evidenceUrl: parsed.data.evidenceUrl ?? null,
    ...evidenceFields,
    evidenceDocuments: evidenceDocuments.length > 0 ? evidenceDocuments : null,
    notes: parsed.data.notes ?? null,
    status: (parsed.data.status ?? "active") as AdvisorFinraRegistrationStatus,
    createdAt: now,
    updatedAt: now
  };

  await ensureComplianceIndexes();
  const db = await getDb();
  const result = await db
    .collection<AdvisorFinraRegistration>(collections.finraRegistrations)
    .insertOne(registration);
  const saved = { ...registration, _id: result.insertedId };

  await createAuditEvent({
    entityType: "core_user",
    entityId: input.advisorUserId,
    action: "advisor_finra_registration_created",
    actor: { userId: input.advisorUserId, email: input.email },
    details: {
      tenantId: input.tenantId,
      registrationId: result.insertedId.toHexString(),
      licenseType: saved.licenseType,
      jurisdiction: saved.jurisdiction,
      evidenceUrl: saved.evidenceUrl ?? null,
      evidenceFilename: saved.evidenceFilename ?? null,
      evidenceCollectionId: saved.evidenceCollectionId ?? null,
      evidenceDocumentCount: saved.evidenceDocuments?.length ?? 0,
      registrationCreatedAt: saved.createdAt.toISOString()
    }
  });

  await recordAdvisorComplianceCompletionIfNeeded({
    userId: input.advisorUserId,
    tenantId: input.tenantId,
    email: input.email,
    wasCompleteBefore: beforeComplete.complete
  });

  return { registration: saved };
}

export async function updateFinraRegistration(input: {
  tenantId: string;
  advisorUserId: string;
  registrationId: string;
  email: string;
  body: unknown;
}): Promise<{ registration: AdvisorFinraRegistration } | { error: string }> {
  const parsed = finraRegistrationPatchSchema.safeParse(input.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return { error: "invalid_request" };
  }
  if (
    !ObjectId.isValid(input.tenantId) ||
    !ObjectId.isValid(input.advisorUserId) ||
    !ObjectId.isValid(input.registrationId)
  ) {
    return { error: "invalid_scope" };
  }

  const beforeComplete = await resolveAdvisorComplianceCompleteState({
    userId: input.advisorUserId,
    tenantId: input.tenantId
  });

  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      $set[key] = value;
    }
  }

  await ensureComplianceIndexes();
  const db = await getDb();
  const result = await db
    .collection<AdvisorFinraRegistration>(collections.finraRegistrations)
    .findOneAndUpdate(
      {
        _id: new ObjectId(input.registrationId),
        tenantId: new ObjectId(input.tenantId),
        advisorUserId: new ObjectId(input.advisorUserId)
      },
      { $set },
      { returnDocument: "after" }
    );

  if (!result) {
    return { error: "not_found" };
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: input.advisorUserId,
    action: "advisor_finra_registration_updated",
    actor: { userId: input.advisorUserId, email: input.email },
    details: {
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      registrationUpdatedAt: now.toISOString()
    }
  });

  await recordAdvisorComplianceCompletionIfNeeded({
    userId: input.advisorUserId,
    tenantId: input.tenantId,
    email: input.email,
    wasCompleteBefore: beforeComplete.complete
  });

  return { registration: result };
}

export async function deleteFinraRegistration(input: {
  tenantId: string;
  advisorUserId: string;
  registrationId: string;
  email: string;
}): Promise<{ ok: true } | { error: string }> {
  if (
    !ObjectId.isValid(input.tenantId) ||
    !ObjectId.isValid(input.advisorUserId) ||
    !ObjectId.isValid(input.registrationId)
  ) {
    return { error: "invalid_scope" };
  }

  await ensureComplianceIndexes();
  const db = await getDb();
  const result = await db.collection<AdvisorFinraRegistration>(collections.finraRegistrations).deleteOne({
    _id: new ObjectId(input.registrationId),
    tenantId: new ObjectId(input.tenantId),
    advisorUserId: new ObjectId(input.advisorUserId)
  });

  if (result.deletedCount !== 1) {
    return { error: "not_found" };
  }

  await createAuditEvent({
    entityType: "core_user",
    entityId: input.advisorUserId,
    action: "advisor_finra_registration_deleted",
    actor: { userId: input.advisorUserId, email: input.email },
    details: {
      tenantId: input.tenantId,
      registrationId: input.registrationId
    }
  });

  return { ok: true };
}

export function serializeFinraRegistration(row: AdvisorFinraRegistration) {
  return {
    id: row._id?.toHexString() ?? "",
    crdNumber: row.crdNumber,
    licenseType: row.licenseType,
    jurisdiction: row.jurisdiction,
    evidenceUrl: row.evidenceUrl ?? null,
    evidenceFilename: row.evidenceFilename ?? null,
    evidenceXaiFileId: row.evidenceXaiFileId ?? null,
    evidenceRagFileId: row.evidenceRagFileId?.toHexString() ?? null,
    evidenceCollectionId: row.evidenceCollectionId ?? null,
    evidenceDocuments: (row.evidenceDocuments ?? []).map((doc) => ({
      evidenceFilename: doc.evidenceFilename,
      evidenceXaiFileId: doc.evidenceXaiFileId,
      evidenceRagFileId: doc.evidenceRagFileId ?? null,
      evidenceCollectionId: doc.evidenceCollectionId ?? null,
      linkedToCollection: doc.linkedToCollection ?? null
    })),
    notes: row.notes ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function serializeAdvisorComplianceProfile(profile: AdvisorComplianceProfile | null) {
  if (!profile) {
    return null;
  }
  return {
    complianceContactEmail: profile.complianceContactEmail ?? null,
    attestationAccepted: profile.attestationAccepted,
    attestationAcceptedAt: profile.attestationAcceptedAt?.toISOString() ?? null,
    aiDisclosureVersionAccepted: profile.aiDisclosureVersionAccepted ?? null,
    aiDisclosureAcceptedAt: profile.aiDisclosureAcceptedAt?.toISOString() ?? null,
    complianceCompletedAt: profile.complianceCompletedAt?.toISOString() ?? null,
    updatedAt: profile.updatedAt.toISOString()
  };
}

/** @deprecated Use upsertAdvisorComplianceAcknowledgments */
export const upsertAdvisorComplianceProfile = upsertAdvisorComplianceAcknowledgments;
