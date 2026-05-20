import { getDb } from "@/lib/mongodb";

const COLLECTION = "xchat_platform_settings" as const;
const SINGLETON_KEY = "default" as const;

export type XchatPlatformSettingsDoc = {
  singletonKey: typeof SINGLETON_KEY;
  /** Published xPersona ObjectId hex — default for app_user when no admin-assigned persona. */
  defaultAppUserPersonaId?: string;
  /**
   * Cap verbatim prior thread messages for **`grok-4.3`** ask turns (4–6). Older turns become one condensed digest block.
   * Omitted → **5**. Ignored for non–Grok 4.3 models.
   */
  xchatGrok43MaxPriorThreadMessages?: number;
  /** AES-GCM sealed refresh token for X marketing posting (see `marketing-x-oauth-seal.ts`). */
  marketingXPostingRefreshTokenSealed?: string;
  /** AES-GCM sealed access token (rotated by centralized token manager before each post when stale). */
  marketingXPostingAccessTokenSealed?: string;
  /** Wall-clock expiry for {@link marketingXPostingAccessTokenSealed}. */
  marketingXPostingAccessTokenExpiresAt?: Date;
  /** @username last linked for posting OAuth. */
  marketingXPostingLinkedUsername?: string;
  /** Space-separated OAuth 2.0 scopes from the last token response (e.g. includes `tweet.write` when posting is allowed). */
  marketingXPostingOAuthScopes?: string;
  marketingXPostingUpdatedAt?: Date;
  marketingXPostingUpdatedByUserId?: string;
  /** Numeric X user id (data.id from /2/users/me) for the account used for posting and ads targeting. */
  marketingXUserId?: string;
  /** Selected X Ads account id (e.g. "18ce54d4x5t") to use when creating ad campaigns / promoted posts. */
  marketingXAdsAccountId?: string;
  updatedAt: Date;
  updatedByUserId?: string;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      const db = await getDb();
      await db
        .collection(COLLECTION)
        .createIndex({ singletonKey: 1 }, { unique: true, name: "uniq_xchat_platform_singleton" });
    })();
  }
  await ensureIndexesPromise;
}

export async function getXchatPlatformSettings(): Promise<XchatPlatformSettingsDoc | null> {
  await ensureIndexes();
  const db = await getDb();
  return db.collection<XchatPlatformSettingsDoc>(COLLECTION).findOne({ singletonKey: SINGLETON_KEY });
}

export async function upsertXchatPlatformSettings(input: {
  defaultAppUserPersonaId: string | null | undefined;
  actorUserId: string;
}): Promise<XchatPlatformSettingsDoc> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const set: Partial<XchatPlatformSettingsDoc> = {
    updatedAt: now,
    updatedByUserId: input.actorUserId.trim() || undefined
  };
  if (input.defaultAppUserPersonaId === null || input.defaultAppUserPersonaId === undefined) {
    set.defaultAppUserPersonaId = undefined;
  } else {
    set.defaultAppUserPersonaId = input.defaultAppUserPersonaId.trim();
  }

  await db.collection<XchatPlatformSettingsDoc>(COLLECTION).updateOne(
    { singletonKey: SINGLETON_KEY },
    {
      $set: set,
      $setOnInsert: { singletonKey: SINGLETON_KEY }
    },
    { upsert: true }
  );

  const next = await getXchatPlatformSettings();
  if (!next) {
    throw new Error("xchat_platform_settings upsert failed");
  }
  return next;
}

export async function upsertMarketingXPostingOAuth(input: {
  sealedRefreshToken: string;
  linkedUsername: string;
  actorUserId: string;
  sealedAccessToken?: string;
  accessTokenExpiresAt?: Date;
  /** Raw `scope` string from X token endpoint (optional). */
  oauthScopes?: string | null;
  /** Numeric X user id captured during OAuth (optional but recommended for ads). */
  xUserId?: string | null;
}): Promise<XchatPlatformSettingsDoc> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const set: Record<string, unknown> = {
    marketingXPostingRefreshTokenSealed: input.sealedRefreshToken,
    marketingXPostingLinkedUsername: input.linkedUsername.trim().replace(/^@+/u, "").toLowerCase(),
    marketingXPostingUpdatedAt: now,
    marketingXPostingUpdatedByUserId: input.actorUserId.trim(),
    updatedAt: now,
    updatedByUserId: input.actorUserId.trim()
  };
  if (input.sealedAccessToken !== undefined && input.accessTokenExpiresAt !== undefined) {
    set.marketingXPostingAccessTokenSealed = input.sealedAccessToken;
    set.marketingXPostingAccessTokenExpiresAt = input.accessTokenExpiresAt;
  }
  if (input.oauthScopes !== undefined && input.oauthScopes !== null) {
    const s = input.oauthScopes.trim();
    set.marketingXPostingOAuthScopes = s.length > 0 ? s : undefined;
  }
  if (input.xUserId !== undefined && input.xUserId !== null) {
    const v = input.xUserId.trim();
    if (v.length > 0) {
      set.marketingXUserId = v;
    }
  }

  await db.collection<XchatPlatformSettingsDoc>(COLLECTION).updateOne(
    { singletonKey: SINGLETON_KEY },
    {
      $set: set,
      $setOnInsert: { singletonKey: SINGLETON_KEY }
    },
    { upsert: true }
  );

  const next = await getXchatPlatformSettings();
  if (!next) {
    throw new Error("xchat_platform_settings marketing OAuth upsert failed");
  }
  return next;
}

