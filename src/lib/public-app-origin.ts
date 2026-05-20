import { getEnv } from "@/lib/env";
import { FINTECH_ADVISOR_PROD_ORIGIN } from "@/lib/xfinance-brand";

const DEFAULT_PUBLIC_APP_ORIGIN = FINTECH_ADVISOR_PROD_ORIGIN;

/** Hosts that must never appear in user-facing email links (loopback, bind-all, metadata). */
export function shouldRejectPublicLinkOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host === "[::]"
    );
  } catch {
    return true;
  }
}

/** Origin for password-invite / reset links (email bodies). */
export function resolvePublicAppOrigin(request: Request): string {
  try {
    const fromEnv = getEnv().PUBLIC_APP_BASE_URL?.trim().replace(/\/$/, "");
    if (fromEnv && !shouldRejectPublicLinkOrigin(fromEnv)) {
      return fromEnv;
    }
  } catch {
    /* tests or partial env */
  }
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, "");
  if (!shouldRejectPublicLinkOrigin(requestOrigin)) {
    return requestOrigin;
  }
  return DEFAULT_PUBLIC_APP_ORIGIN;
}
