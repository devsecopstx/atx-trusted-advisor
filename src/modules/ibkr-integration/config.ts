function readBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value.trim() === "") {
    return defaultValue;
  }
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(s)) {
    return false;
  }
  return defaultValue;
}

function normalizeClientPortalBaseUrl(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) {
    return undefined;
  }
  if (!/^https:\/\//i.test(t)) {
    return undefined;
  }
  try {
    const u = new URL(t);
    return u.href.startsWith("https://") ? t : undefined;
  } catch {
    return undefined;
  }
}

export type IbkrIntegrationConfig = {
  enabled: boolean;
  paperTrading: boolean;
  maxRequestsPerMinute: number;
  clientPortalBaseUrl: string | undefined;
  /**
   * When true, `POST /api/integrations/ibkr/session` accepts a Client Portal `Cookie` header value.
   * Also allowed automatically when `NODE_ENV=development`.
   */
  allowSessionCookieBody: boolean;
  /**
   * **Dangerous (shared session):** when true, `GET /api/integrations/ibkr/accounts` falls back to
   * `IBKR_CLIENT_PORTAL_SESSION_COOKIE` for every user — ops/smoke only.
   */
  useEnvSessionCookie: boolean;
  /** Raw `Cookie` header value for Client Portal (only used when {@link useEnvSessionCookie} is true). */
  clientPortalSessionCookieFromEnv: string | undefined;
};

type IbkrEnvSource = Record<string, string | undefined>;

/**
 * Reads optional `IBKR_*` vars only — does not use {@link getEnv}; safe in tests and when IBKR is off.
 * Default: integration disabled; no impact on existing routes until explicitly enabled.
 */
export function parseIbkrIntegrationConfig(env: IbkrEnvSource = process.env): IbkrIntegrationConfig {
  const enabled = readBooleanEnv(env.IBKR_ENABLED, false);
  const paperTrading = readBooleanEnv(env.IBKR_PAPER, true);
  let maxRequestsPerMinute = 60;
  const rpmRaw = env.IBKR_MAX_REQUESTS_PER_MINUTE?.trim();
  if (rpmRaw) {
    const n = Number(rpmRaw);
    if (Number.isFinite(n) && n >= 1 && n <= 300) {
      maxRequestsPerMinute = Math.floor(n);
    }
  }
  const clientPortalBaseUrl = normalizeClientPortalBaseUrl(env.IBKR_CLIENT_PORTAL_BASE_URL);
  const allowSessionCookieBody = readBooleanEnv(env.IBKR_ALLOW_SESSION_COOKIE_BODY, false);
  const useEnvSessionCookie = readBooleanEnv(env.IBKR_USE_ENV_SESSION_COOKIE, false);
  const clientPortalSessionCookieFromEnv =
    env.IBKR_CLIENT_PORTAL_SESSION_COOKIE?.trim().replace(/\r|\n/g, "") || undefined;
  return {
    enabled,
    paperTrading,
    maxRequestsPerMinute,
    clientPortalBaseUrl,
    allowSessionCookieBody,
    useEnvSessionCookie,
    clientPortalSessionCookieFromEnv
  };
}

/** True when body POST of CP cookie is allowed (explicit env or local dev). */
export function ibkrAllowsSessionCookiePost(env: IbkrEnvSource = process.env): boolean {
  if (readBooleanEnv(env.IBKR_ALLOW_SESSION_COOKIE_BODY, false)) {
    return true;
  }
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv === "development";
}