/** Persists sealed tokens after refresh-token grant (rotation + access). Used by `x-posting-token-manager`. */
export async function persistMarketingXPostingOAuthTokens(input: {
  sealedRefreshToken: string;
  sealedAccessToken: string;
  accessTokenExpiresAt: Date;
  actorUserId?: string;
  oauthScopes?: string | null;
}): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = {
    marketingXPostingRefreshTokenSealed: input.sealedRefreshToken,
    marketingXPostingAccessTokenSealed: input.sealedAccessToken,
    marketingXPostingAccessTokenExpiresAt: input.accessTokenExpiresAt,
    marketingXPostingUpdatedAt: now,
    updatedAt: now
  };
  if (input.actorUserId?.trim()) {
    $set.marketingXPostingUpdatedByUserId = input.actorUserId.trim();
    $set.updatedByUserId = input.actorUserId.trim();
  }
  if (input.oauthScopes !== undefined && input.oauthScopes !== null) {
    const s = input.oauthScopes.trim();
    $set.marketingXPostingOAuthScopes = s.length > 0 ? s : undefined;
  }

  await db.collection<XchatPlatformSettingsDoc>(COLLECTION).updateOne(
    { singletonKey: SINGLETON_KEY },
    { $set: $set, $setOnInsert: { singletonKey: SINGLETON_KEY } },
    { upsert: true }
  );
}

export async function clearMarketingXPostingOAuth(actorUserId: string): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<XchatPlatformSettingsDoc>(COLLECTION).updateOne(
    { singletonKey: SINGLETON_KEY },
    {
      $unset: {
        marketingXPostingRefreshTokenSealed: "",
        marketingXPostingAccessTokenSealed: "",
        marketingXPostingAccessTokenExpiresAt: "",
        marketingXPostingLinkedUsername: "",
        marketingXPostingOAuthScopes: "",
        marketingXPostingUpdatedAt: "",
        marketingXPostingUpdatedByUserId: ""
      },
      $set: {
        updatedAt: now,
        updatedByUserId: actorUserId.trim()
      },
      $setOnInsert: { singletonKey: SINGLETON_KEY }
    },
    { upsert: true }
  );
}

/** Persist the target X user id (numeric) and/or Ads account id for marketing / ad campaigns.
 * These are independent of the OAuth tokens and survive disconnect.
 */
export async function setMarketingXPostingTargetIds(input: {
  xUserId?: string | null;
  adsAccountId?: string | null;
  actorUserId: string;
}): Promise<XchatPlatformSettingsDoc> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const $set: Record<string, unknown> = {
    updatedAt: now,
    updatedByUserId: input.actorUserId.trim()
  };
  if (input.xUserId !== undefined) {
    const v = (input.xUserId ?? "").trim();
    $set.marketingXUserId = v.length > 0 ? v : undefined;
  }
  if (input.adsAccountId !== undefined) {
    const v = (input.adsAccountId ?? "").trim();
    $set.marketingXAdsAccountId = v.length > 0 ? v : undefined;
  }

  await db.collection<XchatPlatformSettingsDoc>(COLLECTION).updateOne(
    { singletonKey: SINGLETON_KEY },
    { $set, $setOnInsert: { singletonKey: SINGLETON_KEY } },
    { upsert: true }
  );

  const next = await getXchatPlatformSettings();
  if (!next) {
    throw new Error("xchat_platform_settings target ids update failed");
  }
  return next;
}

/** Normalize X OAuth `scope` response for checks (e.g. `tweet.write`). */
export function parseMarketingPostingOAuthScopesList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw.trim().split(/\s+/u).filter(Boolean);
}

/**
 * xAI hosted continuity (`store_messages` + `previous_response_id`).
 * Controlled by **`XCHAT_USE_REMOTE_HISTORY`** in `env.ts` (default false).
 */
export { isXchatRemoteHistoryEnabled } from "@/lib/env";
