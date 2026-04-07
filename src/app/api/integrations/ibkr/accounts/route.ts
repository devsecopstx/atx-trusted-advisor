import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { fetchIbkrPortfolioAccounts } from "@/modules/ibkr-integration/client-portfolio";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { getIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import { IBKR_CP_SESSION_COOKIE_NAME } from "@/modules/ibkr-integration/constants";
import { resolveIbkrClientPortalCookieHeader } from "@/modules/ibkr-integration/session-resolve";

function maskId(hex: string): string {
  const t = hex.trim();
  if (t.length <= 8) {
    return t;
  }
  return `${t.slice(0, 6)}…`;
}

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "ibkr_disabled" }, { status: 404 });
  }
  if (!cfg.clientPortalBaseUrl) {
    return NextResponse.json({ error: "ibkr_gateway_url_missing" }, { status: 503 });
  }

  const consent = await getIbkrConsent(session.userId, session.tenantId);
  if (!consent?.consentedAt) {
    return NextResponse.json({ error: "ibkr_consent_required" }, { status: 403 });
  }

  const env = getEnv();
  const secret = env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "auth_secret_unavailable" }, { status: 503 });
  }

  const jar = await cookies();
  const sealed = jar.get(IBKR_CP_SESSION_COOKIE_NAME)?.value;
  const resolved = resolveIbkrClientPortalCookieHeader({
    config: cfg,
    sealedCookieValue: sealed,
    authSecret: secret
  });

  if (!resolved.ok) {
    return NextResponse.json(
      {
        error: "ibkr_session_required",
        hint: "POST /api/integrations/ibkr/session with Client Portal Cookie header value, or operator-only env session."
      },
      { status: 401 }
    );
  }

  const result = await fetchIbkrPortfolioAccounts({
    baseUrl: cfg.clientPortalBaseUrl,
    cookieHeader: resolved.cookieHeader
  });

  if (!result.ok) {
    console.warn("[ibkr/accounts] upstream failed", {
      userId: maskId(session.userId),
      error: result.error,
      httpStatus: result.httpStatus,
      sessionSource: resolved.source
    });
    return NextResponse.json(
      {
        error: "ibkr_upstream_error",
        detail: result.error,
        httpStatus: result.httpStatus ?? null
      },
      { status: 502 }
    );
  }

  console.info("[ibkr/accounts] ok", {
    userId: maskId(session.userId),
    count: result.accounts.length,
    sessionSource: resolved.source
  });

  return NextResponse.json({
    data: {
      accounts: result.accounts,
      paperTrading: cfg.paperTrading,
      sessionSource: resolved.source
    }
  });
}
