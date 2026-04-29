import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

import { getEnv } from "@/lib/env";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";
import { normalizeCoreRoles } from "@/modules/identity/authorization";
const OAUTH_STATE_COOKIE_NAME = "xf_x_oauth_state";
const OAUTH_VERIFIER_COOKIE_NAME = "xf_x_oauth_verifier";
const OAUTH_RETURN_PATH_COOKIE_NAME = "xf_oauth_return";
const PENDING_LINK_COOKIE_NAME = "xf_x_pending_link";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
/** If remaining signed-session lifetime falls below this, re-issue the cookie on read (sliding window for active users). */
export const SESSION_REFRESH_WHEN_REMAINING_MS = 30 * 60 * 1000;
/** PKCE state/verifier, return path, pending X link — keep long enough for slow OAuth completes (mobile/switch-tab). */
const OAUTH_FLOW_TTL_SECONDS = 60 * 30;

export function shouldRefreshSessionExpiry(expMs: number, nowMs: number = Date.now()): boolean {
  const remaining = expMs - nowMs;
  return remaining > 0 && remaining < SESSION_REFRESH_WHEN_REMAINING_MS;
}

/**
 * Next.js forbids cookie mutation from server-render-only contexts.
 * In those contexts we should keep serving the current session instead of crashing.
 */
export function isCookieMutationRestrictedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Cookies can only be modified in a Server Action or Route Handler");
}

/**
 * Signed session payload. Naming:
 * - **Platform roles** (`roles`): global_admin | advisor | operator | viewer — what the user can do app-wide.
 *   Only `global_admin` may use `/admin` (admin console). Advisor/operator/viewer are **app_user** roles (xChat, xStrategyBuilder, etc.).
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

/**
 * Signs a session cookie value for **trusted server automation only** (e.g. scheduled user-task runs).
 * Never expose to clients. Uses the same format as {@link createSession}.
 */
export function signSessionCookieValueForAutomation(user: SessionUser): string {
  const normalizedRoles = normalizeCoreRoles(user.roles);
  const payload: SessionPayload = {
    ...user,
    roles: normalizedRoles,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
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

async function getSessionUserUncached(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return null;
  }

  const payload = parseSessionCookie(sessionCookie);
  if (!payload) {
    return null;
  }

  if (shouldRefreshSessionExpiry(payload.exp)) {
    try {
      await createSession({
        userId: payload.userId,
        email: payload.email,
        roles: normalizeCoreRoles(payload.roles),
        tenantId: payload.tenantId,
        tenantRole: payload.tenantRole,
        xUserId: payload.xUserId,
        username: payload.username,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl
      });
    } catch (error) {
      if (!isCookieMutationRestrictedError(error)) {
        throw error;
      }
    }
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

/** Deduped per request; extends session cookie when expiry is within {@link SESSION_REFRESH_WHEN_REMAINING_MS}. */
export const getSessionUser = cache(getSessionUserUncached);

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

/** Rejects open redirects and path traversal; only same-origin relative paths. */
export function isSafeOAuthReturnPath(path: string): boolean {
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//")) {
    return false;
  }
  if (p.includes("..")) {
    return false;
  }
  if (p.length > 512) {
    return false;
  }
  if (/[\r\n\0]/.test(p)) {
    return false;
  }
  return true;
}

export function applyOAuthReturnPathCookie(response: NextResponse, returnPath: string | null): void {
  if (!returnPath || !isSafeOAuthReturnPath(returnPath)) {
    return;
  }
  const baseCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_FLOW_TTL_SECONDS
  };
  response.cookies.set(OAUTH_RETURN_PATH_COOKIE_NAME, returnPath, baseCookie);
}

export async function consumeOAuthReturnPathCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(OAUTH_RETURN_PATH_COOKIE_NAME)?.value;
  cookieStore.delete(OAUTH_RETURN_PATH_COOKIE_NAME);
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return isSafeOAuthReturnPath(trimmed) ? trimmed : null;
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

/** PKCE for marketing X posting OAuth — separate from user login cookies. */
const MARKETING_POSTING_OAUTH_STATE_COOKIE_NAME = "xf_x_marketing_oauth_state";
const MARKETING_POSTING_OAUTH_VERIFIER_COOKIE_NAME = "xf_x_marketing_oauth_verifier";
const MARKETING_POSTING_OAUTH_RETURN_COOKIE_NAME = "xf_x_marketing_oauth_return";

export function applyMarketingPostingOAuthFlowCookiesToRedirect(
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
  response.cookies.set(MARKETING_POSTING_OAUTH_STATE_COOKIE_NAME, state, baseCookie);
  response.cookies.set(MARKETING_POSTING_OAUTH_VERIFIER_COOKIE_NAME, verifier, baseCookie);
}

export function applyMarketingPostingReturnPathCookie(response: NextResponse, returnPath: string | null): void {
  if (!returnPath || !isSafeOAuthReturnPath(returnPath)) {
    return;
  }
  const baseCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_FLOW_TTL_SECONDS
  };
  response.cookies.set(MARKETING_POSTING_OAUTH_RETURN_COOKIE_NAME, returnPath, baseCookie);
}

export async function consumeMarketingPostingOAuthFlowCookies(): Promise<{
  state: string | null;
  verifier: string | null;
}> {
  const value = await readMarketingPostingOAuthFlowCookies();
  await clearMarketingPostingOAuthFlowCookies();
  return value;
}

export async function readMarketingPostingOAuthFlowCookies(): Promise<{
  state: string | null;
  verifier: string | null;
}> {
  const cookieStore = await cookies();
  const state = cookieStore.get(MARKETING_POSTING_OAUTH_STATE_COOKIE_NAME)?.value ?? null;
  const verifier = cookieStore.get(MARKETING_POSTING_OAUTH_VERIFIER_COOKIE_NAME)?.value ?? null;
  return { state, verifier };
}

export async function clearMarketingPostingOAuthFlowCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MARKETING_POSTING_OAUTH_STATE_COOKIE_NAME);
  cookieStore.delete(MARKETING_POSTING_OAUTH_VERIFIER_COOKIE_NAME);
}

export async function consumeMarketingPostingReturnPathCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MARKETING_POSTING_OAUTH_RETURN_COOKIE_NAME)?.value;
  cookieStore.delete(MARKETING_POSTING_OAUTH_RETURN_COOKIE_NAME);
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return isSafeOAuthReturnPath(trimmed) ? trimmed : null;
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
