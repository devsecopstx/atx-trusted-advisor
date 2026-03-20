import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { normalizeCoreRoles } from "@/modules/identity/authorization";

const SESSION_COOKIE_NAME = "xf_core_session";
const OAUTH_STATE_COOKIE_NAME = "xf_x_oauth_state";
const OAUTH_VERIFIER_COOKIE_NAME = "xf_x_oauth_verifier";
const PENDING_LINK_COOKIE_NAME = "xf_x_pending_link";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const OAUTH_FLOW_TTL_SECONDS = 60 * 10;

/**
 * Signed session payload. Naming:
 * - **Platform roles** (`roles`): global_admin | advisor | operator | viewer — what the user can do app-wide.
 *   Only `global_admin` may use `/admin` (admin console). Advisor/operator/viewer are **app_user** roles (xChat, xCoach, etc.).
 * - **Tenant membership role** (`tenantRole`): `tenant_admin` | `member` — scoped to `tenantId`; does **not** grant admin console.
 *   Treat as billing/tenant ops for now; plans default to free until billing ships.
 */
export type SessionUser = {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
  tenantRole: string;
  xUserId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

export type PendingXLink = {
  xUserId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
};

type SessionPayload = SessionUser & {
  exp: number;
};

function getSigningSecret(): string {
  const env = getEnv();
  return env.AUTH_SECRET ?? env.X_OAUTH_CLIENT_SECRET;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function parseSessionCookie(raw: string): SessionPayload | null {
  const [encodedPayload, signature] = raw.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  const normalizedRoles = normalizeCoreRoles(user.roles);
  const payload: SessionPayload = {
    ...user,
    roles: normalizedRoles,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  cookieStore.set(SESSION_COOKIE_NAME, `${encodedPayload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return null;
  }

  const payload = parseSessionCookie(sessionCookie);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    roles: normalizeCoreRoles(payload.roles),
    tenantId: payload.tenantId,
    tenantRole: payload.tenantRole,
    xUserId: payload.xUserId,
    username: payload.username,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl
  };
}

export async function requireSessionUser(): Promise<SessionUser | NextResponse> {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

/** PKCE cookies must be set on the same `NextResponse` as the redirect or they may not be sent to the browser (App Router). */
export function applyOAuthFlowCookiesToRedirect(
  response: NextResponse,
  state: string,
  verifier: string
): void {
  const baseCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_FLOW_TTL_SECONDS
  };
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, baseCookie);
  response.cookies.set(OAUTH_VERIFIER_COOKIE_NAME, verifier, baseCookie);
}

export async function setPendingXLinkCookie(value: PendingXLink): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_LINK_COOKIE_NAME, toBase64Url(JSON.stringify(value)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_FLOW_TTL_SECONDS
  });
}

export async function readPendingXLinkCookie(): Promise<PendingXLink | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_LINK_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(fromBase64Url(raw)) as PendingXLink;
  } catch {
    return null;
  }
}

export async function consumePendingXLinkCookie(): Promise<PendingXLink | null> {
  const cookieStore = await cookies();
  const value = await readPendingXLinkCookie();
  cookieStore.delete(PENDING_LINK_COOKIE_NAME);
  return value;
}

export async function consumeOAuthFlowCookies(): Promise<{
  state: string | null;
  verifier: string | null;
}> {
  const value = await readOAuthFlowCookies();
  await clearOAuthFlowCookies();
  return value;
}

export async function readOAuthFlowCookies(): Promise<{
  state: string | null;
  verifier: string | null;
}> {
  const cookieStore = await cookies();
  const state = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value ?? null;
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE_NAME)?.value ?? null;
  return { state, verifier };
}

export async function clearOAuthFlowCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
  cookieStore.delete(OAUTH_VERIFIER_COOKIE_NAME);
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function createCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
