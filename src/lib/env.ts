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
  MONGODB_URI_B64: z.string().min(1).optional(),
  MONGODB_URI_B4: z.string().min(1).optional(),
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

export function getMongoUriFromB64(): string {
  const { MONGODB_URI_B64, MONGODB_URI_B4 } = getEnv();
  const encoded = MONGODB_URI_B64 ?? MONGODB_URI_B4;
  if (encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();
    if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
      throw new Error("Invalid MONGODB_URI_B64: decoded value is not a MongoDB URI");
    }
    return decoded;
  }

  // Fallback: local MongoDB on localhost:27017 with optional credentials from env
  const dbName = (process.env.MONGODB_DB_NAME?.trim() || MONGODB_DB_NAME).trim();
  const username = (process.env.ADMIN_X_USERNAME?.trim() || process.env.ADMIN_X_USERNAMES?.trim());
  const password = process.env.MONGO_ROOT_PASSWORD?.trim();
  const host = process.env.MONGODB_HOST?.trim() || "localhost";

  const hasAuth = Boolean(username && password);
  const authPart = hasAuth ? `${encodeURIComponent(username!)}:${encodeURIComponent(password!)}@` : "";
  const params = hasAuth ? "?authSource=admin" : "";

  return `mongodb://${authPart}${host}:27017/${dbName}${params}`;
}

export function getXOauthClientId(): string {
  const { X_OAUTH_CLIENT_ID } = getEnv();
  return X_OAUTH_CLIENT_ID.trim();
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
  const uri = getMongoUriFromB64();
  const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const withoutCredentials = withoutProtocol.includes("@")
    ? withoutProtocol.split("@").slice(1).join("@")
    : withoutProtocol;
  const [hostsAndPath] = withoutCredentials.split("?");
  const [hosts, dbName] = hostsAndPath.split("/", 2);
  const resolvedDbName = dbName && dbName.length > 0 ? dbName : MONGODB_DB_NAME;
  return `${hosts}/${resolvedDbName}`;
}

export const MONGODB_DB_NAME = "atxfinancedb";