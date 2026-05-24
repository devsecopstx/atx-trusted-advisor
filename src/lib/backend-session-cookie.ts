import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";

/**
 * Spring session resolution expects a Cookie header fragment like `xf_core_session=<token>`.
 * xChat forwards the full browser `Cookie` header; some Next callers only have the raw token value.
 */
export function formatBackendSessionCookieHeader(cookie: string): string {
  const trimmed = cookie.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(`${SESSION_COOKIE_NAME}=`)) {
    return trimmed;
  }
  if (!trimmed.includes("=") && !trimmed.includes(";")) {
    return `${SESSION_COOKIE_NAME}=${trimmed}`;
  }
  return trimmed;
}
