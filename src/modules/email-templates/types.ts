import { ObjectId } from "mongodb";
import { z } from "zod";

/** Slugs for first-shipped admin email templates (extensible). */
export const EMAIL_TEMPLATE_SLUGS = [
  "portfolio-digest-weekly",
  "portfolio-digest-daily"
] as const;
export type EmailTemplateSlug = (typeof EMAIL_TEMPLATE_SLUGS)[number];

export function isEmailTemplateSlug(value: string): value is EmailTemplateSlug {
  return (EMAIL_TEMPLATE_SLUGS as readonly string[]).includes(value);
}

/** Cadence used by `portfolio_email_digest` scheduler + preference rows. */
export const EMAIL_DIGEST_CADENCES = ["daily", "weekly"] as const;
export type EmailDigestCadence = (typeof EMAIL_DIGEST_CADENCES)[number];

/**
 * Stored email template body. **Mongo collection: `email_templates`.**
 * - Global default rows: `tenantId: null`.
 * - Tenant-scoped overrides: `tenantId: ObjectId(tenant)`.
 *
 * The body is **Markdown** with a small fixed Mustache variable set rendered at send time;
 * see {@link EMAIL_TEMPLATE_VAR_NAMES}. The `subject` field accepts the same Mustache vars.
 */
export type EmailTemplate = {
  _id?: ObjectId;
  slug: EmailTemplateSlug;
  /** Free-form version label (e.g. `1.0`); admin can bump on edit. */
  version: string;
  /** `null` = platform default visible to all tenants when no tenant row exists. */
  tenantId: ObjectId | null;
  /** Subject line — Mustache vars allowed, no Markdown. */
  subject: string;
  /** Markdown body rendered to HTML at send time after Mustache substitution. */
  body: string;
  /** Inactive templates are ignored by the resolver. */
  active: boolean;
  /** Default cadence hint surfaced to admin UI (`portfolio_email_digest` scheduler still owns the cron). */
  defaultCadence: EmailDigestCadence;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Per-portfolio routing + override row. **Mongo collection: `portfolio_email_preferences`.**
 *
 * Preferences NEVER duplicate the full template body. The resolver merges overrides on top of
 * the resolved {@link EmailTemplate} (tenant default → global default).
 *
 * Allowed override fields: `subject`, `body`, `enabled`, `cadence`. All optional.
 */
export type PortfolioEmailPreference = {
  _id?: ObjectId;
  tenantId: ObjectId;
  portfolioId: ObjectId;
  /** Slug of the template family this row routes (e.g. `portfolio-digest-weekly`). */
  templateSlug: EmailTemplateSlug;
  /** Master enable for this portfolio + template. Falsy/absent = digest disabled. */
  enabled: boolean;
  /** Optional cadence override (otherwise template default cadence applies). */
  cadenceOverride?: EmailDigestCadence;
  /** Optional subject override (Mustache vars allowed). */
  subjectOverride?: string;
  /** Optional Markdown body override. */
  bodyOverride?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Fixed variable surface exposed to template authors. Adding new vars is a typed code change. */
export const EMAIL_TEMPLATE_VAR_NAMES = [
  "portfolio.name",
  "portfolio.id",
  "period.cadence",
  "period.start",
  "period.end",
  "totalValue",
  "weekChange",
  "dayChange",
  "events",
  "positions",
  "topMovers",
  "narrative"
] as const;
export type EmailTemplateVarName = (typeof EMAIL_TEMPLATE_VAR_NAMES)[number];

/**
 * Fully resolved render context. Sections (`events`, `positions`, `topMovers`) are arrays —
 * Mustache iteration via `{{#events}} … {{/events}}`. Booleans use `{{#hasEvents}}` etc.
 */
export type EmailTemplateRenderContext = {
  portfolio: { name: string; id: string };
  period: { cadence: EmailDigestCadence; start: string; end: string };
  totalValue: string;
  weekChange: string;
  dayChange: string;
  events: ReadonlyArray<{ title: string; body?: string; symbol?: string }>;
  positions: ReadonlyArray<{ symbol: string; qty: number; marketValue: string }>;
  topMovers: ReadonlyArray<{ symbol: string; changePct: string }>;
  narrative: string;
  hasEvents: boolean;
  hasPositions: boolean;
  hasTopMovers: boolean;
};

const emailTemplateSlugSchema = z.enum(EMAIL_TEMPLATE_SLUGS);
const emailDigestCadenceSchema = z.enum(EMAIL_DIGEST_CADENCES);

/** Body / subject upper bounds — keep emails reasonable; adjust if real authoring needs change. */
const SUBJECT_MAX = 200;
const BODY_MAX = 16_000;

export const createEmailTemplatePayloadSchema = z.object({
  slug: emailTemplateSlugSchema,
  version: z.string().trim().min(1).max(40),
  tenantId: z.string().regex(/^[a-f0-9]{24}$/i).nullable().optional(),
  subject: z.string().trim().min(1).max(SUBJECT_MAX),
  body: z.string().trim().min(1).max(BODY_MAX),
  active: z.boolean().default(true),
  defaultCadence: emailDigestCadenceSchema
});

export const updateEmailTemplatePayloadSchema = z.object({
  version: z.string().trim().min(1).max(40).optional(),
  subject: z.string().trim().min(1).max(SUBJECT_MAX).optional(),
  body: z.string().trim().min(1).max(BODY_MAX).optional(),
  active: z.boolean().optional(),
  defaultCadence: emailDigestCadenceSchema.optional()
});

export const updatePortfolioEmailPreferencePayloadSchema = z.object({
  templateSlug: emailTemplateSlugSchema,
  enabled: z.boolean().optional(),
  cadenceOverride: emailDigestCadenceSchema.nullable().optional(),
  subjectOverride: z.string().trim().min(1).max(SUBJECT_MAX).nullable().optional(),
  bodyOverride: z.string().trim().min(1).max(BODY_MAX).nullable().optional()
});

export type CreateEmailTemplatePayload = z.infer<typeof createEmailTemplatePayloadSchema>;
export type UpdateEmailTemplatePayload = z.infer<typeof updateEmailTemplatePayloadSchema>;
export type UpdatePortfolioEmailPreferencePayload = z.infer<
  typeof updatePortfolioEmailPreferencePayloadSchema
>;
