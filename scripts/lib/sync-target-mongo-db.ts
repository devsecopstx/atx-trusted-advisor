import { resolveDefaultMongoDatabaseName } from "@/lib/env";

/**
 * Mongo database name for disk→Mongo sync scripts that must align with Next.js `getDb()`.
 *
 * - **Standalone** (`npm run seed:xpersonas`, `npm run seed:options-strategy-prefs`, …): uses
 *   {@link resolveDefaultMongoDatabaseName} (`MONGODB_DB_NAME` / deploy target / `atxfinance`).
 * - **Child of `seed:admin`**: `seed-admin-user.mjs` sets `SEED_PARENT_MONGODB_DB_NAME` to
 *   `resolveAdminSeedDbName()` so writes land in the same DB as the main seed transaction
 *   (version suffix when `ADMIN_SEED_DB_VERSION_SUFFIX` is not `off`).
 */
export function resolveSyncTargetMongoDatabaseName(): string {
  const parent = process.env.SEED_PARENT_MONGODB_DB_NAME?.trim();
  if (parent) {
    return parent;
  }
  return resolveDefaultMongoDatabaseName();
}

export function formatSyncTargetMongoDatabaseLogSuffix(): string {
  return process.env.SEED_PARENT_MONGODB_DB_NAME?.trim()
    ? " (from SEED_PARENT_MONGODB_DB_NAME — seed:admin)"
    : " (same default as Next.js getDb() — set MONGODB_DB_NAME if the app uses a non-default DB)";
}
