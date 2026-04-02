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

/**
 * Operators sometimes set `NODE_ENV=stage` in `.env.stage`; Node / Zod only allow
 * `development` | `test` | `production`. Cloud Run staging uses `NODE_ENV=production`
 * + `ATX_DEPLOY_TARGET=stage` — map common mistakes so `seed:xpersonas` and `getEnv()` work.
 */
function preprocessNodeEnv(val: unknown): unknown {
  const v = emptyToUndefined(val);
  if (v === undefined) {
    return undefined;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "stage" || s === "staging") {
    return "production";
  }
  return v;
}

const envSchema = z.object({
  /** Plain `mongodb://` / `mongodb+srv://`, or base64 of either (same as Spring `MongoUriResolver`). */
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().optional()),
  XAI_API_KEY: z.string().min(1),
  XAI_MANAGEMENT_API_KEY: z.string().min(1),
  XAI_TEAM_ID: optionalNonEmptyString,
  /** Logical org key stored on portfolio docs (`tenantPortfolioOrgKey`); default `org-atx-finance`. */
  TENANT_PORTFOLIO_ORG_KEY: optionalNonEmptyString,
  X_OAUTH_CLIENT_ID: z.string().min(1),
  X_OAUTH_CLIENT_SECRET: z.string().min(1),
  X_OAUTH_CALLBACK_URL: optionalUrl,
  X_OAUTH_AUTHORIZE_URL: optionalUrl,
  X_OAUTH_TOKEN_URL: optionalUrl,
  X_OAUTH_USERINFO_URL: optionalUrl,
  /** Google OAuth (Sign in with Google) — optional; enable `/api/auth/google/*` when both are set. */
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  GOOGLE_OAUTH_CALLBACK_URL: optionalUrl,
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
  /**
   * When X userinfo omits `email`, OAuth still matches the seeded admin if this equals the X numeric user id.
   * Set alongside `ADMIN_SEED_EMAIL`; `npm run seed:admin` can persist the same id on `core_users.xAccount`.
   */
  ADMIN_SEED_X_USER_ID: optionalNonEmptyString,
  ADMIN_X_USERNAMES: z.string().optional(),
  ENABLE_XCHAT_DEBUG: z.union([z.string(), z.boolean()]).optional(),
  /**
   * Same prefix seed uses for `{root}-rag` and `{root}-xoption-<env>`. When set, per-user xChat history
   * collections are named `{root}-chat-{userId}` so they group with instance RAG in xAI.
   */
  ATX_INSTANCE_COLLECTION_ROOT: optionalNonEmptyString,
  /** Optional overrides for `/xstrategybuilder` licensing line (see `LICENSING_PITCH_CONTACT_DEFAULTS`). */
  XSTRATEGYBUILDER_LICENSING_EMAIL: optionalEmail,
  XSTRATEGYBUILDER_LICENSING_X_URL: optionalUrl,
  XSTRATEGYBUILDER_LICENSING_X_LABEL: optionalNonEmptyString,
  XSTRATEGYBUILDER_COMPANY_EMAIL: optionalEmail,
  NODE_ENV: z.preprocess(
    preprocessNodeEnv,
    z.enum(["development", "test", "production"]).optional().default("development")
  ),
  /**
   * When true, `global_admin` may list and mutate **any** portfolio via `/api/admin/portfolios` (support / break-glass).
   * When false (default), list + per-portfolio routes are scoped to the session `userId` + `tenantId`.
   */
  ADMIN_PORTFOLIOS_LIST_ALL: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") {
        return false;
      }
      if (typeof v === "boolean") {
        return v;
      }
      const s = String(v).trim().toLowerCase();
      return s === "1" || s === "true" || s === "yes";
    },
    z.boolean().optional().default(false)
  ),
  /**
   * When true, all portfolio accounts are treated as options-approved in xOptions context unless
   * `Account.optionsTradingEnabled` is explicitly false.
   */
  XOPTIONS_ASSUME_OPTIONS_APPROVED: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") {
        return false;
      }
      if (typeof v === "boolean") {
        return v;
      }
      const s = String(v).trim().toLowerCase();
      return s === "1" || s === "true" || s === "yes";
    },
    z.boolean().optional().default(false)
  ),
  /** Optional absolute URL for xOptions “enable options” CTA (broker application, etc.). */
  NEXT_PUBLIC_XOPTIONS_OPTIONS_APPLY_URL: optionalUrl,
  /** Stripe publishable key (`pk_…`); Cloud Run mounts from Secret Manager. */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalNonEmptyString,
  /** Often same as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; mounted as a separate secret alias. */
  STRIPE_PUBLIC_KEY: optionalNonEmptyString,
  /** Server-only Stripe secret (`sk_…`); Checkout — never expose to the client. */
  STRIPE_SECRET_KEY: optionalNonEmptyString
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

