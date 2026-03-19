import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPathPrefixes = [
  "/admin",
  "/api/admin",
  "/api/personas",
  "/api/rag",
  "/api/xchat",
  "/xfinance",
  "/xcoach"
];

function isProtectedPath(pathname: string): boolean {
  return protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("xf_core_session")?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/personas/:path*",
    "/api/rag/:path*",
    "/api/xchat/:path*",
    "/xfinance/:path*",
    "/xcoach/:path*"
  ]
};
