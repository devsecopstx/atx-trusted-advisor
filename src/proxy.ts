import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";
import { TENANT_UX_FAIL_CLOSED_DRILL_COOKIE } from "@/modules/platform/tenant-ux-flags";
import { resolvePolicyPathForRequest } from "@/modules/platform/tenant-ux-proxy-policy-path";

type TenantUxPolicyDecision = {
  allowed: boolean;
  redirectPath: string;
  policyUnavailable?: boolean;
};

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
/** Coalesce concurrent edge policy fetches for the same session + path (thundering herd on parallel HTML/RSC). */
const tenantUxPolicyInflight = new Map<string, Promise<TenantUxPolicyDecision>>();
const BILLING_PROXY_POLICY_TTL_MS = 30_000;
type BillingProxyDecision = { requiresBilling: boolean; state: string; redirectPath: string };
const billingProxyCache = new Map<string, BillingProxyDecision & { expiresAt: number }>();
/** Coalesce concurrent billing-access fetches for the same session cookie. */
const billingProxyInflight = new Map<string, Promise<BillingProxyDecision>>();

const SESSION_GROUNDING_CACHE_TTL_MS = 15_000;
/** Same-origin internal checks from the edge proxy — bounded wait avoids hung middleware (timeouts fail-open below). */
const PROXY_INTERNAL_ORIGIN_FETCH_TIMEOUT_MS = 10_000;
const sessionGroundingCache = new Map<string, { ok: boolean; expiresAt: number }>();
/** Coalesce concurrent session-grounding fetches (parallel HTML/RSC + API under the matcher). */
const sessionGroundingInflight = new Map<string, Promise<boolean>>();

export function isSessionEdgeGroundingEnabled(raw = process.env.SESSION_EDGE_GROUNDING): boolean {
  if (raw === undefined || raw.trim() === "") {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return !(normalized === "0" || normalized === "false" || normalized === "no");
}

function clearSessionCookieOn(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

function logSessionGroundingFetchError(payload: Record<string, unknown>): void {
  console.warn(
    JSON.stringify({
      type: "session_grounding_fetch_error",
      ...payload
    })
  );
}

async function resolveSessionGroundingOk(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const hit = sessionGroundingCache.get(sessionCookie);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.ok;
  }
  const inflight = sessionGroundingInflight.get(sessionCookie);
  if (inflight) {
    return await inflight;
  }
  const url = new URL("/api/internal/authz/session-grounding", request.url);
  const pending = (async (): Promise<boolean> => {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          cookie: request.headers.get("cookie") ?? ""
        },
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_INTERNAL_ORIGIN_FETCH_TIMEOUT_MS)
      });

      // Fail-open on transient origin errors so refresh / first API call does not wipe a valid session.
      // Route handlers still enforce `requireSessionUser` + Mongo authorization.
      if (res.status >= 500 || res.status === 429) {
        logSessionGroundingFetchError({
          failOpen: true,
          httpStatus: res.status,
          reason: "session_grounding_upstream_transient"
        });
        return true;
      }

      // Next dev (Turbopack): App Router handlers can briefly 404 until the route module finishes compiling.
      // Treat like transient unavailability — explicit auth denial remains `401` from the grounding route.
      if (res.status === 404) {
        logSessionGroundingFetchError({
          failOpen: true,
          httpStatus: 404,
          reason: "session_grounding_upstream_not_found"
        });
        return true;
      }

      const ok = res.ok;
      sessionGroundingCache.set(sessionCookie, {
        ok,
        expiresAt: Date.now() + SESSION_GROUNDING_CACHE_TTL_MS
      });
      if (sessionGroundingCache.size > 500) {
        const first = sessionGroundingCache.keys().next();
        if (!first.done) {
          sessionGroundingCache.delete(first.value);
        }
      }
      return ok;
    } catch (err) {
      logSessionGroundingFetchError({
        failOpen: true,
        error: err instanceof Error ? err.message : String(err),
        reason: "session_grounding_fetch_throw_or_timeout"
      });
      return true;
    } finally {
      sessionGroundingInflight.delete(sessionCookie);
    }
  })();
  sessionGroundingInflight.set(sessionCookie, pending);
  return await pending;
}

