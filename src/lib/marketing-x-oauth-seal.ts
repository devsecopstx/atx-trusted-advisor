import { sealIbkrCpSessionCookie, unsealIbkrCpSessionCookie } from "@/modules/ibkr-integration/session-seal";

/** AES-GCM sealed refresh token at rest in Mongo (`xchat_platform_settings`). Same crypto as IBKR session seal. */
export function sealMarketingXPostingRefreshToken(refreshToken: string, authSecret: string): string {
  return sealIbkrCpSessionCookie(refreshToken, authSecret);
}

export function unsealMarketingXPostingRefreshToken(sealed: string, authSecret: string): string | null {
  return unsealIbkrCpSessionCookie(sealed, authSecret);
}

/** Short-lived access token — same AES-GCM seal as refresh at rest in Mongo. */
export function sealMarketingXPostingAccessToken(accessToken: string, authSecret: string): string {
  return sealIbkrCpSessionCookie(accessToken, authSecret);
}

export function unsealMarketingXPostingAccessToken(sealed: string, authSecret: string): string | null {
  return unsealIbkrCpSessionCookie(sealed, authSecret);
}
