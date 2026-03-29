"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";

import { SendIcon } from "@/app/admin/ui/crud-icons";
import { LinkEmailForm } from "@/app/login/ui/link-email-form";
import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import {
  ACCESS_REQUEST_PLAN_OPTIONS,
  accessRequestPlanLabel,
  type AccessRequestPlanValue
} from "@/lib/access-request-plans";

type XchatGuestPanelProps = {
  userEmail?: string;
  pendingApproval?: boolean;
  authError?: string;
  authDetails?: string;
  pendingXHandle?: string;
  content?: ReactNode;
  /** When set (server: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`), show Sign in with Google beside X. */
  googleLoginHref?: string | null;
  registerDefaultPlan?: AccessRequestPlanValue;
  openRegisterByDefault?: boolean;
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
  content,
  googleLoginHref = null,
  registerDefaultPlan = "free",
  openRegisterByDefault = false
}: XchatGuestPanelProps) {
  const authMessage = authError ? (AUTH_ERROR_COPY[authError] ?? "Sign-in failed.") : null;
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [registerPlan, setRegisterPlan] = useState<AccessRequestPlanValue>(registerDefaultPlan);

  useEffect(() => {
    setRegisterPlan(registerDefaultPlan);
  }, [registerDefaultPlan]);

  useEffect(() => {
    if (!openRegisterByDefault || pendingApproval) {
      return;
    }
    setAccessOpen(true);
    setRegisterOpen(true);
  }, [openRegisterByDefault, pendingApproval]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registerLoading) {
      return;
    }
    const name = registerName.trim();
    const email = registerEmail.trim().toLowerCase();
    if (!name || !email) {
      setRegisterError("Name and email are required.");
      setRegisterSuccess(null);
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    const submittedPlan = registerPlan;
    const submittedPlanLabel = accessRequestPlanLabel(submittedPlan);
    try {
      const response = await fetch("/api/access-requests/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, requestedPlan: submittedPlan })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          existing?: boolean;
          status?: string;
        };
      };
      if (!response.ok) {
        setRegisterError(payload.error ?? `Could not submit request (${response.status}).`);
        return;
      }
      setRegisterSuccess(
        payload.data?.existing
          ? `You already have a pending ${submittedPlanLabel} request. We will review it soon.`
          : `Request submitted for ${submittedPlanLabel}. An admin will review your access.`
      );
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPlan(registerDefaultPlan);
    } catch {
      setRegisterError("Network error. Retry in a moment.");
    } finally {
      setRegisterLoading(false);
    }
  }

  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">xChat</span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Invite-only access
        </span>
      </div>

      <div className="xchat-messages">
        {content ? (
          <div className="xchat-msg xchat-msg-ai xchat-guest-content-panel">{content}</div>
        ) : (
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
        )}
      </div>

      <section className="xchat-guest-actions">
        <h2 className="xchat-guest-actions__title">Access</h2>
        <p className="xchat-guest-actions__hint">
          Invite-only workspace. Composer is visible for preview, but prompting and portfolio actions are locked.
        </p>
        {authMessage ? <p className="status-text status-error">{authMessage}</p> : null}
        {authDetails ? <p className="status-text status-error">details: {authDetails}</p> : null}
        <button
          aria-controls="xchat-guest-access-panel"
          aria-expanded={accessOpen}
          className="cta cta-primary xchat-guest-actions__launcher"
          type="button"
          onClick={() => setAccessOpen((prev) => !prev)}
        >
          Sign-up or Sign-in
        </button>
        {accessOpen ? (
          <div className="xchat-guest-actions__stack" id="xchat-guest-access-panel">
            {googleLoginHref ? (
              <a className="cta cta-oauth-google login-google-btn xchat-guest-actions__cta" href={googleLoginHref}>
                <GoogleGIcon size={20} />
                Google
              </a>
            ) : (
              <button
                className="cta cta-secondary xchat-guest-actions__cta xchat-guest-actions__cta--disabled"
                disabled
                type="button"
              >
                <GoogleGIcon size={20} />
                Google unavailable
              </button>
            )}
            <a className="cta cta-secondary login-oauth-x xchat-guest-actions__cta" href={DEFAULT_SIGNIN_HREF}>
              <XLogoIcon size={20} />
              X
            </a>
            {!pendingApproval ? (
              <button
                aria-controls="xchat-guest-register-panel"
                aria-expanded={registerOpen}
                className="cta cta-secondary xchat-guest-actions__cta"
                type="button"
                onClick={() => setRegisterOpen((prev) => !prev)}
              >
                Register for access
              </button>
            ) : (
              <button className="cta cta-secondary xchat-guest-actions__cta xchat-guest-actions__cta--disabled" disabled type="button">
                Register unavailable
              </button>
            )}
          </div>
        ) : null}
        {authError === "email_link_required" ? <LinkEmailForm xHandle={pendingXHandle} /> : null}
        {!pendingApproval && registerOpen && accessOpen ? (
          <div className="xchat-guest-register-panel" id="xchat-guest-register-panel">
            <button
              className="xchat-guest-register-panel__close"
              type="button"
              onClick={() => setRegisterOpen((prev) => !prev)}
            >
              Submit request for access. invite-only.
            </button>
            <form className="xchat-guest-register-form" onSubmit={handleRegister}>
              <h3 className="xchat-guest-register-form__title">Register for access</h3>
              <div className="xchat-guest-register-form__grid">
                <label className="xchat-guest-register-form__field">
                  <span>Name</span>
                  <input
                    autoComplete="name"
                    disabled={registerLoading}
                    maxLength={120}
                    name="name"
                    onChange={(event) => setRegisterName(event.target.value)}
                    placeholder="Your name"
                    required
                    type="text"
                    value={registerName}
                  />
                </label>
                <label className="xchat-guest-register-form__field">
                  <span>Email</span>
                  <input
                    autoComplete="email"
                    disabled={registerLoading}
                    maxLength={320}
                    name="email"
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                    type="email"
                    value={registerEmail}
                  />
                </label>
                <label className="xchat-guest-register-form__field">
                  <span>Plan</span>
                  <select
                    disabled={registerLoading}
                    name="requestedPlan"
                    onChange={(event) => setRegisterPlan(event.target.value as AccessRequestPlanValue)}
                    value={registerPlan}
                  >
                    {ACCESS_REQUEST_PLAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="cta cta-secondary xchat-guest-register-form__submit"
                disabled={registerLoading}
                type="submit"
              >
                {registerLoading ? "Submitting..." : "Submit registration"}
              </button>
              {registerError ? <p className="status-text status-error">{registerError}</p> : null}
              {registerSuccess ? <p className="status-text">{registerSuccess}</p> : null}
            </form>
          </div>
        ) : null}
      </section>

      <div className="xchat-composer-wrap">
        <form
          className="xchat-composer"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="xchat-composer__row xchat-composer__row--input">
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
          </div>
          <div className="xchat-composer__row xchat-composer__row--actions">
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
                type="submit"
              >
                <SendIcon className="crud-icon" />
                Send
              </button>
            </XfHoverHint>
          </div>
        </form>
        <p className="xchat-composer-hint">
          <span className="xchat-composer-hint__pill">Locked</span>
          <span className="xchat-composer-hint__text">Sign up or sign in for approved access.</span>
        </p>
      </div>
    </div>
  );
}
