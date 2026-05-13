import { ObjectId } from "mongodb";

import { caughtErrorMessage } from "@/lib/caught-error";
import { getDeskSmtpConfig, sendDeskHtmlEmailWithRetry } from "@/lib/desk-smtp";
import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import { adminListPortfolioDeliveryChannels } from "@/modules/core-admin/repository";
import type { Portfolio, ScheduledTask } from "@/modules/core-admin/types";
import { resolveEffectiveEmailTemplate } from "@/modules/email-templates/email-template-resolver";
import { buildPortfolioEmailDigestContext } from "@/modules/email-templates/portfolio-email-digest-context";
import { renderEmailTemplate } from "@/modules/email-templates/template-renderer";
import {
    EMAIL_TEMPLATE_SLUGS,
    type EmailDigestCadence,
    type EmailTemplateSlug
} from "@/modules/email-templates/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";

type PerPortfolioResult = {
  portfolioId: string;
  portfolioName: string;
  templateSlug: EmailTemplateSlug;
  cadence: EmailDigestCadence;
  enabled: boolean;
  status: "skipped" | "sent" | "failed" | "no_template" | "no_email_channel" | "smtp_unavailable";
  detail?: string;
  emailRecipients: number;
  emailsSent: number;
  emailsFailed: number;
};

/**
 * Scheduled task handler for `portfolio_email_digest`.
 *
 * Tenant-scoped: iterates `tenant_portfolio` rows for the task's tenant, then for each portfolio
 * resolves enabled `portfolio_email_preferences` (per template slug) and sends the rendered digest
 * to enabled `email` `portfolio_delivery_channels`.
 *
 * Cadence: scheduler decides _when_ to fire (cron); this handler simply ships whatever portfolios
 * have a matching cadence in their effective preference. Configure two scheduled rows in admin
 * (one per cadence) using `taskCadence` config when more granular control is needed; current
 * implementation runs **all** enabled cadences each tick.
 */
export async function runPortfolioEmailDigestTask(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const tenantId = task.tenantId;
  if (!tenantId) {
    return {
      status: "failed",
      output: "portfolio_email_digest: missing tenantId on scheduled task"
    };
  }

  const db = await getDb();
  const portfolios = await db
    .collection<Portfolio>(TENANT_PORTFOLIO_COLLECTION)
    .find({ tenantId })
    .limit(1000)
    .toArray()
    .catch(() => [] as Portfolio[]);

  if (portfolios.length === 0) {
    return {
      status: "success",
      output: `portfolio_email_digest: no portfolios for tenantId=${tenantId.toHexString()}`
    };
  }

  const smtpReady = getDeskSmtpConfig() !== null;
  const results: PerPortfolioResult[] = [];

  for (const portfolio of portfolios) {
    if (!portfolio._id) {
      continue;
    }
    for (const slug of EMAIL_TEMPLATE_SLUGS) {
      const result = await processOnePortfolio({
        tenantId,
        portfolioIdHex: portfolio._id.toHexString(),
        portfolioName: portfolio.name,
        slug,
        smtpReady
      });
      if (result) {
        results.push(result);
      }
    }
  }

  const sent = results.reduce((acc, r) => acc + r.emailsSent, 0);
  const failed = results.reduce((acc, r) => acc + r.emailsFailed, 0);
  const skipped = results.filter((r) => r.status === "skipped").length;
  const summary = [
    `portfolio_email_digest tenantId=${tenantId.toHexString()} portfolios=${portfolios.length}`,
    `templates=${results.length} sent=${sent} failed=${failed} skipped=${skipped} smtp=${smtpReady ? "ready" : "unconfigured"}`,
    ...results.slice(0, 50).map((r) => formatRow(r))
  ];
  if (results.length > 50) {
    summary.push(`(${results.length - 50} more rows truncated)`);
  }
  return {
    status: failed === 0 ? "success" : "failed",
    output: summary.join("\n"),
    auditDetails: { sent, failed, skipped, total: results.length }
  };
}

