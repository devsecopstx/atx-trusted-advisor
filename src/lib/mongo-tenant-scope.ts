import { ObjectId } from "mongodb";

/**
 * Canonical BSON tenant id from session / URL hex. Invalid or empty → undefined.
 * Aligns with `core_tenants._id`.
 */
export function parseTenantObjectId(tenantHex?: string | null): ObjectId | undefined {
  const t = typeof tenantHex === "string" ? tenantHex.trim() : "";
  if (!t || !ObjectId.isValid(t)) {
    return undefined;
  }
  return new ObjectId(t);
}

/** Mongo filter that matches no documents (fail-closed tenant enforcement). */
export function mongoMatchNothingFilter(): { _id: { $in: ObjectId[] } } {
  return { _id: { $in: [] } };
}

/**
 * Session `userId` is a hex string; older rows may store `userId` as BSON ObjectId.
 * Use on reads and non-upsert writes so both match.
 */
export function mongoUserIdQuery(userId: string): {
  userId: string | { $in: (string | ObjectId)[] };
} {
  if (ObjectId.isValid(userId)) {
    return { userId: { $in: [userId, new ObjectId(userId)] } };
  }
  return { userId };
}

/**
 * Exact `tenantId` (ObjectId) on a document — used for rows that always carry tenant (positions, some settings writes).
 * When `tenantHex` is invalid/missing:
 * - `denyIfTenantMissing` (default): AND with an impossible match (no cross-tenant reads/writes).
 * - `allowMissingTenantKey`: leave `base` unchanged (legacy upsert/bootstrap paths only).
 */
export function mongoTenantExactScope(
  base: Record<string, unknown>,
  tenantHex: string | undefined,
  whenTenantMissing: "deny" | "allowMissingTenantKey" = "deny"
): Record<string, unknown> {
  const oid = parseTenantObjectId(tenantHex);
  if (!oid) {
    if (whenTenantMissing === "allowMissingTenantKey") {
      return base;
    }
    return { $and: [base, mongoMatchNothingFilter()] };
  }
  return { ...base, tenantId: oid };
}

/**
 * Portfolio desk family (`tenant_portfolio`, `portfolio_*`): tenant ObjectId **or** legacy null/missing `tenantId`.
 *
 * When `tenantHex` is invalid/missing:
 * - `denyIfTenantMissing` — fail closed (app_user session APIs).
 * - `allowLegacyUserScope` — match on `userId` only (OAuth/bootstrap + admin ops derived from a portfolio with no tenant).
 */
export function mongoPortfolioFamilyUserScope(
  userId: string,
  tenantHex: string | undefined,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  const base = mongoUserIdQuery(userId);
  const oid = parseTenantObjectId(tenantHex);
  if (!oid) {
    if (whenTenantMissing === "allowLegacyUserScope") {
      return base;
    }
    return { $and: [base, mongoMatchNothingFilter()] };
  }
  return {
    ...base,
    $or: [
      { tenantId: oid },
      { tenantId: { $type: "null" } },
      { tenantId: { $exists: false } }
    ]
  };
}

export function mongoPortfolioFamilyUserPortfolioScope(
  userId: string,
  portfolioIdHex: string,
  tenantHex: string | undefined,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  if (!ObjectId.isValid(portfolioIdHex)) {
    return { $and: [mongoUserIdQuery(userId), mongoMatchNothingFilter()] };
  }
  return {
    ...mongoPortfolioFamilyUserScope(userId, tenantHex, whenTenantMissing),
    portfolioId: new ObjectId(portfolioIdHex)
  };
}

/**
 * `admin_scheduled_tasks` reads: session tenant **or** legacy rows with no `tenantId`.
 */
export function mongoScheduledTaskTenantReadScope(
  base: Record<string, unknown>,
  tenantHex: string | undefined,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  const oid = parseTenantObjectId(tenantHex);
  if (!oid) {
    if (whenTenantMissing === "allowLegacyUserScope") {
      return base;
    }
    return { $and: [base, mongoMatchNothingFilter()] };
  }
  return {
    $and: [
      base,
      {
        $or: [{ tenantId: oid }, { tenantId: null }, { tenantId: { $exists: false } }]
      }
    ]
  };
}

/**
 * `app_user_recommendations` — same tenant / legacy-null semantics as portfolio family for reads.
 */
export function mongoAppUserRecommendationsScope(
  base: Record<string, unknown>,
  tenantHex: string | undefined,
  whenTenantMissing: "denyIfTenantMissing" | "allowLegacyUserScope" = "denyIfTenantMissing"
): Record<string, unknown> {
  const oid = parseTenantObjectId(tenantHex);
  if (!oid) {
    if (whenTenantMissing === "allowLegacyUserScope") {
      return base;
    }
    return { $and: [base, mongoMatchNothingFilter()] };
  }
  return {
    ...base,
    $or: [
      { tenantId: oid },
      { tenantId: { $exists: false } },
      { tenantId: { $type: "null" } }
    ]
  };
}

export type XchatLogTenantScopeMode = "userTenant" | "allTenants";

/**
 * xchat_logs: for `userTenant`, require `tenantId` or fail closed. For `allTenants`, do not add tenant predicate (workers only).
 */
export function mongoXchatLogsTenantScope(
  query: Record<string, unknown>,
  tenantId: ObjectId | undefined | null,
  mode: XchatLogTenantScopeMode
): Record<string, unknown> {
  if (mode === "allTenants") {
    return query;
  }
  if (!tenantId) {
    return { $and: [query, mongoMatchNothingFilter()] };
  }
  const tenantScope: Record<string, unknown> = {
    $or: [{ tenantId }, { tenantId: { $exists: false } }]
  };
  if ("$or" in query || "$and" in query) {
    return { $and: [query, tenantScope] };
  }
  return { ...query, ...tenantScope };
}
