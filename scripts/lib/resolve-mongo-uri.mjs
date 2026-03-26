import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Local Mongo URI resolution for Node scripts (seed, migrations).
 * Aligned with `getMongoUri()` in `src/lib/env.ts`: `MONGODB_URI` may be plain or base64;
 * legacy `MONGODB_URI_B64` is still read when `MONGODB_URI` is unset.
 *
 * Admin seed (`seed-admin-user.mjs`) uses {@link resolveAdminSeedDbName}: base name + `-` + app version
 * (from `ADMIN_SEED_APP_VERSION`, `npm_package_version`, or repo `package.json`) so each release targets a
 * distinct database until ops updates `MONGODB_URI` / `MONGODB_DB_NAME` in Secret Manager. Set
 * `ADMIN_SEED_DB_VERSION_SUFFIX=off` to keep the legacy single-DB name for local/support.
 *
 * **Next.js `getDb()`** uses `resolveDefaultMongoDatabaseName()` in `src/lib/env.ts` (no version suffix). Standalone
 * TS disk→Mongo sync scripts use that default; `seed:admin` post-steps set **`SEED_PARENT_MONGODB_DB_NAME`** to this
 * admin DB so child processes match the main seed transaction — see `scripts/lib/sync-target-mongo-db.ts`.
 *
 * When `MONGODB_DB_NAME` is unset, `ATX_DEPLOY_TARGET` or `DEPLOY_TARGET` may be `stage`, `deploy`, or `prod`
 * (case-insensitive) to default to `atxfinance-<target>` — aligned with `resolveDefaultMongoDatabaseName()` in `src/lib/env.ts`.
 */
const DEFAULT_DB_BASE = "atxfinance";

function normalizeDeployTargetToken(raw) {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const t = String(raw).trim().toLowerCase();
  if (t === "stage" || t === "deploy" || t === "prod") {
    return t;
  }
  return undefined;
}

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
  const explicit = process.env.MONGODB_DB_NAME?.trim();
  if (explicit) {
    return explicit;
  }
  const target =
    normalizeDeployTargetToken(process.env.ATX_DEPLOY_TARGET) ??
    normalizeDeployTargetToken(process.env.DEPLOY_TARGET);
  if (target) {
    return `${DEFAULT_DB_BASE}-${target}`;
  }
  return DEFAULT_DB_BASE;
}

function readPackageJsonVersion() {
  const override = process.env.ADMIN_SEED_APP_VERSION?.trim();
  if (override) {
    return override;
  }
  const fromNpm = process.env.npm_package_version?.trim();
  if (fromNpm) {
    return fromNpm;
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    return "0.0.0";
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const v = String(pkg.version ?? "0.0.0").trim();
    return v || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** MongoDB database names: letters, digits, `_`, `-`, `.` (avoid `/` etc.). */
function mongoSafeVersionToken(version) {
  const t = String(version)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return t || "0";
}

/**
 * Database name for `npm run seed:admin` only. Appends `-${versionToken}` to the logical base
 * (`resolveSeedDbName()` base) unless `ADMIN_SEED_DB_VERSION_SUFFIX` is `off`, `false`, `0`, `legacy`, or `no`.
 */
export function resolveAdminSeedDbName() {
  const base = resolveSeedDbName();
  const flag = process.env.ADMIN_SEED_DB_VERSION_SUFFIX?.trim().toLowerCase() ?? "";
  if (flag === "off" || flag === "false" || flag === "0" || flag === "legacy" || flag === "no") {
    return base;
  }
  const token = mongoSafeVersionToken(readPackageJsonVersion());
  const suffix = `-${token}`;
  if (base.endsWith(suffix)) {
    return base;
  }
  return `${base}${suffix}`;
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
  const password = (process.env.MONGO_ROOT_PASSWORD ?? "").trim();
  const username = mongoRootUsername;

  const hasAuth = !noAuth && Boolean(username && password);
  const authPart = hasAuth ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
  const params = hasAuth ? "?authSource=admin" : "";

  return `mongodb://${authPart}${host}:27017/${dbName}${params}`;
}
