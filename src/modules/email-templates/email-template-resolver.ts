import type { ObjectId } from "mongodb";

import { findActiveEmailTemplate } from "@/modules/email-templates/email-templates-repository";
import { getPortfolioEmailPreference } from "@/modules/email-templates/portfolio-email-preferences-repository";
import type {
    EmailDigestCadence,
    EmailTemplate,
    EmailTemplateSlug,
    PortfolioEmailPreference
} from "@/modules/email-templates/types";

export type ResolvedEmailTemplate = {
  /** Effective subject (override → tenant default → global default). */
  subject: string;
  /** Effective Markdown body. */
  body: string;
  /** Effective cadence; preference override wins, else template default. */
  cadence: EmailDigestCadence;
  /** Effective enabled flag (preference row only — templates themselves don't gate). */
  enabled: boolean;
  /** Underlying template (after tenant precedence). */
  template: EmailTemplate;
  /** Portfolio-scoped preference row, if any. */
  preference: PortfolioEmailPreference | null;
  /** Source provenance per field — useful for audit + admin UI badges. */
  sources: {
    subject: "portfolio_override" | "template";
    body: "portfolio_override" | "template";
    cadence: "portfolio_override" | "template";
  };
};

/**
 * Resolve effective digest template for a portfolio:
 *   1. portfolio_email_preferences override (subject/body/cadence/enabled)
 *   2. email_templates row for tenant
 *   3. email_templates row for `tenantId: null`
 *
 * Returns `null` when no active template exists at any tier (caller should noop / log).
 */
export async function resolveEffectiveEmailTemplate(input: {
  slug: EmailTemplateSlug;
  tenantId: ObjectId | string;
  portfolioId: ObjectId | string;
}): Promise<ResolvedEmailTemplate | null> {
  const template = await findActiveEmailTemplate({ slug: input.slug, tenantId: input.tenantId });
  if (!template) {
    return null;
  }
  const preference = await getPortfolioEmailPreference({
    tenantId: input.tenantId,
    portfolioId: input.portfolioId,
    templateSlug: input.slug
  });

  const subjectOverride = preference?.subjectOverride?.trim();
  const bodyOverride = preference?.bodyOverride?.trim();
  const cadenceOverride = preference?.cadenceOverride;

  return {
    subject: subjectOverride && subjectOverride.length > 0 ? subjectOverride : template.subject,
    body: bodyOverride && bodyOverride.length > 0 ? bodyOverride : template.body,
    cadence: cadenceOverride ?? template.defaultCadence,
    enabled: preference?.enabled ?? false,
    template,
    preference,
    sources: {
      subject: subjectOverride && subjectOverride.length > 0 ? "portfolio_override" : "template",
      body: bodyOverride && bodyOverride.length > 0 ? "portfolio_override" : "template",
      cadence: cadenceOverride ? "portfolio_override" : "template"
    }
  };
}
