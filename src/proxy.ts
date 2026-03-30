import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";

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
  "/watchlist",
  "/account",
  "/xstrategybuilder",
  "/xfinance",
  "/xcoach",
  "/xoptions"
];

const publicGuestReadablePaths = ["/account/billing"] as const;

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/xchat", request.url));
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/personas/:path*",
    "/api/rag/:path*",
    "/api/xchat/:path*",
    "/api/recommendations/:path*",
    "/api/strategy-jobs/:path*",
    "/api/app-user/:path*",
    "/portfolio/:path*",
    "/watchlist/:path*",
    "/account/:path*",
    "/xstrategybuilder/:path*",
    "/xfinance/:path*",
    "/xoptions",
    "/xoptions/:path*"
  ]
};
