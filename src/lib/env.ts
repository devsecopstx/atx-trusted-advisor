import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI_B64: z.string().min(1).optional(),
  MONGODB_URI_B4: z.string().min(1).optional(),
  XAI_API_KEY: z.string().min(1),
  XAI_MANAGEMENT_API_KEY: z.string().min(1).optional(),
  X_OAUTH_CLIENT_ID: z.string().min(1),
  X_OAUTH_CLIENT_SECRET: z.string().min(1),
  X_OAUTH_CALLBACK_URL: z.string().url().optional(),
  X_OAUTH_AUTHORIZE_URL: z.string().url().optional(),
  X_OAUTH_TOKEN_URL: z.string().url().optional(),
  X_OAUTH_USERINFO_URL: z.string().url().optional(),
  XAI_BASE_URL: z.string().url().optional(),
  XAI_MANAGEMENT_BASE_URL: z.string().url().optional(),
  XAI_CHAT_MODEL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_X_USERNAMES: z.string().optional(),
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

export const MONGODB_DB_NAME = "xfinancedb";
