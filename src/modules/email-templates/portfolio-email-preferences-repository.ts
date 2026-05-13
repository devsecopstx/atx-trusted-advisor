import { ObjectId, type Collection, type Db } from "mongodb";

import { getDb } from "@/lib/mongodb";
import {
    isEmailTemplateSlug,
    type EmailDigestCadence,
    type EmailTemplateSlug,
    type PortfolioEmailPreference,
    type UpdatePortfolioEmailPreferencePayload
} from "@/modules/email-templates/types";

export const PORTFOLIO_EMAIL_PREFERENCES_COLLECTION = "portfolio_email_preferences";

type PreferenceDoc = Omit<PortfolioEmailPreference, "_id">;

async function getCollection(): Promise<Collection<PreferenceDoc>> {
  const db = await getDb();
  return db.collection<PreferenceDoc>(PORTFOLIO_EMAIL_PREFERENCES_COLLECTION);
}

function toDomain(raw: (PreferenceDoc & { _id?: ObjectId }) | null): PortfolioEmailPreference | null {
  if (!raw) {
    return null;
  }
  if (!isEmailTemplateSlug(raw.templateSlug)) {
    return null;
  }
  return {
    _id: raw._id,
    tenantId: raw.tenantId,
    portfolioId: raw.portfolioId,
    templateSlug: raw.templateSlug,
    enabled: Boolean(raw.enabled),
    cadenceOverride: raw.cadenceOverride,
    subjectOverride: raw.subjectOverride,
    bodyOverride: raw.bodyOverride,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

function asObjectId(value: ObjectId | string): ObjectId {
  return value instanceof ObjectId ? value : new ObjectId(value);
}

export async function listPortfolioEmailPreferences(input: {
  tenantId: ObjectId | string;
  portfolioId: ObjectId | string;
}): Promise<PortfolioEmailPreference[]> {
  const coll = await getCollection();
  const rows = await coll
    .find({ tenantId: asObjectId(input.tenantId), portfolioId: asObjectId(input.portfolioId) })
    .toArray();
  return rows
    .map((r) => toDomain(r as PreferenceDoc & { _id?: ObjectId }))
    .filter((r): r is PortfolioEmailPreference => r !== null);
}

export async function getPortfolioEmailPreference(input: {
  tenantId: ObjectId | string;
  portfolioId: ObjectId | string;
  templateSlug: EmailTemplateSlug;
}): Promise<PortfolioEmailPreference | null> {
  const coll = await getCollection();
  const row = await coll.findOne({
    tenantId: asObjectId(input.tenantId),
    portfolioId: asObjectId(input.portfolioId),
    templateSlug: input.templateSlug
  });
  return toDomain(row as (PreferenceDoc & { _id?: ObjectId }) | null);
}

/**
 * Upsert preference row. `null` on optional fields **clears** the override (uses `$unset`).
 * Returns the post-update domain row.
 */
export async function upsertPortfolioEmailPreference(input: {
  tenantId: ObjectId | string;
  portfolioId: ObjectId | string;
  patch: UpdatePortfolioEmailPreferencePayload;
}): Promise<PortfolioEmailPreference> {
  const coll = await getCollection();
  const tenantId = asObjectId(input.tenantId);
  const portfolioId = asObjectId(input.portfolioId);
  const now = new Date();

  const $set: Record<string, unknown> = {
    tenantId,
    portfolioId,
    templateSlug: input.patch.templateSlug,
    updatedAt: now
  };
  const $unset: Record<string, "" | 1> = {};
  const $setOnInsert: Record<string, unknown> = {
    enabled: false,
    createdAt: now
  };

  if (input.patch.enabled !== undefined) {
    $set.enabled = input.patch.enabled;
    delete $setOnInsert.enabled;
  }
  applyNullableField<EmailDigestCadence>(
    "cadenceOverride",
    input.patch.cadenceOverride,
    $set,
    $unset
  );
  applyNullableField<string>("subjectOverride", input.patch.subjectOverride, $set, $unset);
  applyNullableField<string>("bodyOverride", input.patch.bodyOverride, $set, $unset);

  await coll.updateOne(
    { tenantId, portfolioId, templateSlug: input.patch.templateSlug },
    {
      $set,
      ...(Object.keys($unset).length > 0 ? { $unset } : {}),
      $setOnInsert
    },
    { upsert: true }
  );
  const row = await coll.findOne({
    tenantId,
    portfolioId,
    templateSlug: input.patch.templateSlug
  });
  const domain = toDomain(row as (PreferenceDoc & { _id?: ObjectId }) | null);
  if (!domain) {
    throw new Error("upsertPortfolioEmailPreference: row missing after upsert");
  }
  return domain;
}

function applyNullableField<T>(
  key: string,
  value: T | null | undefined,
  $set: Record<string, unknown>,
  $unset: Record<string, "" | 1>
): void {
  if (value === undefined) {
    return;
  }
  if (value === null) {
    $unset[key] = "";
    return;
  }
  $set[key] = value;
}

export async function deletePortfolioEmailPreference(input: {
  tenantId: ObjectId | string;
  portfolioId: ObjectId | string;
  templateSlug: EmailTemplateSlug;
}): Promise<boolean> {
  const coll = await getCollection();
  const result = await coll.deleteOne({
    tenantId: asObjectId(input.tenantId),
    portfolioId: asObjectId(input.portfolioId),
    templateSlug: input.templateSlug
  });
  return result.deletedCount === 1;
}

export async function ensurePortfolioEmailPreferenceIndexes(db: Db): Promise<void> {
  const coll = db.collection(PORTFOLIO_EMAIL_PREFERENCES_COLLECTION);
  await coll.createIndex(
    { tenantId: 1, portfolioId: 1, templateSlug: 1 },
    { unique: true, name: "uniq_portfolio_email_preferences_scope" }
  );
  await coll.createIndex(
    { tenantId: 1, enabled: 1 },
    { name: "idx_portfolio_email_preferences_tenant_enabled" }
  );
}
