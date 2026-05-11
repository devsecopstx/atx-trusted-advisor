/** Finance / session-backed APIs — avoid CDN or browser bf-cache reuse of live desk data. */
export const SENSITIVE_APP_USER_CACHE_HEADERS = {
  "Cache-Control": "no-store, private"
} as const;
