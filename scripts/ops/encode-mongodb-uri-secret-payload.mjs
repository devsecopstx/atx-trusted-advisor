#!/usr/bin/env node
/**
 * Reads MONGO_RAW from the environment, normalizes to a plain Mongo URI, writes base64 (no newline)
 * suitable for GCP Secret Manager secret MONGODB_URI_B64 (Cloud Run maps it to env MONGODB_URI).
 *
 * Used by sync-mongodb-uri-secret-from-env.sh — do not run standalone unless MONGO_RAW is set.
 */
import { parseMongoConnectionString } from "../lib/resolve-mongo-uri.mjs";

const raw = process.env.MONGO_RAW?.trim();
if (!raw) {
  console.error("encode-mongodb-uri-secret-payload: MONGO_RAW is empty");
  process.exit(1);
}
const cleaned = raw.replace(/^MONGODB_URI_B64\s*=\s*/, "");
try {
  const uri = parseMongoConnectionString(cleaned);
  process.stdout.write(Buffer.from(uri, "utf8").toString("base64"));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`encode-mongodb-uri-secret-payload: ${msg}`);
  process.exit(1);
}
