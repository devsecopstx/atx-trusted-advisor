/**
 * Backfills the xchat_user_usage_stats collection from xchat_logs.
 *
 * Supports --env-file for easy usage with .env.prod / .env.stage
 */

import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

import { parseMongoConnectionString, resolveSeedDbName } from './lib/resolve-mongo-uri.mjs';

const USAGE_STATS_COLLECTION = 'xchat_user_usage_stats';

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
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning: Could not load ${filePath}: ${err.message}`);
    }
  }
}

// Parse --env-file very early
const envFileIndex = process.argv.indexOf('--env-file');
if (envFileIndex !== -1 && process.argv[envFileIndex + 1]) {
  loadEnvFile(process.argv[envFileIndex + 1]);
}

const isDryRun = process.argv.includes('--dry-run');

export async function backfillXchatUsageStats(batchSize = 500) {
  const rawUri = process.env.MONGODB_URI || process.env.MONGODB_URI_B64;
  if (!rawUri) {
    throw new Error('MONGODB_URI (or MONGODB_URI_B64) must be set in environment');
  }

  const mongoUri = parseMongoConnectionString(rawUri);
  const dbName = resolveSeedDbName();

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const logsCol = db.collection('xchat_logs');
    const statsCol = db.collection(USAGE_STATS_COLLECTION);

    console.log(`→ Backfilling ${USAGE_STATS_COLLECTION}${isDryRun ? ' (DRY RUN)' : ''} (db: ${dbName})...`);

    const cursor = logsCol.aggregate([
      {
        $group: {
          _id: { userId: '$userId', tenantId: '$tenantId' },
          totalTokens: { $sum: { $ifNull: ['$xaiUsage.totalTokens', 0] } },
          promptCount: { $sum: 1 },
          lastPromptAt: { $max: '$createdAt' },
        },
      },
    ]);

    let processed = 0;

    for await (const doc of cursor) {
      const today = doc.lastPromptAt.toISOString().slice(0, 10);

      if (isDryRun) {
        if (processed < 3) {
          console.log(`  [DRY] Would upsert stats for user ${doc._id.userId}`);
        }
      } else {
        await statsCol.updateOne(
          { userId: doc._id.userId, tenantId: doc._id.tenantId ?? null },
          {
            $set: {
              totalTokens: doc.totalTokens,
              promptCount: doc.promptCount,
              lastPromptAt: doc.lastPromptAt,
              today,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              userId: doc._id.userId,
              tenantId: doc._id.tenantId ?? null,
            },
          },
          { upsert: true }
        );
      }

      processed++;
      if (processed % batchSize === 0) {
        console.log(`Processed ${processed} users...`);
      }
    }

    if (isDryRun) {
      console.log(`[DRY RUN] Would have processed ${processed} users.`);
    } else {
      console.log(`✅ Backfill complete. Processed ${processed} users.`);
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  backfillXchatUsageStats().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
