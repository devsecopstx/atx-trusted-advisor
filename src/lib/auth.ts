import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

import { getEnv } from "@/lib/env";
import { CAP_NATIVE_OAUTH_COOKIE } from "@/lib/capacitor-oauth";
import { isSafeOAuthReturnPath } from "@/lib/oauth-return-path";
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

type PendingXLinkPayload = PendingXLink & { exp: number };

type SessionPayload = SessionUser & {
  exp: number;
};

function getSigningSecret(): string {
  const secret = getEnv().AUTH_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is required and must be at least 32 characters (session signing must not fall back to X_OAUTH_CLIENT_SECRET)"
    );
  }
  return secret;
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
