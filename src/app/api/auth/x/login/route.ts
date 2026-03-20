import { NextResponse } from "next/server";

import {
    applyOAuthFlowCookiesToRedirect,
    createCodeChallenge,
    createCodeVerifier,
    createOAuthState
} from "@/lib/auth";
import { getEnv, getXOauthClientId } from "@/lib/env";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";

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

  const origin = getPublicOriginFromRequest(request);
  const authorizeUrl = env.X_OAUTH_AUTHORIZE_URL ?? "https://twitter.com/i/oauth2/authorize";
  const callbackUrl =
    env.NODE_ENV === "production"
      ? (env.X_OAUTH_CALLBACK_URL ?? `${origin}/api/auth/x/callback`)
      : `${origin}/api/auth/x/callback`;

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
  applyOAuthFlowCookiesToRedirect(response, state, codeVerifier);
  return response;
}
