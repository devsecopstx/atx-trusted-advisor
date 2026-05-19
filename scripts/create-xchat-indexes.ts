/**
 * Creates recommended performance indexes for xChat.
 *
 * Supports --env-file for easy prod/stage usage.
 *
 * Usage:
 *   npm run xchat:create-indexes
 *   npm run xchat:create-indexes -- --dry-run
 *   npm run xchat:create-indexes -- --env-file .env.prod
 */

import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

import { parseMongoConnectionString, resolveSeedDbName } from './lib/resolve-mongo-uri.mjs';

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
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

// Parse --env-file early
const envFileIndex = process.argv.indexOf('--env-file');
if (envFileIndex !== -1 && process.argv[envFileIndex + 1]) {
  loadEnvFile(process.argv[envFileIndex + 1]);
}

const isDryRun = process.argv.includes('--dry-run');

export async function createXchatIndexes() {
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
    console.log(`→ Creating xChat indexes${isDryRun ? ' (DRY RUN)' : ''} (db: ${dbName})...`);

    const chatLogs = db.collection('xchat_logs');
    const personas = db.collection('xchat_personas');

    const createIndexSafe = async (collection: any, spec: any, options: any = {}) => {
      const name = options.name || 'unnamed-index';
      if (isDryRun) {
        console.log(`  [DRY] Would create index: ${name}`);
        return;
      }
      await collection.createIndex(spec, { background: true, ...options });
      console.log(`  ✓ Created: ${name}`);
    };

    // xchat_logs indexes
    await createIndexSafe(chatLogs, { userId: 1, createdAt: -1, _id: -1 }, { name: 'idx_xchat_logs_user_created_desc' });
    await createIndexSafe(chatLogs, { userId: 1, threadId: 1, createdAt: -1, _id: -1 }, {
      name: 'idx_xchat_logs_user_thread_created_desc',
      partialFilterExpression: { threadId: { $exists: true, $type: 'string', $gt: '' } }
    });
    await createIndexSafe(chatLogs, { tenantId: 1, userId: 1, createdAt: -1, _id: -1 }, { name: 'idx_xchat_logs_tenant_user_created_desc' });
    await createIndexSafe(chatLogs, { retentionExpiresAt: 1 }, { name: 'ttl_xchat_logs_retention_expires_at', expireAfterSeconds: 0 });
    await createIndexSafe(chatLogs, { syncedToXaiAt: 1, createdAt: 1, _id: 1 }, { name: 'idx_xchat_logs_synced_created' });
    await createIndexSafe(chatLogs, { tenantId: 1, syncedToXaiAt: 1, createdAt: 1 }, { name: 'idx_xchat_logs_tenant_pending_xai' });
    await createIndexSafe(chatLogs, { userId: 1, createdAt: -1, _id: -1 }, {
      name: 'idx_xchat_logs_user_created_xai_response_partial',
      partialFilterExpression: { xaiResponseId: { $exists: true, $type: 'string', $gt: '' } }
    });
    await createIndexSafe(chatLogs, { tenantId: 1, userId: 1, createdAt: -1 }, { name: 'idx_xchat_logs_tenant_user_created' });
    await createIndexSafe(chatLogs, { userId: 1, personaId: 1, createdAt: -1, _id: -1 }, { name: 'idx_xchat_logs_user_persona_created' });
    await createIndexSafe(chatLogs, { tenantId: 1, createdAt: -1 }, { name: 'idx_xchat_logs_tenant_created' });
    await createIndexSafe(chatLogs, { tenantId: 1, personaId: 1, createdAt: -1 }, { name: 'idx_xchat_logs_tenant_persona_created' });

    // xchat_personas indexes
    await createIndexSafe(personas, { nameNormalized: 1 }, { name: 'uniq_xpersona_name_normalized', unique: true });
    await createIndexSafe(personas, { status: 1, updatedAt: -1 }, { name: 'idx_personas_status_updated' });
    await createIndexSafe(personas, { tenantId: 1, status: 1, updatedAt: -1 }, { name: 'idx_personas_tenant_status_updated' });
    await createIndexSafe(personas, { status: 1, isDefaultForAppUsers: 1 }, { name: 'idx_personas_status_default_app_users' });

    if (!isDryRun) {
      console.log('\n✅ All xChat indexes created successfully.');
    } else {
      console.log('\n[DRY RUN] No indexes were actually created.');
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createXchatIndexes().catch((err) => {
    console.error('Failed to create xChat indexes:', err);
    process.exit(1);
  });
}