/**
 * Base logical MongoDB name before deploy-target suffix. When `MONGODB_DB_NAME` is unset, Cloud Run and
 * local tooling may set `ATX_DEPLOY_TARGET` (`stage` | `deploy` | `prod`) so the default becomes
 * `atxfinance-<target>`. Explicit `MONGODB_DB_NAME` or the DB path inside `MONGODB_URI` always wins.
 */
export const MONGODB_DB_NAME = "atxfinance";

export type AtxDeployTargetToken = "stage" | "deploy" | "prod";

function normalizeDeployTargetToken(raw: string | undefined): AtxDeployTargetToken | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const t = String(raw).trim().toLowerCase();
  if (t === "stage" || t === "deploy" || t === "prod") {
    return t;
  }
  return undefined;
}

/** Effective DB name for local URI fallback and `getDb()` when not embedded in `MONGODB_URI`. */
export function resolveDefaultMongoDatabaseName(): string {
  const explicit = process.env.MONGODB_DB_NAME?.trim();
  if (explicit) {
    return explicit;
  }
  const target =
    normalizeDeployTargetToken(process.env.ATX_DEPLOY_TARGET) ??
    normalizeDeployTargetToken(process.env.DEPLOY_TARGET);
  if (target) {
    return `${MONGODB_DB_NAME}-${target}`;
  }
  return MONGODB_DB_NAME;
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
  const dbName = resolveDefaultMongoDatabaseName().trim();
  const host = process.env.MONGODB_HOST?.trim() || "localhost";
  const noAuth = process.env.MONGODB_NO_AUTH === "true" || process.env.MONGODB_NO_AUTH === "1";
  const username = process.env.MONGO_ROOT_USERNAME?.trim() || "admin";
  const password = (process.env.MONGO_ROOT_PASSWORD ?? "").trim();

  const hasAuth = !noAuth && Boolean(username && password);
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
 * Whether Google OAuth routes should be wired. Reads `process.env` only — does not call {@link getEnv}
 * so `next build` / static prerender (e.g. `/`, `/login`) succeeds in CI without xAI/OAuth secrets.
 */
export function isGoogleOAuthConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}

export function getGoogleClientId(): string {
  const id = getEnv().GOOGLE_CLIENT_ID?.trim();
  if (!id) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return id;
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

/** When true, xChat emits detailed payload logs for RAG/expert learning. Set ENABLE_XCHAT_DEBUG=true in GCP. Tenant override: `core_tenants.tenantPreferences.xchat_debug_enabled`. */
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

/** Env-only gate for xChat `[xchat/debug]` logs (`ENABLE_XCHAT_DEBUG`). */
export function isXchatDebugEnvEnabled(): boolean {
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
  const resolvedDbName = dbName && dbName.length > 0 ? dbName : resolveDefaultMongoDatabaseName();
  return `${hosts}/${resolvedDbName}`;
}

/** Default xAI API base URL when XAI_BASE_URL env is unset. Aligned with tenant_defaults.yaml. */
export const XAI_BASE_URL_DEFAULT = "https://api.x.ai/v1";

/** Default xAI Management API base URL when XAI_MANAGEMENT_BASE_URL env is unset. Aligned with tenant_defaults.yaml. */
export const XAI_MANAGEMENT_BASE_URL_DEFAULT = "https://management-api.x.ai/v1";
