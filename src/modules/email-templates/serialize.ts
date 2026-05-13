import type {
    EmailTemplate,
    PortfolioEmailPreference
} from "@/modules/email-templates/types";

export type SerializedEmailTemplate = {
  _id: string | null;
  slug: EmailTemplate["slug"];
  version: string;
  tenantId: string | null;
  subject: string;
  body: string;
  active: boolean;
  defaultCadence: EmailTemplate["defaultCadence"];
  createdAt: string;
  updatedAt: string;
};

export function serializeEmailTemplate(row: EmailTemplate): SerializedEmailTemplate {
  return {
    _id: row._id ? row._id.toHexString() : null,
    slug: row.slug,
    version: row.version,
    tenantId: row.tenantId ? row.tenantId.toHexString() : null,
    subject: row.subject,
    body: row.body,
    active: row.active,
    defaultCadence: row.defaultCadence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export type SerializedPortfolioEmailPreference = {
  _id: string | null;
  tenantId: string;
  portfolioId: string;
  templateSlug: PortfolioEmailPreference["templateSlug"];
  enabled: boolean;
  cadenceOverride: PortfolioEmailPreference["cadenceOverride"] | null;
  subjectOverride: string | null;
  bodyOverride: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializePortfolioEmailPreference(
  row: PortfolioEmailPreference
): SerializedPortfolioEmailPreference {
  return {
    _id: row._id ? row._id.toHexString() : null,
    tenantId: row.tenantId.toHexString(),
    portfolioId: row.portfolioId.toHexString(),
    templateSlug: row.templateSlug,
    enabled: row.enabled,
    cadenceOverride: row.cadenceOverride ?? null,
    subjectOverride: row.subjectOverride ?? null,
    bodyOverride: row.bodyOverride ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
