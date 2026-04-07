import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { fetchIbkrPortfolioAccounts } from "@/modules/ibkr-integration/client-portfolio";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { getIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import { IBKR_CP_SESSION_COOKIE_NAME } from "@/modules/ibkr-integration/constants";
import { tryConsumeIbkrRateSlot } from "@/modules/ibkr-integration/ibkr-global-rate-limit";
import { resolveIbkrClientPortalCookieHeader } from "@/modules/ibkr-integration/session-resolve";
import { canUserLogin } from "@/modules/identity/authorization";

export type IbkrSsrAccountsSnapshot = {
  accountCount: number;
};

/**
 * Best-effort IBKR Client Portal account list for SSR (parallel with portfolio Mongo reads).
 * Returns null when integration is off, user cannot use product routes, consent/session missing, rate-limited, or upstream fails.
 */
export async function tryIbkrLinkedAccountsSnapshotForSession(
  session: SessionUser
): Promise<IbkrSsrAccountsSnapshot | null> {
  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled || !cfg.clientPortalBaseUrl) {
    return null;
  }
  if (!canUserLogin(session.roles)) {
    return null;
  }

  const consent = await getIbkrConsent(session.userId, session.tenantId);
  if (!consent?.consentedAt) {
    return null;
  }

  const env = getEnv();
  const secret = env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
  if (!secret || secret.length < 16) {
    return null;
  }

  const jar = await cookies();
  const sealed = jar.get(IBKR_CP_SESSION_COOKIE_NAME)?.value;
  const resolved = resolveIbkrClientPortalCookieHeader({
    config: cfg,
    sealedCookieValue: sealed,
    authSecret: secret
  });
  if (!resolved.ok) {
    return null;
  }
  if (!tryConsumeIbkrRateSlot()) {
    return null;
  }

  const res = await fetchIbkrPortfolioAccounts({
    baseUrl: cfg.clientPortalBaseUrl,
    cookieHeader: resolved.cookieHeader
  });
  if (!res.ok) {
    return null;
  }
  return { accountCount: res.accounts.length };
}