async function enforceSessionGrounding(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  if (!isSessionEdgeGroundingEnabled()) {
    return null;
  }
  const grounded = await resolveSessionGroundingOk(request);
  if (grounded) {
    return null;
  }
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.json(
      {
        error: "Unauthorized",
        code: "session_not_grounded"
      },
      { status: 401 }
    );
    clearSessionCookieOn(res);
    return res;
  }
  const redirectUrl = new URL("/xchat", request.url);
  redirectUrl.searchParams.set("error", "session_not_grounded");
  const res = NextResponse.redirect(redirectUrl);
  clearSessionCookieOn(res);
  return res;
}

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

/**
 * Edge tenant-UX policy enforcement (`GET /api/internal/tenant-ux/policy`).
 * Default **on** when unset or empty (prod deploy needs no env); set `TENANT_UX_ENFORCEMENT_V2` to
 * `0` / `false` / `no` / `off` to disable.
 */
export function isTenantUxEnforcementV2Enabled(raw = process.env.TENANT_UX_ENFORCEMENT_V2): boolean {
  if (raw === undefined || raw.trim() === "") {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return !(normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off");
}

export function isTenantUxPolicyFailClosedEnabled(raw = process.env.TENANT_UX_POLICY_FAIL_CLOSED): boolean {
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isTenantUxPolicyFailClosedDrillCookieEnabled(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isTenantUxPolicyFailClosedEnabledForRequest(request: NextRequest): boolean {
  return (
    isTenantUxPolicyFailClosedEnabled() ||
    isTenantUxPolicyFailClosedDrillCookieEnabled(
      request.cookies.get(TENANT_UX_FAIL_CLOSED_DRILL_COOKIE)?.value
    )
  );
}

/** @deprecated Import from `@/modules/platform/tenant-ux-proxy-policy-path` instead. */
export { resolvePolicyPathForRequest } from "@/modules/platform/tenant-ux-proxy-policy-path";

function logTenantUxPolicyFetchError(payload: Record<string, unknown>): void {
  console.warn(
    JSON.stringify({
      type: "tenant_ux_policy_fetch_error",
      ...payload
    })
  );
}

function logTenantUxMetric(payload: Record<string, unknown>): void {
  console.warn(
    JSON.stringify({
      type: "tenant_ux_metric",
      ...payload
    })
  );
}

async function resolveTenantUxPolicyDecision(
  request: NextRequest,
  policyPath: string
): Promise<TenantUxPolicyDecision> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const cacheKey = `${sessionCookie}:${policyPath}`;
  const hit = tenantUxProxyCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return { allowed: hit.allowed, redirectPath: hit.redirectPath };
  }
  const existing = tenantUxPolicyInflight.get(cacheKey);
  if (existing) {
    return await existing;
  }
  const pending = (async (): Promise<TenantUxPolicyDecision> => {
    const url = new URL("/api/internal/tenant-ux/policy", request.url);
    url.searchParams.set("pathname", policyPath);
    try {
      const fetchStarted = Date.now();
      const res = await fetch(url, {
        method: "GET",
        headers: {
          cookie: request.headers.get("cookie") ?? ""
        },
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_INTERNAL_ORIGIN_FETCH_TIMEOUT_MS)
      });
      logTenantUxMetric({
        metric: "tenant_ux_policy_fetch_latency_ms",
        policyPath,
        ms: Date.now() - fetchStarted,
        httpStatus: res.status,
        ok: res.ok
      });
      if (!res.ok) {
        logTenantUxPolicyFetchError({
          policyPath,
          httpStatus: res.status,
          ok: false
        });
        if (isTenantUxPolicyFailClosedEnabledForRequest(request)) {
          return {
            allowed: false,
            redirectPath: "/xchat",
            policyUnavailable: true
          };
        }
        return { allowed: true, redirectPath: "/xchat" };
      }
      let json: { data?: { allowed?: boolean; redirectPath?: string } };
      try {
        json = (await res.json()) as { data?: { allowed?: boolean; redirectPath?: string } };
      } catch (parseErr) {
        logTenantUxPolicyFetchError({
          policyPath,
          ok: false,
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
          reason: "tenant_ux_policy_invalid_json"
        });
        if (isTenantUxPolicyFailClosedEnabledForRequest(request)) {
          return {
            allowed: false,
            redirectPath: "/xchat",
            policyUnavailable: true
          };
        }
        return { allowed: true, redirectPath: "/xchat" };
      }
      const decision: TenantUxPolicyDecision = {
        allowed: json?.data?.allowed !== false,
        redirectPath: json?.data?.redirectPath?.trim() || "/xchat"
      };
      tenantUxProxyCache.set(cacheKey, {
        allowed: decision.allowed,
        redirectPath: decision.redirectPath,
        expiresAt: Date.now() + TENANT_UX_PROXY_POLICY_TTL_MS
      });
      if (tenantUxProxyCache.size > 500) {
        const first = tenantUxProxyCache.keys().next();
        if (!first.done) {
          tenantUxProxyCache.delete(first.value);
        }
      }
      return decision;
    } catch (err) {
      logTenantUxMetric({
        metric: "tenant_ux_policy_fetch_latency_ms",
        policyPath,
        ms: -1,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
      logTenantUxPolicyFetchError({
        policyPath,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
      if (isTenantUxPolicyFailClosedEnabledForRequest(request)) {
        return {
          allowed: false,
          redirectPath: "/xchat",
          policyUnavailable: true
        };
      }
      return { allowed: true, redirectPath: "/xchat" };
    } finally {
      tenantUxPolicyInflight.delete(cacheKey);
    }
  })();
  tenantUxPolicyInflight.set(cacheKey, pending);
  return await pending;
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
    if (decision.policyUnavailable) {
      if (isTenantUxPolicyFailClosedEnabledForRequest(request)) {
        logTenantUxMetric({
          metric: "tenant_ux_policy_unavailable_total",
          pathname,
          policyPath
        });
      }
      return NextResponse.json(
        {
          error: "Tenant policy temporarily unavailable",
          code: "tenant_ux_policy_unavailable",
          redirectPath: decision.redirectPath
        },
        { status: 503 }
      );
    }
    logTenantUxMetric({
      metric: "tenant_ux_route_forbidden_total",
      pathname,
      policyPath
    });
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
  if (decision.policyUnavailable) {
    redirectUrl.searchParams.set("code", "tenant_ux_policy_unavailable");
    if (isTenantUxPolicyFailClosedEnabledForRequest(request)) {
      logTenantUxMetric({
        metric: "tenant_ux_policy_unavailable_total",
        pathname,
        policyPath
      });
    }
  } else {
    logTenantUxMetric({
      metric: "tenant_ux_route_forbidden_total",
      pathname,
      policyPath
    });
  }
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
  const inflight = billingProxyInflight.get(cacheKey);
  if (inflight) {
    return await inflight;
  }
  const url = new URL("/api/internal/authz/billing-access", request.url);
  const pending = (async (): Promise<BillingProxyDecision> => {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          cookie: request.headers.get("cookie") ?? ""
        },
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_INTERNAL_ORIGIN_FETCH_TIMEOUT_MS)
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
      const decision: BillingProxyDecision = {
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
    } finally {
      billingProxyInflight.delete(cacheKey);
    }
  })();
  billingProxyInflight.set(cacheKey, pending);
  return await pending;
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

/** Lets `admin/layout.tsx` read `headers().get("x-pathname")` for `/admin/batch` subtree policy (no separate middleware file). */
function nextResponseContinuing(request: NextRequest, pathname: string): NextResponse {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({
      request: { headers: requestHeaders }
    });
  }
  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSession) {
    const grounding = await enforceSessionGrounding(request, pathname);
    if (grounding) {
      return grounding;
    }
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
    return nextResponseContinuing(request, pathname);
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
    "/api/personas",
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
    "/xcoach",
    "/xcoach/:path*",
    "/xoptions",
    "/xoptions/:path*"
  ]
};
