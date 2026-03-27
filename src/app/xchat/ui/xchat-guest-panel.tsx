"use client";

import { SendIcon } from "@/app/admin/ui/crud-icons";
import { LinkEmailForm } from "@/app/login/ui/link-email-form";
import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

type XchatGuestPanelProps = {
  userEmail?: string;
  pendingApproval?: boolean;
  authError?: string;
  authDetails?: string;
  pendingXHandle?: string;
  /** When set (server: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`), show Sign in with Google beside X. */
  googleLoginHref?: string | null;
};

const DEFAULT_SIGNIN_HREF = "/api/auth/x/login?next=%2Fxchat";
const AUTH_ERROR_COPY: Record<string, string> = {
  missing_oauth_context: "OAuth context is missing. Retry sign-in from this xChat page.",
  missing_oauth_callback_params: "OAuth callback is missing code/state. Retry sign-in.",
  missing_oauth_cookie_context:
    "OAuth session cookies were not found. Use the Sign up or Sign in button from this page and complete sign-in in the same browser tab.",
  invalid_oauth_state: "Invalid OAuth state. Retry sign-in.",
  token_exchange_failed: "Token exchange failed. Verify OAuth credentials and callback URL.",
  missing_access_token: "OAuth provider did not return an access token.",
  userinfo_failed: "Could not load your profile from provider.",
  invalid_user_profile: "Your provider profile payload is invalid.",
  access_request_pending: "Access request pending. An admin must approve your account before sign-in completes.",
  email_link_required:
    "Sign-in succeeded but no verified email was returned. Link your email to continue.",
  not_seeded_email: "Your email is not seeded/authorized for this workspace.",
  bootstrap_failed: "Sign-in almost worked, but account bootstrap failed. Retry once and check logs.",
  google_email_required: "Google did not return a verified email. Add one and retry.",
  google_oauth_not_configured: "Google sign-in is not configured on this server."
};

function XchatComposerAttachIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={20} viewBox="0 0 24 24" width={20}>
      <path d="M16.5 6v11.5a4.5 4.5 0 11-9 0V5a2.5 2.5 0 015 0v10.5a1 1 0 11-2 0V6H9v9.5a3 3 0 106 0V5a4 4 0 00-8 0v12.5a6 6 0 1012 0V6h-1.5z" />
    </svg>
  );
}

function XchatComposerMicIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={20} viewBox="0 0 24 24" width={20}>
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm6-3h-1.7c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z" />
    </svg>
  );
}

function XchatComposerWaveformIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={18} viewBox="0 0 24 24" width={18}>
      <rect height="10" rx="1" width="3" x="5" y="7" />
      <rect height="16" rx="1" width="3" x="10.5" y="4" />
      <rect height="8" rx="1" width="3" x="16" y="8" />
    </svg>
  );
}

export function XchatGuestPanel({
  userEmail,
  pendingApproval = false,
  authError,
  authDetails,
  pendingXHandle,
  googleLoginHref = null
}: XchatGuestPanelProps) {
  const authMessage = authError ? (AUTH_ERROR_COPY[authError] ?? "Sign-in failed.") : null;

  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">xChat</span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Invite-only access
        </span>
      </div>

      <div className="xchat-messages">
        <div className="xchat-msg xchat-msg-ai">
          <small style={{ color: "var(--xf-text-400)", display: "block", marginBottom: "0.3rem" }}>
            xChat
          </small>
          <span style={{ whiteSpace: "pre-wrap" }}>
            {pendingApproval
              ? `Your account${userEmail ? ` (${userEmail})` : ""} is signed in but not approved yet. Request access and we will review it.`
              : "Welcome to aTx Trusted Advisory xChat. This is an invite-only app. Sign up to request access."}
          </span>
        </div>
      </div>

      <section className="xchat-guest-actions">
        <h2 className="xchat-guest-actions__title">Access</h2>
        <p className="xchat-guest-actions__hint">
          Invite-only workspace. Composer is visible for preview, but prompting and portfolio actions are locked.
        </p>
        {authMessage ? <p className="status-text status-error">{authMessage}</p> : null}
        {authDetails ? <p className="status-text status-error">details: {authDetails}</p> : null}
        <div className="xchat-guest-actions__stack">
          {googleLoginHref ? (
            <>
              <a
                className="cta cta-oauth-google login-google-btn xchat-guest-actions__cta"
                href={googleLoginHref}
              >
                <GoogleGIcon size={20} />
                Sign in with Google
              </a>
              <a
                className="cta cta-secondary login-oauth-x xchat-guest-actions__cta"
                href={DEFAULT_SIGNIN_HREF}
              >
                <XLogoIcon size={20} />
                Sign in with X
              </a>
            </>
          ) : (
            <a className="cta cta-primary xchat-guest-actions__cta" href={DEFAULT_SIGNIN_HREF}>
              <XLogoIcon size={20} />
              Sign up or Sign in
            </a>
          )}
        </div>
        {authError === "email_link_required" ? <LinkEmailForm xHandle={pendingXHandle} /> : null}
      </section>

      <form className="xchat-composer-wrap">
        <div className="xchat-composer">
          <XfHoverHint hint="Attach files (available after sign-in)">
            <button
              aria-label="Attach files — disabled for guest"
              className="xchat-composer__icon-btn xchat-composer__icon-btn--beta"
              disabled
              type="button"
            >
              <XchatComposerAttachIcon />
            </button>
          </XfHoverHint>
          <XfHoverHint hint="Composer preview — sign up or sign in to ask xChat">
            <textarea
              aria-label="xchat guest prompt"
              className="xchat-composer__field xchat-composer__textarea"
              disabled
              placeholder="Composer preview — sign up or sign in to ask xChat"
              readOnly
              value=""
              rows={1}
            />
          </XfHoverHint>
          <XfHoverHint hint="Model selector (available after sign-in)">
            <button
              aria-label="Model selector — disabled for guest"
              className="xchat-composer__auto xchat-composer__icon-btn--beta"
              disabled
              type="button"
            >
              Auto <span className="xchat-composer__chev">▾</span>
            </button>
          </XfHoverHint>
          <XfHoverHint hint="Dictation (available after sign-in)">
            <button
              aria-label="Dictation — disabled for guest"
              className="xchat-composer__icon-btn xchat-composer__icon-btn--beta"
              disabled
              type="button"
            >
              <XchatComposerMicIcon />
            </button>
          </XfHoverHint>
          <XfHoverHint hint="Voice mode (available after sign-in)">
            <button
              aria-label="Voice mode — disabled for guest"
              className="xchat-composer__voice xchat-composer__icon-btn--beta"
              disabled
              type="button"
            >
              <XchatComposerWaveformIcon />
            </button>
          </XfHoverHint>
          <XfHoverHint hint="Sign up or sign in to send prompts">
            <button
              aria-label="Send prompt (locked)"
              className="xchat-composer__send"
              disabled
              type="button"
            >
              <SendIcon className="crud-icon" />
              Send
            </button>
          </XfHoverHint>
        </div>
        <p className="xchat-composer-hint">
          <span className="xchat-composer-hint__pill">Locked</span>
          <span className="xchat-composer-hint__text">Sign up or sign in for approved access.</span>
        </p>
      </form>
    </div>
  );
}
