import { stringify } from "yaml";

import type { Tenant } from "@/modules/identity/types";

function jsonSafeClone(value: unknown): unknown {
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, val) => {
        if (val instanceof Date) {
          return val.toISOString();
        }
        return val;
      })
    );
  } catch {
    return value;
  }
}

/**
 * Builds a **tenant-spec v1-shaped** document from a live `core_tenants` row for ops / drift review.
 * Omits volatile secrets (`apiKeys`). Includes `exportedAt` + `sourceTenantId` under `tenant` for traceability.
 */
export function buildLiveTenantSpecExportPayload(tenant: Tenant): Record<string, unknown> {
  const tenantBlock: Record<string, unknown> = {
    slug: tenant.slug,
    name: tenant.name,
    isDefault: tenant.isDefault,
    exportedAt: new Date().toISOString(),
    sourceTenantId: tenant._id?.toHexString() ?? ""
  };

  if (tenant.workspaceLimits != null && typeof tenant.workspaceLimits === "object") {
    tenantBlock.workspaceLimits = jsonSafeClone(tenant.workspaceLimits);
  }
  if (tenant.tenantPreferences != null && typeof tenant.tenantPreferences === "object") {
    tenantBlock.tenantPreferences = jsonSafeClone(tenant.tenantPreferences);
  }
  if (tenant.tenantRoles != null && typeof tenant.tenantRoles === "object") {
    tenantBlock.tenantRoles = jsonSafeClone(tenant.tenantRoles);
  }
  if (tenant.defaultPortfolioScoringFactors != null) {
    tenantBlock.defaultPortfolioScoringFactors = jsonSafeClone(tenant.defaultPortfolioScoringFactors);
  }
  if (tenant.rentalProfile != null && typeof tenant.rentalProfile === "object") {
    tenantBlock.rentalProfile = jsonSafeClone(tenant.rentalProfile);
  }
  if (tenant.rentalExpiresAt instanceof Date) {
    tenantBlock.rentalExpiresAt = tenant.rentalExpiresAt.toISOString();
  }
  if (typeof tenant.rentalStripeSubscriptionId === "string") {
    tenantBlock.rentalStripeSubscriptionId = tenant.rentalStripeSubscriptionId;
  }
  if (typeof tenant.rentalStripeSubscriptionStatus === "string") {
    tenantBlock.rentalStripeSubscriptionStatus = tenant.rentalStripeSubscriptionStatus;
  }

  return { version: 1, tenant: tenantBlock };
}

export function buildLiveTenantSpecYaml(tenant: Tenant): string {
  const doc = buildLiveTenantSpecExportPayload(tenant);
  return stringify(doc, { lineWidth: 120 });
}
