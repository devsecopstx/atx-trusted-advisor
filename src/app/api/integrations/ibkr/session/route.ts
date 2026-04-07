import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { ibkrAllowsSessionCookiePost, parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { IBKR_CP_SESSION_COOKIE_NAME } from "@/modules/ibkr-integration/constants";
import { sealIbkrCpSessionCookie } from "@/modules/ibkr-integration/session-seal";

const bodySchema = z.object({
  clientPortalCookie: z.string().min(1).max(12_000)
});

const SESSION_MAX_AGE_SEC = 60 * 60 * 24;

export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "ibkr_disabled" }, { status: 404 });
  }
  if (!ibkrAllowsSessionCookiePost()) {
    return NextResponse.json(
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const env = getEnv();
  const secret = env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "auth_secret_unavailable" }, { status: 503 });
  }

  const sealed = sealIbkrCpSessionCookie(parsed.data.clientPortalCookie.trim(), secret);
  const res = NextResponse.json({ data: { stored: true } });
  res.cookies.set(IBKR_CP_SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC
  });
  return res;
}

export async function DELETE() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const cfg = parseIbkrIntegrationConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ error: "ibkr_disabled" }, { status: 404 });
  }

  const res = NextResponse.json({ data: { cleared: true } });
  res.cookies.set(IBKR_CP_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return res;
}
