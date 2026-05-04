import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";
import {
    APP_USER_PRODUCT_PATH_PREFIXES,
    isAppUserProductPath,
    normalizePathnameForPolicy
} from "@/modules/platform/app-user-product-prefixes";

const protectedPathPrefixes = [
  "/admin",
  "/api/admin",
  "/api/personas",
  "/api/rag",
  "/api/xchat",
  "/api/recommendations",
  "/api/strategy-jobs",
  "/api/app-user",
  "/portfolio",
  "/portfolios",
  "/import-activity",
  "/api/import",
  "/api/integrations",
  "/api/tenant-tasks",
  "/watchlist",
  "/account",
  "/workspace",
  "/xfinance",
  "/xcoach",
  "/xoptions"
];

const publicGuestReadablePaths = ["/account/billing"] as const;
const TENANT_UX_PROXY_POLICY_TTL_MS = 60_000;
const tenantUxProxyCache = new Map<string, { allowed: boolean; redirectPath: string; expiresAt: number }>();
const BILLING_PROXY_POLICY_TTL_MS = 30_000;
const billingProxyCache = new Map<
  string,
  { requiresBilling: boolean; state: string; redirectPath: string; expiresAt: number }
>();

function isPublicGuestReadablePath(pathname: string): boolean {
  return publicGuestReadablePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isProtectedPath(pathname: string): boolean {
  if (isPublicGuestReadablePath(pathname)) {
    return false;
  }
  return protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isTenantUxEnforcementV2Enabled(raw = process.env.TENANT_UX_ENFORCEMENT_V2): boolean {
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function resolvePolicyPathForRequest(pathname: string): string | null {
  const p = normalizePathnameForPolicy(pathname);
  if (isAppUserProductPath(p)) {
    const match = (APP_USER_PRODUCT_PATH_PREFIXES as readonly string[]).find(
      (prefix) => p === prefix || p.startsWith(`${prefix}/`)
    );
    return match ?? null;
  }
  if (p.startsWith("/api/xchat")) return "/xchat";
  if (p.startsWith("/api/app-user/xchat")) return "/xchat";
  if (p.startsWith("/api/app-user/find-options")) return "/xoptions";
  if (p.startsWith("/api/app-user/symbol-chart")) return "/xoptions";
  if (p.startsWith("/api/app-user/xoptions")) return "/xoptions";
  if (p.startsWith("/api/user/watchlist")) return "/watchlist";
  if (p.startsWith("/api/user/workspace-portfolio")) return "/workspace";
  if (p.startsWith("/api/portfolios")) return "/portfolio";
  if (p.startsWith("/api/positions")) return "/portfolio";
  if (p.startsWith("/api/import")) return "/import-activity";
  if (p.startsWith("/api/integrations")) return "/account";
  if (p.startsWith("/api/tenant-tasks")) return "/workspace";
  return null;
}

async function resolveTenantUxPolicyDecision(request: NextRequest, policyPath: string): Promise<{ allowed: boolean; redirectPath: string }> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const cacheKey = `${sessionCookie}:${policyPath}`;
  const hit = tenantUxProxyCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return { allowed: hit.allowed, redirectPath: hit.redirectPath };
  }
  const url = new URL("/api/internal/tenant-ux/policy", request.url);
  url.searchParams.set("pathname", policyPath);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      cache: "no-store"
    });
    if (!res.ok) {
      return { allowed: true, redirectPath: "/xchat" };
    }
    const json = (await res.json()) as {
      data?: { allowed?: boolean; redirectPath?: string };
    };
    const decision = {
      allowed: json?.data?.allowed !== false,
      redirectPath: json?.data?.redirectPath?.trim() || "/xchat"
    };
    tenantUxProxyCache.set(cacheKey, {
      ...decision,
      expiresAt: Date.now() + TENANT_UX_PROXY_POLICY_TTL_MS
    });
    if (tenantUxProxyCache.size > 500) {
      const first = tenantUxProxyCache.keys().next();
      if (!first.done) {
        tenantUxProxyCache.delete(first.value);
      }
    }
    return decision;
  } catch {
    return { allowed: true, redirectPath: "/xchat" };
  }
}

