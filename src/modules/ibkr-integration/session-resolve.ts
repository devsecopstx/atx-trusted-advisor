import type { IbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { unsealIbkrCpSessionCookie } from "@/modules/ibkr-integration/session-seal";

export type ResolveIbkrCpCookieResult =
  | { ok: true; cookieHeader: string; source: "user_cookie" | "env" }
  | { ok: false; error: "no_session" };

/**
 * Resolves the Client Portal `Cookie` request header value: per-user sealed cookie first,
 * then optional env fallback when {@link IbkrIntegrationConfig.useEnvSessionCookie} is true.
 */
export function resolveIbkrClientPortalCookieHeader(options: {
  config: IbkrIntegrationConfig;
  sealedCookieValue: string | undefined;
  authSecret: string;
}): ResolveIbkrCpCookieResult {
  const sealed = options.sealedCookieValue?.trim();
  if (sealed) {
    const plain = unsealIbkrCpSessionCookie(sealed, options.authSecret)?.trim();
    if (plain) {
      return { ok: true, cookieHeader: plain, source: "user_cookie" };
    }
  }
  if (
    options.config.useEnvSessionCookie &&
    options.config.clientPortalSessionCookieFromEnv?.trim()
  ) {
    return {
      ok: true,
      cookieHeader: options.config.clientPortalSessionCookieFromEnv.trim(),
      source: "env"
    };
  }
  return { ok: false, error: "no_session" };
}
