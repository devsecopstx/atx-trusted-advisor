import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { ibkrAllowsSessionCookiePost, parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import {
    IBKR_CP_SESSION_COOKIE_NAME,
    IBKR_CP_SESSION_ISSUED_MS_COOKIE_NAME,
    IBKR_CP_SESSION_MAX_AGE_SEC
} from "@/modules/ibkr-integration/constants";
import {
    attachIbkrCorrelationId,
    ibkrJsonResponse,
    newIbkrCorrelationId
} from "@/modules/ibkr-integration/ibkr-correlation";
import { sealIbkrCpSessionCookie } from "@/modules/ibkr-integration/session-seal";

const bodySchema = z.object({
  clientPortalCookie: z.string().min(1).max(12_000)
});

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/"
};

export async function POST(request: Request) {
  const correlationId = newIbkrCorrelationId();
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return attachIbkrCorrelationId(session, correlationId);
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_disabled" }, { status: 404 });
  }
  if (!ibkrAllowsSessionCookiePost()) {
    return ibkrJsonResponse(
      correlationId,
      {
        error: "ibkr_session_body_disabled",
        hint: "Set IBKR_ALLOW_SESSION_COOKIE_BODY=true (staging) or use NODE_ENV=development."
      },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return ibkrJsonResponse(correlationId, { error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return ibkrJsonResponse(
      correlationId,
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const env = getEnv();
  const secret = env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
  if (!secret || secret.length < 16) {
    return ibkrJsonResponse(correlationId, { error: "auth_secret_unavailable" }, { status: 503 });
  }

  const sealed = sealIbkrCpSessionCookie(parsed.data.clientPortalCookie.trim(), secret);
  const res = ibkrJsonResponse(correlationId, { data: { stored: true } });
  res.cookies.set(IBKR_CP_SESSION_COOKIE_NAME, sealed, {
    ...cookieOpts,
    maxAge: IBKR_CP_SESSION_MAX_AGE_SEC
  });
  res.cookies.set(IBKR_CP_SESSION_ISSUED_MS_COOKIE_NAME, String(Date.now()), {
    ...cookieOpts,
    maxAge: IBKR_CP_SESSION_MAX_AGE_SEC
  });
  return res;
}

export async function DELETE() {
  const correlationId = newIbkrCorrelationId();
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return attachIbkrCorrelationId(session, correlationId);
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return ibkrJsonResponse(correlationId, { error: "ibkr_disabled" }, { status: 404 });
  }

  const res = ibkrJsonResponse(correlationId, { data: { cleared: true } });
  res.cookies.set(IBKR_CP_SESSION_COOKIE_NAME, "", { ...cookieOpts, maxAge: 0 });
  res.cookies.set(IBKR_CP_SESSION_ISSUED_MS_COOKIE_NAME, "", { ...cookieOpts, maxAge: 0 });
  return res;
}
