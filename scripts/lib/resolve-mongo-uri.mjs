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
  const adminUserFromEnv =
    process.env.ADMIN_X_USERNAME?.trim() ||
    process.env.ADMIN_X_USERNAMES?.trim()?.split(",")[0]?.trim();
  const explicitMongoPassword = process.env.MONGO_ROOT_PASSWORD?.trim();
  let username = adminUserFromEnv;
  let password = explicitMongoPassword;

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (localHosts.has(host)) {
    const explicitMongoPair = Boolean(adminUserFromEnv && explicitMongoPassword);
    if (!explicitMongoPair) {
      username = "admin";
      password = explicitMongoPassword || "atxrocks!";
    }
  }

  const hasAuth = Boolean(username && password);
  const authPart = hasAuth ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
  const params = hasAuth ? "?authSource=admin" : "";

  return `mongodb://${authPart}${host}:27017/${dbName}${params}`;
}
