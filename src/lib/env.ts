import { z } from "zod";

/** Cloud Run / GitHub sometimes inject `KEY=` (empty); treat as unset so `.url()` does not fail startup. */
function emptyToUndefined(val: unknown): unknown {
  if (val === undefined || val === null) {
    return undefined;
  }
  if (typeof val === "string" && val.trim() === "") {
    return undefined;
  }
  return val;
}

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalAuthSecret = z.preprocess(
  emptyToUndefined,
  z.string().min(16).optional()
);
const optionalNonEmptyString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional()
);
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());

const envSchema = z.object({
  /** Plain `mongodb://` / `mongodb+srv://`, or base64 of either (same as Spring `MongoUriResolver`). */
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().optional()),
  XAI_API_KEY: z.string().min(1),
  XAI_MANAGEMENT_API_KEY: z.string().min(1),
  XAI_TEAM_ID: optionalNonEmptyString,
  ATXFINANCE_COLLECTION_ID: optionalNonEmptyString,
  /** Logical org key stored on portfolio docs (`tenantPortfolioOrgKey`); default `org-atx-finance`. */
  TENANT_PORTFOLIO_ORG_KEY: optionalNonEmptyString,
  X_OAUTH_CLIENT_ID: z.string().min(1),
  X_OAUTH_CLIENT_SECRET: z.string().min(1),
  X_OAUTH_CALLBACK_URL: optionalUrl,
  X_OAUTH_AUTHORIZE_URL: optionalUrl,
  X_OAUTH_TOKEN_URL: optionalUrl,
  X_OAUTH_USERINFO_URL: optionalUrl,
  XAI_BASE_URL: optionalUrl,
  XAI_MANAGEMENT_BASE_URL: optionalUrl,
  XAI_CHAT_MODEL: optionalNonEmptyString,
  AUTH_SECRET: optionalAuthSecret,
  ALLOW_ANY_X_USER_LOGIN: z.union([z.string(), z.boolean()]).optional(),
  SLACK_WEBHOOK_URL: z.union([z.string().url(), z.literal("")]).optional(),
  ADMIN_SEED_EMAIL: z.preprocess(
    (val) => {
      if (val === undefined || val === null) {
        return undefined;
      }
      if (typeof val === "string" && val.trim() === "") {
        return undefined;
      }
      return typeof val === "string" ? val.trim() : val;
    },
    z.string().email().optional()
  ),
  ADMIN_X_USERNAMES: z.string().optional(),
  ENABLE_XCHAT_DEBUG: z.union([z.string(), z.boolean()]).optional(),
  /** Optional overrides for `/xstrategybuilder` licensing line (see `LICENSING_PITCH_CONTACT_DEFAULTS`). */
  XSTRATEGYBUILDER_LICENSING_EMAIL: optionalEmail,
  XSTRATEGYBUILDER_LICENSING_X_URL: optionalUrl,
  XSTRATEGYBUILDER_LICENSING_X_LABEL: optionalNonEmptyString,
  XSTRATEGYBUILDER_COMPANY_EMAIL: optionalEmail,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development")
});

export const REQUIRED_RUNTIME_ENV_VARS = [
  "XAI_API_KEY",
  "XAI_MANAGEMENT_API_KEY",
  "X_OAUTH_CLIENT_ID",
  "X_OAUTH_CLIENT_SECRET"
] as const;

type Env = z.infer<typeof envSchema>;

let envCache: Env | null = null;

export function getEnv(): Env {
  if (envCache) {
    return envCache;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.message}`
    );
  }

  envCache = parsed.data;
  return envCache;
}

/**
 * Parses `MONGODB_URI` when it is either a real Mongo URI or base64-encoded (GCP / Cursor-friendly).
 */
export function parseMongoConnectionString(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("mongodb://") || t.startsWith("mongodb+srv://")) {
    return t;
  }
  let decoded: string;
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

/** Resolved Mongo connection string (Atlas, local Docker, or compose fallback). */
export function getMongoUri(): string {
  const fromZod = getEnv().MONGODB_URI;
  const legacyB64 = process.env.MONGODB_URI_B64?.trim();
  const raw = (fromZod && fromZod.length > 0 ? fromZod : undefined) ?? (legacyB64 && legacyB64.length > 0 ? legacyB64 : undefined);
  if (raw) {
    return parseMongoConnectionString(raw);
  }

  // Fallback: local MongoDB on localhost:27017 with optional credentials from env
  // (Keep aligned with scripts/lib/resolve-mongo-uri.mjs for seed/migrations.)
  const dbName = (process.env.MONGODB_DB_NAME?.trim() || MONGODB_DB_NAME).trim();
  const host = process.env.MONGODB_HOST?.trim() || "localhost";

  const adminUserFromEnv =
    process.env.ADMIN_X_USERNAME?.trim() ||
    process.env.ADMIN_X_USERNAMES?.trim()?.split(",")[0]?.trim();
  const explicitMongoPassword = process.env.MONGO_ROOT_PASSWORD?.trim();
  let username = adminUserFromEnv;
  let password = explicitMongoPassword;

  // docker-compose.yml creates MONGO_INITDB_ROOT_USERNAME default `admin` (+ password). ADMIN_X_USERNAMES
  // is for app allowlists — using it as Mongo user without MONGO_ROOT_PASSWORD caused wronguser:atxrocks!
  // and Authentication failed. Only use env username for Mongo when both user + password are explicit.
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (localHosts.has(host)) {
    const explicitMongoPair = Boolean(adminUserFromEnv && explicitMongoPassword);
    if (!explicitMongoPair) {
      username = "admin";
      password = explicitMongoPassword || "atxrocks!";
    }
  }

  const hasAuth = Boolean(username && password);
  const authPart = hasAuth ? `${encodeURIComponent(username!)}:${encodeURIComponent(password!)}@` : "";
  const params = hasAuth ? "?authSource=admin" : "";

  return `mongodb://${authPart}${host}:27017/${dbName}${params}`;
}

