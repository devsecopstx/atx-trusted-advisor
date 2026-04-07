import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import type { SessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { getIbkrConsent } from "@/modules/ibkr-integration/consent-repository";
import { IBKR_CP_SESSION_COOKIE_NAME } from "@/modules/ibkr-integration/constants";
import {
    attachIbkrCorrelationId,
    ibkrJsonResponse,
    newIbkrCorrelationId
} from "@/modules/ibkr-integration/ibkr-correlation";
import { tryConsumeIbkrRateSlot } from "@/modules/ibkr-integration/ibkr-global-rate-limit";
import { resolveIbkrClientPortalCookieHeader } from "@/modules/ibkr-integration/session-resolve";

export function maskIbkrUserId(hex: string): string {
  const t = hex.trim();
  if (t.length <= 8) {
    return t;
  }
  return `${t.slice(0, 6)}…`;
}

export type IbkrReadContext = {
  correlationId: string;
  session: SessionUser;
  cfg: ReturnType<typeof parseIbkrIntegrationConfig>;
  cookieHeader: string;
  resolvedSource: "user_cookie" | "env";
  userIdMasked: string;
};

/**
 * Shared gate: approved app user, IBKR enabled, gateway URL, consent, AUTH_SECRET, session material, rate slot.
 */
export async function requireIbkrReadContext(): Promise<NextResponse | IbkrReadContext> {
  const correlationId = newIbkrCorrelationId();
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return attachIbkrCorrelationId(session, correlationId);
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_disabled" }, { status: 404 });
  }
  if (!cfg.clientPortalBaseUrl) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_gateway_url_missing" }, { status: 503 });
  }

  const consent = await getIbkrConsent(session.userId, session.tenantId);
  if (!consent?.consentedAt) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_consent_required" }, { status: 403 });
  }

  const env = getEnv();
  const secret = env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
  if (!secret || secret.length < 16) {
    return ibkrJsonResponse(correlationId, { error: "auth_secret_unavailable" }, { status: 503 });
  }

  const jar = await cookies();
  const sealed = jar.get(IBKR_CP_SESSION_COOKIE_NAME)?.value;
  const resolved = resolveIbkrClientPortalCookieHeader({
    config: cfg,
    sealedCookieValue: sealed,
    authSecret: secret
  });

  if (!resolved.ok) {
    return ibkrJsonResponse(
      correlationId,
      {
        error: "ibkr_session_required",
        hint: "POST /api/integrations/ibkr/session with Client Portal Cookie header value, or operator-only env session."
      },
      { status: 401 }
    );
  }

  if (!tryConsumeIbkrRateSlot()) {
    return ibkrJsonResponse(
      correlationId,
      {
        error: "ibkr_rate_limited",
        hint: "Too many IBKR requests in the sliding window; retry shortly."
      },
      { status: 429 }
    );
  }

  return {
    correlationId,
    session,
    cfg,
    cookieHeader: resolved.cookieHeader,
    resolvedSource: resolved.source,
    userIdMasked: maskIbkrUserId(session.userId)
  };
}

export function ibkrUpstreamErrorResponse(
  result: {
    error: string;
    httpStatus?: number;
  },
  correlationId: string
): NextResponse {
  if (result.error === "upstream_auth") {
    return ibkrJsonResponse(
      correlationId,
      {
        error: "ibkr_upstream_auth",
        hint: "Client Portal session rejected (401/403). Re-paste the gateway Cookie or log in again at your IBKR Client Portal gateway."
      },
      { status: 401 }
    );
  }
  return ibkrJsonResponse(
    correlationId,
    {
      error: "ibkr_upstream_error",
      detail: result.error,
      httpStatus: result.httpStatus ?? null
    },
    { status: 502 }
  );
}
