import { Buffer } from "node:buffer";

import { getEnv } from "@/lib/env";
import {
    sealMarketingXPostingAccessToken,
    sealMarketingXPostingRefreshToken,
    unsealMarketingXPostingAccessToken,
    unsealMarketingXPostingRefreshToken
} from "@/lib/marketing-x-oauth-seal";
import {
    getXchatPlatformSettings,
    persistMarketingXPostingOAuthTokens,
    type XchatPlatformSettingsDoc
} from "@/modules/xchat/xchat-platform-settings";

/** Refresh access token if it expires sooner than this (X access tokens last ~2h). */
const ACCESS_TOKEN_REFRESH_WITHIN_MS = 10 * 60 * 1000;

const LEGACY_ENV_CACHE_SAFETY_MS = 60_000;

type LegacyEnvAccessCache = {
  accessToken: string;
  expiresAtMs: number;
};

let legacyEnvAccessCache: LegacyEnvAccessCache | null = null;

/** Single-flight refresh for Mongo-managed credentials (multi-instance safe for DB writes; avoids duplicate refresh storms per instance). */
let managedRefreshInFlight: Promise<string | null> | null = null;

function getTokenEndpoint(): string {
  const configured = process.env.X_OAUTH_TOKEN_URL?.trim();
  return configured && configured.length > 0 ? configured : "https://api.x.com/2/oauth2/token";
}

function sealSecret(): string {
  const env = getEnv();
  return env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
}

type RefreshGrantResult = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function fetchRefreshTokenGrant(refreshTokenPlain: string): Promise<RefreshGrantResult> {
  const clientId = process.env.X_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Missing X_OAUTH_CLIENT_ID or X_OAUTH_CLIENT_SECRET");
  }

  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenPlain
    }).toString()
  });

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok) {
    const reason = payload?.error_description ?? payload?.error ?? `status ${response.status}`;
    throw new Error(`X OAuth token refresh failed: ${reason}`);
  }

  const access_token = payload?.access_token?.trim();
  if (!access_token) {
    throw new Error("X OAuth token refresh returned no access_token");
  }

  const expires_in =
    typeof payload?.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? Math.max(60, Math.floor(payload.expires_in))
      : 7200;

  return {
    access_token,
    refresh_token: payload?.refresh_token?.trim(),
    expires_in
  };
}

export function clearMarketingPostingOAuthRuntimeCaches(): void {
  legacyEnvAccessCache = null;
  managedRefreshInFlight = null;
}

/** @deprecated Prefer {@link clearMarketingPostingOAuthRuntimeCaches} */
export function clearXOAuthPostingMemoryCache(): void {
  clearMarketingPostingOAuthRuntimeCaches();
}

function readValidMongoAccessToken(doc: XchatPlatformSettingsDoc, nowMs: number): string | null {
  const sealedAccess = doc.marketingXPostingAccessTokenSealed?.trim();
  const exp = doc.marketingXPostingAccessTokenExpiresAt;
  const expMs = exp instanceof Date ? exp.getTime() : 0;
  if (!sealedAccess || expMs <= nowMs + ACCESS_TOKEN_REFRESH_WITHIN_MS) {
    return null;
  }
  const plain = unsealMarketingXPostingAccessToken(sealedAccess, sealSecret());
  return plain?.trim() ?? null;
}

async function refreshMongoPostingTokens(): Promise<string | null> {
  if (managedRefreshInFlight) {
    return managedRefreshInFlight;
  }

  managedRefreshInFlight = (async (): Promise<string | null> => {
    const fresh = await getXchatPlatformSettings();
    const sealedRt = fresh?.marketingXPostingRefreshTokenSealed?.trim();
    if (!sealedRt) {
      return null;
    }
    const rtPlain = unsealMarketingXPostingRefreshToken(sealedRt, sealSecret())?.trim();
    if (!rtPlain) {
      return null;
    }

    const grant = await fetchRefreshTokenGrant(rtPlain);
    const expiresAt = new Date(Date.now() + grant.expires_in * 1000);
    const nextRt = grant.refresh_token ?? rtPlain;
    const secret = sealSecret();

    await persistMarketingXPostingOAuthTokens({
      sealedRefreshToken: sealMarketingXPostingRefreshToken(nextRt, secret),
      sealedAccessToken: sealMarketingXPostingAccessToken(grant.access_token, secret),
      accessTokenExpiresAt: expiresAt
    });

    return grant.access_token;
  })().finally(() => {
    managedRefreshInFlight = null;
  });

  return managedRefreshInFlight;
}

async function resolveLegacyEnvAccessToken(envRefresh: string, forceRefresh: boolean): Promise<string | null> {
  const now = Date.now();
  if (
    !forceRefresh &&
    legacyEnvAccessCache &&
    legacyEnvAccessCache.expiresAtMs - LEGACY_ENV_CACHE_SAFETY_MS > now
  ) {
    return legacyEnvAccessCache.accessToken;
  }

  const grant = await fetchRefreshTokenGrant(envRefresh);
  legacyEnvAccessCache = {
    accessToken: grant.access_token,
    expiresAtMs: now + grant.expires_in * 1000
  };

  if (grant.refresh_token && grant.refresh_token !== envRefresh) {
    console.warn(
      "[marketing/x-oauth] X rotated the refresh token; legacy X_OAUTH_REFRESH_TOKEN cannot auto-persist. Use Admin → Connect X for posting so tokens stay in Mongo."
    );
  }

  return grant.access_token;
}

/**
 * Returns a valid Bearer access token for X API v2 posting (managed Mongo row or legacy env refresh token).
 * Persists rotated refresh + access + expiry in Mongo when using Connect OAuth.
 */
export async function getValidAccessTokenForMarketingPosting(options?: {
  /** Skip cached access token (e.g. after HTTP 401 from X). */
  forceRefresh?: boolean;
}): Promise<string | null> {
  const clientId = process.env.X_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  const envRefresh = process.env.X_OAUTH_REFRESH_TOKEN?.trim();
  const settings = await getXchatPlatformSettings();
  const mongoRt = settings?.marketingXPostingRefreshTokenSealed?.trim();

  if (mongoRt) {
    const nowMs = Date.now();
    if (!options?.forceRefresh) {
      const cached = settings ? readValidMongoAccessToken(settings, nowMs) : null;
      if (cached) {
        return cached;
      }
    }
    return refreshMongoPostingTokens();
  }

  if (!envRefresh) {
    return null;
  }

  return resolveLegacyEnvAccessToken(envRefresh, options?.forceRefresh === true);
}

/**
 * POST /2/tweets with retries (401/429 exponential backoff). Caller supplies trimmed text.
 */
export async function postMarketingTweetWithRetries(text: string): Promise<void> {
  let forceRefresh = false;
  let lastError = "post failed";

  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await getValidAccessTokenForMarketingPosting({ forceRefresh });
    if (!token) {
      throw new Error(
        "Missing X OAuth for posting: use Admin → Marketing → Connect X for posting (OAuth), or set legacy X_OAUTH_REFRESH_TOKEN with X_OAUTH_CLIENT_ID / X_OAUTH_CLIENT_SECRET."
      );
    }

    const response = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (response.ok) {
      return;
    }

    const body = await response.text();
    lastError = `X API error (${response.status}): ${body.slice(0, 240)}`;

    if (response.status === 401) {
      forceRefresh = true;
      clearMarketingPostingOAuthRuntimeCaches();
    }

    if (attempt < 2 && (response.status === 401 || response.status === 429)) {
      const delayMs = Math.min(8000, 400 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
}