async function processOnePortfolio(input: {
  tenantId: ObjectId;
  portfolioIdHex: string;
  portfolioName: string;
  slug: EmailTemplateSlug;
  smtpReady: boolean;
}): Promise<PerPortfolioResult | null> {
  const resolved = await resolveEffectiveEmailTemplate({
    slug: input.slug,
    tenantId: input.tenantId,
    portfolioId: input.portfolioIdHex
  });
  if (!resolved) {
    return {
      portfolioId: input.portfolioIdHex,
      portfolioName: input.portfolioName,
      templateSlug: input.slug,
      cadence: "weekly",
      enabled: false,
      status: "no_template",
      emailRecipients: 0,
      emailsSent: 0,
      emailsFailed: 0
    };
  }
  if (!resolved.enabled) {
    return {
      portfolioId: input.portfolioIdHex,
      portfolioName: input.portfolioName,
      templateSlug: input.slug,
      cadence: resolved.cadence,
      enabled: false,
      status: "skipped",
      detail: "preference disabled",
      emailRecipients: 0,
      emailsSent: 0,
      emailsFailed: 0
    };
  }

  const channels = await adminListPortfolioDeliveryChannels(input.portfolioIdHex);
  const emailChannels = channels.filter((c) => c.kind === "email" && c.enabled);
  if (emailChannels.length === 0) {
    return {
      portfolioId: input.portfolioIdHex,
      portfolioName: input.portfolioName,
      templateSlug: input.slug,
      cadence: resolved.cadence,
      enabled: true,
      status: "no_email_channel",
      emailRecipients: 0,
      emailsSent: 0,
      emailsFailed: 0
    };
  }
  if (!input.smtpReady) {
    return {
      portfolioId: input.portfolioIdHex,
      portfolioName: input.portfolioName,
      templateSlug: input.slug,
      cadence: resolved.cadence,
      enabled: true,
      status: "smtp_unavailable",
      emailRecipients: emailChannels.length,
      emailsSent: 0,
      emailsFailed: 0
    };
  }

  const context = await buildPortfolioEmailDigestContext({
    portfolioId: input.portfolioIdHex,
    cadence: resolved.cadence
  });
  if (!context) {
    return {
      portfolioId: input.portfolioIdHex,
      portfolioName: input.portfolioName,
      templateSlug: input.slug,
      cadence: resolved.cadence,
      enabled: true,
      status: "failed",
      detail: "context build failed",
      emailRecipients: emailChannels.length,
      emailsSent: 0,
      emailsFailed: emailChannels.length
    };
  }

  let rendered;
  try {
    rendered = renderEmailTemplate({
      subject: resolved.subject,
      body: resolved.body,
      context
    });
  } catch (error) {
    return {
      portfolioId: input.portfolioIdHex,
      portfolioName: input.portfolioName,
      templateSlug: input.slug,
      cadence: resolved.cadence,
      enabled: true,
      status: "failed",
      detail: `render error: ${caughtErrorMessage(error)}`,
      emailRecipients: emailChannels.length,
      emailsSent: 0,
      emailsFailed: emailChannels.length
    };
  }

  let sent = 0;
  let failed = 0;
  for (const ch of emailChannels) {
    const to = ch.destination.trim();
    const ok = await sendDeskHtmlEmailWithRetry({
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html
    });
    if (ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return {
    portfolioId: input.portfolioIdHex,
    portfolioName: input.portfolioName,
    templateSlug: input.slug,
    cadence: resolved.cadence,
    enabled: true,
    status: failed === 0 ? "sent" : "failed",
    emailRecipients: emailChannels.length,
    emailsSent: sent,
    emailsFailed: failed
  };
}

function formatRow(r: PerPortfolioResult): string {
  return `  - ${r.portfolioName} [${r.templateSlug}] cadence=${r.cadence} status=${r.status} sent=${r.emailsSent}/${r.emailRecipients}${r.detail ? ` (${r.detail})` : ""}`;
}
