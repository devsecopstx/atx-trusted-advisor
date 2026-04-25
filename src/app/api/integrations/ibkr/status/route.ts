import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { ibkrAllowsSessionCookiePost, parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { getIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import {
    IBKR_CONSENT_VERSION,
    IBKR_CP_SESSION_COOKIE_NAME,
    IBKR_CP_SESSION_ISSUED_MS_COOKIE_NAME,
    IBKR_CP_SESSION_MAX_AGE_SEC
} from "@/modules/ibkr-integration/constants";
import {
    attachIbkrCorrelationId,
    ibkrJsonResponse,
    newIbkrCorrelationId
} from "@/modules/ibkr-integration/ibkr-correlation";

const REAUTH_AFTER_MS = 6 * 60 * 60 * 1000;

export async function GET() {
  const correlationId = newIbkrCorrelationId();
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return attachIbkrCorrelationId(session, correlationId);
  }

  const cfg = parseIbkrIntegrationConfig();
  const jar = await cookies();
  const sessionPresent = Boolean(jar.get(IBKR_CP_SESSION_COOKIE_NAME)?.value);
  const issuedRaw = jar.get(IBKR_CP_SESSION_ISSUED_MS_COOKIE_NAME)?.value;
  const issuedMs = issuedRaw ? Number(issuedRaw) : NaN;
  const sessionIssuedAtMs = Number.isFinite(issuedMs) ? issuedMs : null;
  const sessionAgeMs = sessionIssuedAtMs ? Math.max(0, Date.now() - sessionIssuedAtMs) : null;
  const reauthRecommended = Boolean(sessionPresent && sessionAgeMs && sessionAgeMs > REAUTH_AFTER_MS);

  let consentRecorded = false;
  if (cfg.enabled) {
    const row = await getIbkrConsent(session.userId, session.tenantId);
    consentRecorded = Boolean(row?.consentedAt);
  }

  return ibkrJsonResponse(correlationId, {
    data: {
      enabled: cfg.enabled,
      paperTrading: cfg.paperTrading,
      gatewayConfigured: Boolean(cfg.clientPortalBaseUrl),
      consentRecorded,
      sessionPresent,
      sessionBodyAllowed: ibkrAllowsSessionCookiePost(),
      sessionCookieMaxAgeSec: IBKR_CP_SESSION_MAX_AGE_SEC,
      sessionIssuedAtMs,
      reauthRecommended,
      oauthBrokerSsoAvailable: false,
      sessionHint:
        "Client Portal uses a gateway session cookie you paste (or operator env). There is no broker OAuth SSO in-app yet — re-paste after gateway logout or if API calls return ibkr_upstream_auth.",
      consentVersion: cfg.enabled ? IBKR_CONSENT_VERSION : null,
      consentSummary: cfg.enabled
        ? "View balances, place trades, and automations via IBKR Client Portal (phased rollout)."
        : null
    }
  });
}
