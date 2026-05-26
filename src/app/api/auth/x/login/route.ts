import { NextResponse } from "next/server";

import {
    applyOAuthFlowCookiesToRedirect,
    applyOAuthReturnPathCookie,
    createCodeChallenge,
    createCodeVerifier,
    createOAuthState,
    isSafeOAuthReturnPath
} from "@/lib/auth";
import { getEnv, getXOauthClientId } from "@/lib/env";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import {
  GUEST_TRIAL_INTENT_COOKIE,
  GUEST_TRIAL_INTENT_QUERY,
  parseGuestTrialIntentParam
} from "@/modules/identity/guest-trial";
import { resolveXOAuthRedirectUri } from "@/lib/x-oauth-redirect-uri";

export async function GET(request: Request) {
  const env = getEnv();
  const requestUrl = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);

  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(requestUrl.pathname + requestUrl.search, requestUrl.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }

  const configuredCallbackUrl = env.X_OAUTH_CALLBACK_URL?.trim();
  if (env.NODE_ENV === "production" && configuredCallbackUrl) {
    try {
      const callbackHost = new URL(configuredCallbackUrl).host.toLowerCase();
      const currentHost = getPublicOriginFromRequest(request)
        .replace(/^https?:\/\//, "")
        .toLowerCase();
      if (callbackHost !== currentHost) {
        const canonical = new URL(requestUrl.pathname + requestUrl.search, configuredCallbackUrl);
        return NextResponse.redirect(canonical.toString());
      }
    } catch {
      // invalid callback URL is handled later by normal auth failures
    }
  }

  const authorizeUrl = env.X_OAUTH_AUTHORIZE_URL ?? "https://twitter.com/i/oauth2/authorize";
  const callbackUrl = resolveXOAuthRedirectUri(request);

  const state = createOAuthState();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  const scope = encodeURIComponent("tweet.read users.read users.email offline.access");
  const clientId = getXOauthClientId();
  const url =
    `${authorizeUrl}` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

  const response = NextResponse.redirect(url);
  const nextParam = requestUrl.searchParams.get("next");
  applyOAuthReturnPathCookie(
    response,
    nextParam && isSafeOAuthReturnPath(nextParam) ? nextParam : null
  );
  applyOAuthFlowCookiesToRedirect(response, state, codeVerifier);
  if (parseGuestTrialIntentParam(requestUrl.searchParams.get(GUEST_TRIAL_INTENT_QUERY))) {
    response.cookies.set(GUEST_TRIAL_INTENT_COOKIE, "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
  }
  return response;
}
