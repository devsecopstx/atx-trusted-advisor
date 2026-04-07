import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { ibkrAllowsSessionCookiePost, parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { getIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import {
    IBKR_CONSENT_VERSION,
    IBKR_CP_SESSION_COOKIE_NAME
} from "@/modules/ibkr-integration/constants";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const cfg = parseIbkrIntegrationConfig();
  const jar = await cookies();
  const sessionPresent = Boolean(jar.get(IBKR_CP_SESSION_COOKIE_NAME)?.value);

  let consentRecorded = false;
  if (cfg.enabled) {
    const row = await getIbkrConsent(session.userId, session.tenantId);
    consentRecorded = Boolean(row?.consentedAt);
  }

  return NextResponse.json({
    data: {
      enabled: cfg.enabled,
      paperTrading: cfg.paperTrading,
      gatewayConfigured: Boolean(cfg.clientPortalBaseUrl),
      consentRecorded,
      sessionPresent,
      sessionBodyAllowed: ibkrAllowsSessionCookiePost(),
      consentVersion: cfg.enabled ? IBKR_CONSENT_VERSION : null,
      consentSummary: cfg.enabled
        ? "View balances, place trades, and automations via IBKR Client Portal (phased rollout)."
        : null
    }
  });
}
