import { ObjectId } from "mongodb";

import deskDefaults from "@/data/default-watchlist-desk-symbols.json";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    provisionDefaultPortfolioForUser,
    type ProvisionDefaultPortfolioResult
} from "@/modules/core-admin/repository";
import {
    getCoreUserById,
    getDefaultTenantMembershipForUser,
    getTenantByHexId
} from "@/modules/identity/repository";
import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";
import {
    effectiveTenantBootstrapPolicy,
    normalizeWatchlistSeedSymbolsFromPreferences,
    pickBootstrapPlatformRole,
    resolveBootstrapFlagsForRole,
    resolveWatchlistSeedSymbols,
    type BootstrapPlatformRole
} from "@/modules/platform/tenant-bootstrap-policy";

export type EnsureTenantBootstrapTrigger =
  | "oauth_login"
  | "email_login"
  | "access_request_approve"
  | "seed_tenant"
  | "run_access_request_bootstrap"
  | "link_email"
  | "page_shell";

export type EnsureTenantBootstrapResult =
  | {
      didProvision: true;
      result: ProvisionDefaultPortfolioResult;
      platformRole: BootstrapPlatformRole;
    }
  | {
      didProvision: false;
      skippedReason:
        | "user_not_found"
        | "tenant_not_found"
        | "membership_mismatch"
        | "no_platform_role"
        | "policy_no_portfolio";
    };

export async function ensureTenantBootstrapForUser(input: {
  userId: string;
  tenantId: string;
  trigger: EnsureTenantBootstrapTrigger;
  /** When false, skip `admin_audit_events` writes (nested / hot paths). Default true. */
  emitAudit?: boolean;
}): Promise<EnsureTenantBootstrapResult> {
  const emitAudit = input.emitAudit !== false;
  const uid = input.userId.trim();
  const tid = input.tenantId.trim();
  if (!ObjectId.isValid(uid)) {
    return { didProvision: false, skippedReason: "user_not_found" };
  }
  if (!ObjectId.isValid(tid)) {
    return { didProvision: false, skippedReason: "tenant_not_found" };
  }

  const user = await getCoreUserById(new ObjectId(uid));
  if (!user?._id) {
    return { didProvision: false, skippedReason: "user_not_found" };
  }
  const tenant = await getTenantByHexId(tid);
  if (!tenant?._id) {
    return { didProvision: false, skippedReason: "tenant_not_found" };
  }
  const membership = await getDefaultTenantMembershipForUser(user._id);
  if (!membership?.tenantId || !membership.tenantId.equals(tenant._id)) {
    return { didProvision: false, skippedReason: "membership_mismatch" };
  }

  const prefs = tenant.tenantPreferences as TenantPreferences | null | undefined;
  const policy = effectiveTenantBootstrapPolicy(prefs ?? null);
  const platformRole = pickBootstrapPlatformRole(user.roles);
  if (!platformRole) {
    return { didProvision: false, skippedReason: "no_platform_role" };
  }
  const flags = resolveBootstrapFlagsForRole(policy, platformRole);
  if (!flags.defaultPortfolio) {
    return { didProvision: false, skippedReason: "policy_no_portfolio" };
  }

  const tenantTemplateSymbols = normalizeWatchlistSeedSymbolsFromPreferences(prefs ?? null);
  const symbols = resolveWatchlistSeedSymbols({
    defaultWatchlist: flags.defaultWatchlist,
    overrideSymbols: flags.overrideSymbols,
    tenantTemplateSymbols,
    deskDefaults: deskDefaults as string[]
  });

  const tenantHex = tenant._id.toHexString();

  try {
    const result = await provisionDefaultPortfolioForUser({
      userId: uid,
      tenantId: tid,
      ...(symbols !== undefined ? { watchlistSymbols: symbols } : {})
    });
    if (emitAudit) {
      try {
        await createAuditEvent({
          entityType: "tenant",
          entityId: tenantHex,
          action: "tenant_provision_bootstrap",
          actor: { userId: uid },
          details: {
            trigger: input.trigger,
            platformRole,
            success: true,
            portfolioId: result.portfolio._id?.toHexString() ?? ""
          }
        });
      } catch {
        // ignore audit failures
      }
    }
    return { didProvision: true, result, platformRole };
  } catch (error) {
    if (emitAudit) {
      try {
        await createAuditEvent({
          entityType: "tenant",
          entityId: tenantHex,
          action: "tenant_provision_bootstrap",
          actor: { userId: uid },
          details: {
            trigger: input.trigger,
            platformRole,
            success: false,
            error: error instanceof Error ? error.message.slice(0, 500) : String(error)
          }
        });
      } catch {
        /* empty */
      }
    }
    throw error;
  }
}