async function enforceTenantUxV2(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  const policyPath = resolvePolicyPathForRequest(pathname);
  if (!policyPath) {
    return null;
  }
  const decision = await resolveTenantUxPolicyDecision(request, policyPath);
  if (decision.allowed) {
    return null;
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        code: "tenant_ux_route_forbidden",
        redirectPath: decision.redirectPath
      },
      { status: 403 }
    );
  }
  const redirectUrl = new URL("/access-denied", request.url);
  redirectUrl.searchParams.set("route", pathname);
  redirectUrl.searchParams.set("redirect", decision.redirectPath);
  return NextResponse.redirect(redirectUrl);
}

function shouldEnforceBillingForPath(pathname: string): boolean {
  if (isPublicGuestReadablePath(pathname)) {
    return false;
  }
  if (pathname.startsWith("/api/billing/") || pathname.startsWith("/api/webhooks/")) {
    return false;
  }
  return resolvePolicyPathForRequest(pathname) !== null;
}

async function resolveBillingDecision(
  request: NextRequest
): Promise<{ requiresBilling: boolean; state: string; redirectPath: string }> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const cacheKey = sessionCookie;
  const hit = billingProxyCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return {
      requiresBilling: hit.requiresBilling,
      state: hit.state,
      redirectPath: hit.redirectPath
    };
  }
  const url = new URL("/api/internal/authz/billing-access", request.url);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      cache: "no-store"
    });
    if (!res.ok) {
      return { requiresBilling: false, state: "approved_unpaid", redirectPath: "/account/billing" };
    }
    const json = (await res.json()) as {
      data?: {
        requiresBilling?: boolean;
        billingState?: string;
        redirectPath?: string;
      };
    };
    const decision = {
      requiresBilling: json?.data?.requiresBilling === true,
      state: json?.data?.billingState?.trim() || "approved_unpaid",
      redirectPath: json?.data?.redirectPath?.trim() || "/account/billing"
    };
    billingProxyCache.set(cacheKey, {
      ...decision,
      expiresAt: Date.now() + BILLING_PROXY_POLICY_TTL_MS
    });
    if (billingProxyCache.size > 500) {
      const first = billingProxyCache.keys().next();
      if (!first.done) {
        billingProxyCache.delete(first.value);
      }
    }
    return decision;
  } catch {
    return { requiresBilling: false, state: "approved_unpaid", redirectPath: "/account/billing" };
  }
}

async function enforceBillingAccess(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  if (!shouldEnforceBillingForPath(pathname)) {
    return null;
  }
  const decision = await resolveBillingDecision(request);
  if (!decision.requiresBilling) {
    return null;
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Subscription required",
        code: "billing_subscription_required",
        state: decision.state,
        redirectPath: decision.redirectPath
      },
      { status: 402 }
    );
  }
  const billingUrl = new URL(decision.redirectPath, request.url);
  billingUrl.searchParams.set("required", "1");
  billingUrl.searchParams.set("state", decision.state);
  billingUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(billingUrl);
}

/**
 * App-router pages that render a **guest shell at the same URL** (no session cookie) — do not redirect to /xchat.
 * APIs under these areas stay protected (401) when unauthenticated.
 */
function allowsGuestHtmlRender(pathname: string): boolean {
  if (pathname === "/portfolio" || pathname === "/portfolios" || pathname === "/xoptions") {
    return true;
  }
  if (pathname === "/resources" || pathname.startsWith("/resources/")) {
    return true;
  }
  return (
    pathname.startsWith("/portfolio/") ||
    pathname.startsWith("/portfolios/") ||
    pathname.startsWith("/xoptions/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSession) {
    const billingEnforced = await enforceBillingAccess(request, pathname);
    if (billingEnforced) {
      return billingEnforced;
    }
    if (isTenantUxEnforcementV2Enabled()) {
      const enforced = await enforceTenantUxV2(request, pathname);
      if (enforced) {
        return enforced;
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (allowsGuestHtmlRender(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/xchat", request.url));
}

export const config = {
  matcher: [
    "/resources",
    "/resources/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/personas/:path*",
    "/api/rag/:path*",
    "/api/xchat/:path*",
    "/api/recommendations/:path*",
    "/api/strategy-jobs/:path*",
    "/api/tasks/:path*",
    "/api/app-user/:path*",
    "/portfolio",
    "/portfolio/:path*",
    "/portfolios",
    "/portfolios/:path*",
    "/import-activity",
    "/api/import/:path*",
    "/api/integrations/:path*",
    "/api/tenant-tasks/:path*",
    "/watchlist",
    "/watchlist/:path*",
    "/account",
    "/account/:path*",
    "/workspace/:path*",
    "/xfinance/:path*",
    "/xoptions",
    "/xoptions/:path*"
  ]
};
