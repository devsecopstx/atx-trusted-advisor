import { NextResponse } from "next/server";

import {
    applyOAuthFlowCookiesToRedirect,
    applyCapNativeOAuthCookieToRedirect,
    applyOAuthReturnPathCookie,
    createCodeChallenge,
    createCodeVerifier,
    createOAuthState,
    isSafeOAuthReturnPath
} from "@/lib/auth";
import { getEnv, getGoogleClientId, isGoogleOAuthConfigured } from "@/lib/env";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import { isCapNativeOAuthRequest } from "@/lib/capacitor-oauth";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)." },
      { status: 503 }
    );
  }

  const env = getEnv();
  const requestUrl = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);

  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(requestUrl.pathname + requestUrl.search, requestUrl.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }

  const configuredCallbackUrl = env.GOOGLE_OAUTH_CALLBACK_URL?.trim();
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
      // invalid callback URL — fail later
    }
  }

  const origin = getPublicOriginFromRequest(request);
  const callbackUrl =
    env.NODE_ENV === "production"
      ? (env.GOOGLE_OAUTH_CALLBACK_URL ?? `${origin}/api/auth/google/callback`)
      : `${origin}/api/auth/google/callback`;

  const state = createOAuthState();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);

  const scope = encodeURIComponent("openid email profile");
  const clientId = getGoogleClientId();
  const url =
    `${GOOGLE_AUTHORIZE_URL}` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&access_type=online`;

  const response = NextResponse.redirect(url);
  const nextParam = requestUrl.searchParams.get("next");
  applyOAuthReturnPathCookie(
    response,
    nextParam && isSafeOAuthReturnPath(nextParam) ? nextParam : null
  );
  applyOAuthFlowCookiesToRedirect(response, state, codeVerifier);
  if (isCapNativeOAuthRequest(requestUrl)) {
    applyCapNativeOAuthCookieToRedirect(response);
  }
  return response;
}
