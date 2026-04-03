import { resolveEffectiveMongoDatabaseName } from "@/lib/env";

/**
 * Mongo database name for disk→Mongo sync scripts that must align with Next.js `getDb()`.
 *
 * - **Standalone** (`npm run seed:xpersonas`, `npm run seed:options-strategy-prefs`, …): uses
 *   {@link resolveEffectiveMongoDatabaseName} (same rules as Next.js `getDb()`).
 * - **Child of `seed:admin`**: `seed-admin-user.mjs` sets `SEED_PARENT_MONGODB_DB_NAME` to
 *   `resolveAdminSeedDbName()` so writes land in the same DB as the main seed transaction
 *   (optional version suffix only when `ADMIN_SEED_DB_VERSION_SUFFIX=on`).
 */
export function resolveSyncTargetMongoDatabaseName(): string {
  const parent = process.env.SEED_PARENT_MONGODB_DB_NAME?.trim();
  if (parent) {
    return parent;
  }
  return resolveEffectiveMongoDatabaseName();
}

export function formatSyncTargetMongoDatabaseLogSuffix(): string {
  return process.env.SEED_PARENT_MONGODB_DB_NAME?.trim()
    ? " (from SEED_PARENT_MONGODB_DB_NAME — seed:admin)"
    : " (same as Next.js getDb(): MONGODB_DB_NAME, else DB path in MONGODB_URI, else deploy-target / atxfinance)";
}
