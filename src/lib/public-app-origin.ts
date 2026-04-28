import { getEnv } from "@/lib/env";

const DEFAULT_PUBLIC_APP_ORIGIN = "https://atxtrustedadvisory.com";

function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** Origin for password-invite / reset links (email bodies). */
export function resolvePublicAppOrigin(request: Request): string {
  try {
    const fromEnv = getEnv().PUBLIC_APP_BASE_URL?.trim().replace(/\/$/, "");
    if (fromEnv && !isLocalOrigin(fromEnv)) {
      return fromEnv;
    }
  } catch {
    /* tests or partial env */
  }
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, "");
  if (!isLocalOrigin(requestOrigin)) {
    return requestOrigin;
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}
