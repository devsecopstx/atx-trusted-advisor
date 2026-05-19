/**
 * One-shot migration for xChat performance improvements.
 *
 * Supports --env-file so you can do:
 *   npm run xchat:migrate-performance -- --env-file .env.prod
 */

import { readFileSync } from 'node:fs';

import { createXchatIndexes } from './create-xchat-indexes.ts';
import { backfillXchatUsageStats } from './backfill-xchat-usage-stats.ts';

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code !== 'ENOENT') {
      console.warn(`Warning: Could not load ${filePath}: ${e.message}`);
    }
  }
}

// Load --env-file very early, before any other imports that might need env vars
const envFileIndex = process.argv.indexOf('--env-file');
if (envFileIndex !== -1 && process.argv[envFileIndex + 1]) {
  loadEnvFile(process.argv[envFileIndex + 1]);
}

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
