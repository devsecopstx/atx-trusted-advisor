/**
 * Local Mongo URI resolution for Node scripts (seed, migrations).
 * Keep behavior aligned with `getMongoUriFromB64()` in `src/lib/env.ts` when MONGODB_URI_B64 is unset.
 */
const DEFAULT_DB_NAME = "atxfinancedb";

export function resolveSeedDbName() {
  return (process.env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME).trim();
}

/**
 * @returns {string} Mongo connection URI
 */
export function resolveMongoUri() {
  const encoded = process.env.MONGODB_URI_B64 ?? process.env.MONGODB_URI_B4;
  if (encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
    if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
      throw new Error("Invalid MONGODB_URI_B64: decoded value is not a MongoDB URI");
    }
    return decoded;
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
