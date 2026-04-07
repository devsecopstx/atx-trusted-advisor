/** HttpOnly cookie storing AES-GCM sealed Client Portal session material (never the literal session in Mongo). */
export const IBKR_CP_SESSION_COOKIE_NAME = "xf_ibkr_cp_session";

/** Bump when consent copy / legal scope changes — stored on `ibkr_user_consents.consentVersion`. */
export const IBKR_CONSENT_VERSION = 1;

export const IBKR_CONSENT_COPY_SUMMARY =
  "Connect IBKR via Client Portal — view balances and (in later phases) place trades and automations. " +
  "You authorize xFinance to call your IBKR Client Portal gateway using a session you provide; we do not store your IBKR password.";
