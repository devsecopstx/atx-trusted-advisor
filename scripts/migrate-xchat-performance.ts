// @ts-nocheck
/**
 * One-shot migration for xChat performance improvements.
 *
 * Creates the recommended indexes and backfills the pre-aggregated usage stats.
 *
 * Usage:
 *   npm run xchat:migrate-performance
 *   npm run xchat:migrate-performance -- --dry-run
 *   MONGODB_URI=... npm run xchat:migrate-performance
 */

import { createXchatIndexes } from './create-xchat-indexes';
import { backfillXchatUsageStats } from './backfill-xchat-usage-stats';

async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`🚀 Starting xChat performance migration${isDryRun ? ' (DRY RUN)' : ''}...\n`);

  console.log('Step 1/2: Creating indexes...');
  await createXchatIndexes();

  console.log('\nStep 2/2: Backfilling usage stats (this may take a while on large datasets)...');
  await backfillXchatUsageStats(1000);

  console.log(`\n✅ xChat performance migration completed${isDryRun ? ' (dry run)' : ''}.`);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
