import { NextResponse } from "next/server";

import {
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState,
  setOAuthFlowCookies
} from "@/lib/auth";
import { getEnv, getXOauthClientId } from "@/lib/env";

export async function GET(request: Request) {
  const env = getEnv();
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const effectiveHostWithPort = forwardedHost ?? hostHeader ?? requestUrl.host;
  const effectiveHost = effectiveHostWithPort.split(":")[0];
  const proto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(requestUrl.pathname + requestUrl.search, requestUrl.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }
  const origin = `${proto}://${effectiveHostWithPort}`;
  const authorizeUrl = env.X_OAUTH_AUTHORIZE_URL ?? "https://twitter.com/i/oauth2/authorize";
  const callbackUrl =
    env.NODE_ENV === "production"
      ? (env.X_OAUTH_CALLBACK_URL ?? `${origin}/api/auth/x/callback`)
      : `${origin}/api/auth/x/callback`;

  const state = createOAuthState();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  await setOAuthFlowCookies(state, codeVerifier);

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

  return NextResponse.redirect(url);
}
