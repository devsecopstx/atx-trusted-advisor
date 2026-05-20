import { NextResponse } from "next/server";

import {
    clearMarketingPostingOAuthFlowCookies,
    consumeMarketingPostingReturnPathCookie,
    getSessionUser,
    readMarketingPostingOAuthFlowCookies
} from "@/lib/auth";
import { getEnv, getXOauthClientId } from "@/lib/env";
import { getPublicOriginFromRequest } from "@/lib/http-origin";
import { sealMarketingXPostingAccessToken, sealMarketingXPostingRefreshToken } from "@/lib/marketing-x-oauth-seal";
import { fetchXUserMe } from "@/lib/x-api-users-me";
import { resolveXOAuthRedirectUri } from "@/lib/x-oauth-redirect-uri";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { clearMarketingPostingOAuthRuntimeCaches } from "@/modules/marketing/x-posting-token-manager";
import { upsertMarketingXPostingOAuth } from "@/modules/xchat/xchat-platform-settings";

function redirectAdmin(origin: string, query: Record<string, string>): NextResponse {
  const target = new URL("/admin/marketing", origin);
  for (const [k, v] of Object.entries(query)) {
    target.searchParams.set(k, v);
  }
  return NextResponse.redirect(target.toString());
}

/**
 * Completes marketing X posting OAuth when the callback hits `/api/auth/x/callback`
 * (same redirect_uri as user login — must be whitelisted once on the X app).
 */
export async function tryMarketingPostingOAuthCallback(request: Request): Promise<NextResponse | null> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code?.trim() || !state) {
    return null;
  }

  const flow = await readMarketingPostingOAuthFlowCookies();
  if (!flow.state || !flow.verifier || flow.state !== state) {
    return null;
  }

  await clearMarketingPostingOAuthFlowCookies();

  const env = getEnv();
  const origin = getPublicOriginFromRequest(request);
  const session = await getSessionUser();
  if (!session || !isGlobalAdmin(session.roles)) {
    return redirectAdmin(origin, { posting_oauth: "forbidden" });
  }

  const tokenUrl = env.X_OAUTH_TOKEN_URL ?? "https://api.x.com/2/oauth2/token";
  const callbackUrl = resolveXOAuthRedirectUri(request);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${getXOauthClientId()}:${env.X_OAUTH_CLIENT_SECRET}`, "utf8").toString(
        "base64"
      )}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      code_verifier: flow.verifier
    }).toString()
  });

  const tokenJson = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    /** Space-delimited scopes granted for this token (should include `tweet.write` for POST /2/tweets). */
    scope?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenResponse.ok || !tokenJson?.access_token) {
    const reason = tokenJson?.error_description ?? tokenJson?.error ?? `status ${tokenResponse.status}`;
    return redirectAdmin(origin, { posting_oauth: "token_failed", posting_oauth_detail: reason.slice(0, 120) });
  }

  const refreshToken = tokenJson.refresh_token?.trim();
  if (!refreshToken) {
    return redirectAdmin(origin, {
      posting_oauth: "no_refresh_token",
      posting_oauth_detail: "Reconnect with offline.access scope"
    });
  }

  const me = await fetchXUserMe(tokenJson.access_token);
  const username = me?.username ?? session.username ?? "unknown";
  const xUserId = me?.id ?? null;

  const secret = env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
  const sealedRt = sealMarketingXPostingRefreshToken(refreshToken, secret);
  const expiresInSec =
    typeof tokenJson.expires_in === "number" && Number.isFinite(tokenJson.expires_in)
      ? Math.max(60, Math.floor(tokenJson.expires_in))
      : 7200;
  const accessExpiresAt = new Date(Date.now() + expiresInSec * 1000);
  const sealedAt = sealMarketingXPostingAccessToken(tokenJson.access_token, secret);

  await upsertMarketingXPostingOAuth({
    sealedRefreshToken: sealedRt,
    sealedAccessToken: sealedAt,
    accessTokenExpiresAt: accessExpiresAt,
    linkedUsername: username,
    actorUserId: session.userId,
    oauthScopes: tokenJson.scope ?? null,
    xUserId
  });
  clearMarketingPostingOAuthRuntimeCaches();

  const returnPath = await consumeMarketingPostingReturnPathCookie();
  if (returnPath) {
    const dest = new URL(returnPath, origin);
    dest.searchParams.set("posting_oauth", "connected");
    dest.searchParams.set("posting_username", username);
    return NextResponse.redirect(dest.toString());
  }

  return redirectAdmin(origin, { posting_oauth: "connected", posting_username: username });
}