/** @deprecated Use {@link getMongoUri} — name kept for call sites. */
export const getMongoUriFromB64 = getMongoUri;

export function getXOauthClientId(): string {
  const { X_OAUTH_CLIENT_ID } = getEnv();
  return X_OAUTH_CLIENT_ID.trim();
}

/**
 * Spring API base for BFF proxy (`src/lib/backend-bff.ts`). Read from `process.env` only so route handlers
 * and tests do not require full `getEnv()` (xAI / OAuth keys). Validate with `URL` when set.
 */
export function getAtxfinanceBackendOrigin(): string | undefined {
  const raw = process.env.ATXFINANCE_BACKEND_ORIGIN?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    const u = new URL(raw);
    return u.origin.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Public Spring origin for client `fetch` (only when using direct browser → backend + CORS).
 * Does not use `getEnv()` so client bundles avoid pulling full server env validation.
 */
export function getPublicAtxfinanceBackendOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_ATXFINANCE_BACKEND_ORIGIN?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return undefined;
  }
}

export function isAllowAnyXUserLoginEnabled(): boolean {
  const { ALLOW_ANY_X_USER_LOGIN } = getEnv();
  if (typeof ALLOW_ANY_X_USER_LOGIN === "boolean") {
    return ALLOW_ANY_X_USER_LOGIN;
  }
  if (typeof ALLOW_ANY_X_USER_LOGIN === "string") {
    return ALLOW_ANY_X_USER_LOGIN.trim().toLowerCase() === "true";
  }
  return false;
}

/** When true, xChat emits detailed payload logs for RAG/expert learning. Set ENABLE_XCHAT_DEBUG=true in GCP. */
export type LicensingPitchContact = {
  licensingEmail?: string;
  licensingXUrl?: string;
  licensingXLabel?: string;
  companyEmail?: string;
};

/**
 * Default public licensing contact on `/xstrategybuilder` (committed on `main`).
 * Override per deploy with `XSTRATEGYBUILDER_LICENSING_*` / `XSTRATEGYBUILDER_COMPANY_EMAIL`.
 */
export const LICENSING_PITCH_CONTACT_DEFAULTS: Readonly<
  Pick<LicensingPitchContact, "licensingEmail" | "licensingXUrl" | "licensingXLabel">
> = {
  licensingEmail: "sperezintexas@gmail.com",
  licensingXUrl: "https://x.com/sperezintexas",
  licensingXLabel: "@sperezintexas"
};

function trimEnv(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const t = String(value).trim();
  return t.length > 0 ? t : undefined;
}

/**
 * xStrategyBuilder licensing CTA. Uses `process.env` (not `getEnv()`) so defaults work in tests/scripts
 * without full app env; optional fields from zod remain available via `getEnv()` elsewhere.
 */
export function getLicensingPitchContact(): LicensingPitchContact {
  const emailOverride = trimEnv(process.env.XSTRATEGYBUILDER_LICENSING_EMAIL);
  const xUrlOverride = trimEnv(process.env.XSTRATEGYBUILDER_LICENSING_X_URL);
  const xLabelOverride = trimEnv(process.env.XSTRATEGYBUILDER_LICENSING_X_LABEL);
  const companyOverride = trimEnv(process.env.XSTRATEGYBUILDER_COMPANY_EMAIL);

  return {
    licensingEmail: emailOverride ?? LICENSING_PITCH_CONTACT_DEFAULTS.licensingEmail,
    licensingXUrl: xUrlOverride ?? LICENSING_PITCH_CONTACT_DEFAULTS.licensingXUrl,
    licensingXLabel: xLabelOverride ?? LICENSING_PITCH_CONTACT_DEFAULTS.licensingXLabel,
    companyEmail: companyOverride
  };
}

export function isXchatDebugEnabled(): boolean {
  const val = process.env.ENABLE_XCHAT_DEBUG;
  if (typeof val === "boolean") {
    return val;
  }
  if (typeof val === "string") {
    return val.trim().toLowerCase() === "true";
  }
  return false;
}

/** App_user header “stealth” DB chip: on in dev/test; in production only if `APP_USER_SHOW_DB_ENDPOINT=true`. */
export function shouldShowAppUserDbLabel(): boolean {
  const n = process.env.NODE_ENV ?? "development";
  if (n !== "production") {
    return true;
  }
  return process.env.APP_USER_SHOW_DB_ENDPOINT === "true";
}

export function getMongoConnectionLabel(): string {
  const uri = getMongoUri();
  const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const withoutCredentials = withoutProtocol.includes("@")
    ? withoutProtocol.split("@").slice(1).join("@")
    : withoutProtocol;
  const [hostsAndPath] = withoutCredentials.split("?");
  const [hosts, dbName] = hostsAndPath.split("/", 2);
  const resolvedDbName = dbName && dbName.length > 0 ? dbName : MONGODB_DB_NAME;
  return `${hosts}/${resolvedDbName}`;
}

/**
 * Canonical application database name: **one MongoDB database per deployment** (staging vs production
 * use separate clusters/URIs; tenant isolation within the app uses `tenantId` / org keys on documents).
 * Override with `MONGODB_DB_NAME` only for local tooling if you must match a non-default DB path.
 */
export const MONGODB_DB_NAME = "atxfinancedb";