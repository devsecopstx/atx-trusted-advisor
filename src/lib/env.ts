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

const envSchema = z.object({
  MONGODB_URI_B64: z.string().min(1).optional(),
  MONGODB_URI_B4: z.string().min(1).optional(),
  XAI_API_KEY: z.string().min(1),
  XAI_MANAGEMENT_API_KEY: z.string().min(1),
  X_OAUTH_CLIENT_ID: z.string().min(1),
  X_OAUTH_CLIENT_SECRET: z.string().min(1),
  X_OAUTH_CALLBACK_URL: optionalUrl,
  X_OAUTH_AUTHORIZE_URL: optionalUrl,
  X_OAUTH_TOKEN_URL: optionalUrl,
  X_OAUTH_USERINFO_URL: optionalUrl,
  XAI_BASE_URL: optionalUrl,
  XAI_MANAGEMENT_BASE_URL: optionalUrl,
  XAI_CHAT_MODEL: z.string().min(1).optional(),
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
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development")
}).superRefine((value, ctx) => {
  if (!value.MONGODB_URI_B64 && !value.MONGODB_URI_B4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Set MONGODB_URI_B64 (or legacy alias MONGODB_URI_B4)"
    });
  }
});

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
  if (!encoded) {
    throw new Error("Missing Mongo URI: set MONGODB_URI_B64 or MONGODB_URI_B4");
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();

  if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
    throw new Error("Invalid MONGODB_URI_B64: decoded value is not a MongoDB URI");
  }

  return decoded;
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

/** App-user header “stealth” DB chip: on in dev/test; in production only if `APP_USER_SHOW_DB_ENDPOINT=true`. */
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
