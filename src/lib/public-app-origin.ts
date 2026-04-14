import { getEnv } from "@/lib/env";

/** Origin for password-invite / reset links (email bodies). */
export function resolvePublicAppOrigin(request: Request): string {
  try {
    const fromEnv = getEnv().PUBLIC_APP_BASE_URL?.trim().replace(/\/$/, "");
    if (fromEnv) {
      return fromEnv;
    }
  } catch {
    /* tests or partial env */
  }
  return new URL(request.url).origin;
}
