/**
 * Local Mongo URI resolution for Node scripts (seed, migrations).
 * Aligned with `getMongoUri()` in `src/lib/env.ts`: `MONGODB_URI` may be plain or base64;
 * legacy `MONGODB_URI_B64` is still read when `MONGODB_URI` is unset.
 */
const DEFAULT_DB_NAME = "atxfinancedb";

export function parseMongoConnectionString(raw) {
  const t = raw.trim();
  if (t.startsWith("mongodb://") || t.startsWith("mongodb+srv://")) {
    return t;
  }
  let decoded;
  try {
    decoded = Buffer.from(t, "base64").toString("utf8").trim();
  } catch {
    throw new Error("MONGODB_URI is not a valid MongoDB URI or base64 thereof");
  }
  if (decoded.startsWith("mongodb://") || decoded.startsWith("mongodb+srv://")) {
    return decoded;
  }
  try {
    decoded = Buffer.from(t, "base64url").toString("utf8").trim();
  } catch {
    throw new Error("MONGODB_URI is not a valid MongoDB URI or base64 thereof");
  }
  if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
    throw new Error("Invalid MONGODB_URI: decoded value is not a MongoDB URI");
  }
  return decoded;
}

export function resolveSeedDbName() {
  return (process.env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME).trim();
}

/**
 * @returns {string} Mongo connection URI
 */
export function resolveMongoUri() {
  const raw = process.env.MONGODB_URI?.trim() || process.env.MONGODB_URI_B64?.trim();
  if (raw) {
    return parseMongoConnectionString(raw);
  }

  const dbName = resolveSeedDbName();
  const host = process.env.MONGODB_HOST?.trim() || "localhost";
  const noAuth = process.env.MONGODB_NO_AUTH === "true" || process.env.MONGODB_NO_AUTH === "1";
  const mongoRootUsername = process.env.MONGO_ROOT_USERNAME?.trim() || "admin";
  const password = process.env.MONGO_ROOT_PASSWORD?.trim() || "atxrocks!";
  const username = mongoRootUsername;

  const hasAuth = !noAuth && Boolean(username && password);
  const authPart = hasAuth ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
  const params = hasAuth ? "?authSource=admin" : "";

  return `mongodb://${authPart}${host}:27017/${dbName}${params}`;
}
