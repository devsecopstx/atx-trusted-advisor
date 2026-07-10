/** Query flag on /api/auth/x/login and /api/auth/google/login when OAuth starts from Capacitor native. */
export const CAP_NATIVE_OAUTH_QUERY = "cap_native";

export const CAP_NATIVE_OAUTH_COOKIE = "xf_cap_native_oauth";

/** Custom URL scheme registered in iOS Info.plist for OAuth return to the native shell. */
export const CAPACITOR_OAUTH_URL_SCHEME = "com.atxfinance.ai";

export const CAPACITOR_OAUTH_COMPLETE_HOST = "oauth-complete";

export const CAPACITOR_OAUTH_DONE_PATH = "/auth/capacitor-oauth-done";

export const OAUTH_LOGIN_PATHS = ["/api/auth/x/login", "/api/auth/google/login"] as const;

export function isOAuthLoginPathname(pathname: string): boolean {
  return (OAUTH_LOGIN_PATHS as readonly string[]).includes(pathname);
}

export function isCapNativeOAuthRequest(url: URL): boolean {
  return url.searchParams.get(CAP_NATIVE_OAUTH_QUERY) === "1";
}

/** Append cap_native=1 for server-side native OAuth completion routing. */
export function withCapNativeOAuthQuery(href: string): string {
  try {
    const url = new URL(href, typeof window !== "undefined" ? window.location.origin : "https://local.invalid");
    if (url.searchParams.get(CAP_NATIVE_OAUTH_QUERY) === "1") {
      return url.toString();
    }
    url.searchParams.set(CAP_NATIVE_OAUTH_QUERY, "1");
    return url.toString();
  } catch {
    const join = href.includes("?") ? "&" : "?";
    return `${href}${join}${CAP_NATIVE_OAUTH_QUERY}=1`;
  }
}

export function buildCapacitorOAuthCompleteDeepLink(nextPath: string): string {
  const next = nextPath.startsWith("/") ? nextPath : "/xchat";
  return `${CAPACITOR_OAUTH_URL_SCHEME}://${CAPACITOR_OAUTH_COMPLETE_HOST}?next=${encodeURIComponent(next)}`;
}

export function parseCapacitorOAuthCompleteDeepLink(
  rawUrl: string
): { nextPath: string } | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== `${CAPACITOR_OAUTH_URL_SCHEME}:`) {
      return null;
    }
    if (url.hostname !== CAPACITOR_OAUTH_COMPLETE_HOST) {
      return null;
    }
    const next = url.searchParams.get("next")?.trim() || "/xchat";
    if (!next.startsWith("/") || next.startsWith("//") || next.includes("..")) {
      return { nextPath: "/xchat" };
    }
    return { nextPath: next };
  } catch {
    return null;
  }
}
