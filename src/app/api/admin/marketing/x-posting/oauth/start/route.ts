import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
    applyMarketingPostingOAuthFlowCookiesToRedirect,
    applyMarketingPostingReturnPathCookie,
    createCodeChallenge,
    createCodeVerifier,
    createOAuthState,
    isSafeOAuthReturnPath
} from "@/lib/auth";
import { getEnv, getXOauthClientId } from "@/lib/env";
import { getEffectiveHostname } from "@/lib/http-origin";
import { resolveXOAuthRedirectUri } from "@/lib/x-oauth-redirect-uri";

/** tweet.read + tweet.write align with Manage Tweets; offline.access for refresh rotation. */
const MARKETING_POSTING_SCOPES = "tweet.read tweet.write offline.access users.read";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const env = getEnv();
  const requestUrl = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);

  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(requestUrl.pathname + requestUrl.search, requestUrl.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }

  const authorizeUrl = env.X_OAUTH_AUTHORIZE_URL ?? "https://twitter.com/i/oauth2/authorize";
  /** Same redirect_uri as Sign in with X — whitelist once on the X app (`/api/auth/x/callback` or `X_OAUTH_CALLBACK_URL`). */
  const callbackUrl = resolveXOAuthRedirectUri(request);

  const state = createOAuthState();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  const url =
    `${authorizeUrl}` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(getXOauthClientId())}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=${encodeURIComponent(MARKETING_POSTING_SCOPES)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

  const response = NextResponse.redirect(url);
  const nextParam = requestUrl.searchParams.get("next");
  applyMarketingPostingReturnPathCookie(
    response,
    nextParam && isSafeOAuthReturnPath(nextParam) ? nextParam : null
  );
  applyMarketingPostingOAuthFlowCookiesToRedirect(response, state, codeVerifier);
  return response;
}
