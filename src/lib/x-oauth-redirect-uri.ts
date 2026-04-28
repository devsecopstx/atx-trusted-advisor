import { getEnv } from "@/lib/env";
import { getPublicOriginFromRequest } from "@/lib/http-origin";

/**
 * OAuth redirect_uri for both user login and marketing posting flows.
 * Must match exactly what is registered on the X developer app (usually one URL:
 * `{origin}/api/auth/x/callback`, or `X_OAUTH_CALLBACK_URL` in production).
 */
export function resolveXOAuthRedirectUri(request: Request): string {
  const env = getEnv();
  const origin = getPublicOriginFromRequest(request);
  if (env.NODE_ENV === "production") {
    const configured = env.X_OAUTH_CALLBACK_URL?.trim();
    return configured ?? `${origin}/api/auth/x/callback`;
  }
  return `${origin}/api/auth/x/callback`;
}
