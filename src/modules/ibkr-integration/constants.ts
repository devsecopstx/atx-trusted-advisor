/** HttpOnly cookie storing AES-GCM sealed Client Portal session material (never the literal session in Mongo). */
export const IBKR_CP_SESSION_COOKIE_NAME = "xf_ibkr_cp_session";

/** HttpOnly cookie storing session issue time (`Date.now()` ms) for UX hints — not security-critical. */
export const IBKR_CP_SESSION_ISSUED_MS_COOKIE_NAME = "xf_ibkr_cp_issued";

/** Matches `maxAge` on `xf_ibkr_cp_session` (re-paste recommended after CP logout or gateway restart). */
export const IBKR_CP_SESSION_MAX_AGE_SEC = 60 * 60 * 24;

/** Bump when consent copy / legal scope changes — stored on `ibkr_user_consents.consentVersion`. */
export const IBKR_CONSENT_VERSION = 1;

export const IBKR_CONSENT_COPY_SUMMARY =
  "Connect IBKR via Client Portal — view balances and (in later phases) place trades and automations. " +
  "You authorize aTx Advisor to call your IBKR Client Portal gateway using a session you provide; we do not store your IBKR password.";
