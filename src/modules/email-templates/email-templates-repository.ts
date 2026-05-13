import { type Collection, type Db, ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import {
    type CreateEmailTemplatePayload,
    EMAIL_TEMPLATE_SLUGS,
    type EmailTemplate,
    type EmailTemplateSlug,
    isEmailTemplateSlug,
    type UpdateEmailTemplatePayload
} from "@/modules/email-templates/types";

export const EMAIL_TEMPLATES_COLLECTION = "email_templates";

type EmailTemplateDoc = Omit<EmailTemplate, "_id" | "tenantId"> & {
  _id?: ObjectId;
  tenantId: ObjectId | null;
};

function toDomain(raw: EmailTemplateDoc | null): EmailTemplate | null {
  if (!raw) {
    return null;
  }
  if (!isEmailTemplateSlug(raw.slug)) {
    return null;
  }
  return {
    _id: raw._id,
    slug: raw.slug,
    version: raw.version,
    tenantId: raw.tenantId ?? null,
    subject: raw.subject,
    body: raw.body,
    active: Boolean(raw.active),
    defaultCadence: raw.defaultCadence,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

async function getCollection(): Promise<Collection<EmailTemplateDoc>> {
  const db = await getDb();
  return db.collection<EmailTemplateDoc>(EMAIL_TEMPLATES_COLLECTION);
}

/** Resolver helper: tenant override else global default else null. */
export async function findActiveEmailTemplate(input: {
  slug: EmailTemplateSlug;
  tenantId: ObjectId | string | null | undefined;
}): Promise<EmailTemplate | null> {
  const coll = await getCollection();
  const tenantId = normalizeTenantId(input.tenantId);
  if (tenantId) {
    const tenantDoc = await coll.findOne({ slug: input.slug, tenantId, active: true });
    const tenant = toDomain(tenantDoc as EmailTemplateDoc | null);
    if (tenant) {
      return tenant;
    }
  }
  const globalDoc = await coll.findOne({ slug: input.slug, tenantId: null, active: true });
  return toDomain(globalDoc as EmailTemplateDoc | null);
}

export async function listEmailTemplates(input?: {
  tenantId?: ObjectId | string | null;
  /** When true, include both tenant rows and global defaults; otherwise tenant rows only. */
  includeGlobalDefaults?: boolean;
}): Promise<EmailTemplate[]> {
  const coll = await getCollection();
  const tenantId = normalizeTenantId(input?.tenantId);
  const filter: Record<string, unknown> = {};
  if (input?.includeGlobalDefaults) {
    filter.$or = [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])];
  } else if (tenantId !== null) {
    filter.tenantId = tenantId;
  } else {
    filter.tenantId = null;
  }
  const rows = await coll.find(filter).sort({ slug: 1, tenantId: 1 }).toArray();
  return rows
    .map((r) => toDomain(r as EmailTemplateDoc))
    .filter((r): r is EmailTemplate => r !== null);
}

export async function getEmailTemplateBySlug(input: {
  slug: EmailTemplateSlug;
  tenantId: ObjectId | string | null;
}): Promise<EmailTemplate | null> {
  const coll = await getCollection();
  const tenantId = normalizeTenantId(input.tenantId);
  const row = await coll.findOne({ slug: input.slug, tenantId });
  return toDomain(row as EmailTemplateDoc | null);
}

export class EmailTemplateConflictError extends Error {
  readonly code = "email_template_conflict";
  constructor(message: string) {
    super(message);
    this.name = "EmailTemplateConflictError";
  }
}

export async function createEmailTemplate(
  payload: CreateEmailTemplatePayload
): Promise<EmailTemplate> {
  const coll = await getCollection();
  const tenantId = normalizeTenantId(payload.tenantId ?? null);
  const existing = await coll.findOne({ slug: payload.slug, tenantId });
  if (existing) {
    throw new EmailTemplateConflictError(
      `email_template already exists for slug=${payload.slug} tenantId=${tenantId?.toHexString() ?? "null"}`
    );
  }
  const now = new Date();
  const doc: EmailTemplateDoc = {
    slug: payload.slug,
    version: payload.version,
    tenantId,
    subject: payload.subject,
    body: payload.body,
    active: payload.active,
    defaultCadence: payload.defaultCadence,
    createdAt: now,
    updatedAt: now
  };
  const result = await coll.insertOne(doc);
  const created = toDomain({ ...doc, _id: result.insertedId });
  if (!created) {
    throw new Error("createEmailTemplate: failed to round-trip created document");
  }
  return created;
}

export async function updateEmailTemplate(input: {
  slug: EmailTemplateSlug;
  tenantId: ObjectId | string | null;
  patch: UpdateEmailTemplatePayload;
}): Promise<EmailTemplate | null> {
  const coll = await getCollection();
  const tenantId = normalizeTenantId(input.tenantId);
  const $set: Partial<EmailTemplateDoc> = { updatedAt: new Date() };
  if (input.patch.version !== undefined) {
    $set.version = input.patch.version;
  }
  if (input.patch.subject !== undefined) {
    $set.subject = input.patch.subject;
  }
  if (input.patch.body !== undefined) {
    $set.body = input.patch.body;
  }
  if (input.patch.active !== undefined) {
    $set.active = input.patch.active;
  }
  if (input.patch.defaultCadence !== undefined) {
    $set.defaultCadence = input.patch.defaultCadence;
  }
  const updated = await coll.findOneAndUpdate(
    { slug: input.slug, tenantId },
    { $set },
    { returnDocument: "after" }
  );
  return toDomain(updated as EmailTemplateDoc | null);
}

export async function deleteEmailTemplate(input: {
  slug: EmailTemplateSlug;
  tenantId: ObjectId | string | null;
}): Promise<boolean> {
  const coll = await getCollection();
  const tenantId = normalizeTenantId(input.tenantId);
  const result = await coll.deleteOne({ slug: input.slug, tenantId });
  return result.deletedCount === 1;
}

function normalizeTenantId(value: ObjectId | string | null | undefined): ObjectId | null {
  if (!value) {
    return null;
  }
  if (value instanceof ObjectId) {
    return value;
  }
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

/** Idempotent index init — call from `seed:admin` or admin bootstrap. */
export async function ensureEmailTemplateIndexes(db: Db): Promise<void> {
  const coll = db.collection(EMAIL_TEMPLATES_COLLECTION);
  await coll.createIndex(
    { slug: 1, tenantId: 1 },
    { unique: true, name: "uniq_email_templates_slug_tenant" }
  );
  await coll.createIndex(
    { slug: 1, tenantId: 1, active: 1 },
    { name: "idx_email_templates_slug_tenant_active" }
  );
}

export const EMAIL_TEMPLATE_SLUG_VALUES: ReadonlyArray<EmailTemplateSlug> = EMAIL_TEMPLATE_SLUGS;
