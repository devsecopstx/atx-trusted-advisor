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
import { oauthAuthErrorMessages } from "@/lib/oauth-auth-error-messages";

import {
    XchatComposerAttachIcon,
    XchatComposerMicIcon,
    XchatComposerWaveformIcon
} from "@/app/xchat/ui/xchat-composer-icons";

type XchatGuestPanelProps = {
  userEmail?: string;
  pendingApproval?: boolean;
  authError?: string;
  authDetails?: string;
  pendingXHandle?: string;
  content?: ReactNode;
  /** When set (server: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`), show Sign in with Google beside X. */
  googleLoginHref?: string | null;
  /** X OAuth start URL including `next` (e.g. deep link back to `/watchlist?portfolioId=…`). */
  xOAuthLoginHref?: string;
  /** Email + password login URL including `next` return path. */
  emailPasswordLoginHref?: string;
  registerDefaultPlan?: AccessRequestPlanValue;
  openRegisterByDefault?: boolean;
  /** Trial landing / billing deep links: one primary path (OAuth + email register); returning users use footer sign-in link. */
  registrationFirst?: boolean;
  /** Billing plans page: hide locked composer chrome; keep Access + main content only. */
  hideComposerPreview?: boolean;
};

const DEFAULT_SIGNIN_HREF = "/api/auth/x/login?next=%2Fxchat";
const DEFAULT_EMAIL_LOGIN_HREF = "/login?next=%2Fxchat";
const AUTH_ERROR_COPY: Record<string, string> = {
  ...oauthAuthErrorMessages,
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
  google_oauth_not_configured: "Google sign-in is not configured on this server.",
  email_unverified:
    "Verify your email before signing in — check your inbox for the verification link, or use Sign in with X/Google after verifying.",
  not_authorized_admin:
    "This X account is not allowlisted for global admin on this deployment. Use an allowlisted admin identity or contact ops."
};

export function XchatGuestPanel({
  userEmail,
  pendingApproval = false,
  authError,
  authDetails,
  pendingXHandle,
  content,
  googleLoginHref = null,
  xOAuthLoginHref = DEFAULT_SIGNIN_HREF,
  emailPasswordLoginHref = DEFAULT_EMAIL_LOGIN_HREF,
  registerDefaultPlan = "basic",
  openRegisterByDefault = false,
  registrationFirst = false,
  hideComposerPreview = false
}: XchatGuestPanelProps) {
  const authMessage = authError ? (AUTH_ERROR_COPY[authError] ?? "Sign-in failed.") : null;
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
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
    if (!registrationFirst) {
      setRegisterOpen(true);
    }
  }, [openRegisterByDefault, pendingApproval, registrationFirst]);

  const oauthProviderStack = (
    <>
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
      <a className="cta cta-secondary login-oauth-x xchat-guest-actions__cta" href={xOAuthLoginHref}>
        <XLogoIcon size={20} />
        X
      </a>
    </>
  );

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registerLoading) {
      return;
    }
    const name = registerName.trim();
    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    if (!name || !email) {
      setRegisterError("Username and email are required.");
      setRegisterSuccess(null);
      return;
    }
    if (!/^[a-zA-Z0-9]{2,120}$/.test(name)) {
      setRegisterError("Username must be 2–120 characters; letters and numbers only.");
      setRegisterSuccess(null);
      return;
    }
    if (password.length < 12) {
      setRegisterError("Password must be at least 12 characters.");
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
        body: JSON.stringify({ name, email, requestedPlan: submittedPlan, password })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          existing?: boolean;
          status?: string;
        };
      };
      if (!response.ok) {
        if (response.status === 409) {
          setRegisterError(
            payload.error ??
              "This email already has a password or an existing account. Sign in instead or use forgot password."
          );
          return;
        }
        setRegisterError(payload.error ?? `Could not submit request (${response.status}).`);
        return;
      }
      setRegisterSuccess(
        `Account ready for ${submittedPlanLabel}. Sign in to start your guest trial — billing can be completed anytime.`
      );
      setAccessOpen(true);
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
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
        <span className="status-badge status-ready">{hideComposerPreview ? "Plans" : "xChat"}</span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          {hideComposerPreview ? "Billing & access" : "Trial & subscriptions"}
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
                : "Welcome to xFinance xChat. Start a trial or subscribe for full access. Sign in or register to continue."}
            </span>
          </div>
        )}
      </div>

      <section className="xchat-guest-actions">
        <h2 className="xchat-guest-actions__title">Access</h2>
        <p className="xchat-guest-actions__hint">
          {hideComposerPreview
            ? "Create your account below — plans are on the right. Google and X are optional after email signup."
            : registrationFirst
              ? "Start your Basic trial — no card on this step. Sign up with email first; Google and X are below the form."
              : "Sign in with your email and password. Google and X are available below as optional shortcuts."}
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
          {registrationFirst ? "Get started" : "Sign-up or Sign-in"}
        </button>
        {accessOpen ? (
          registrationFirst && !pendingApproval ? (
            <div
              className="xchat-guest-actions__stack xchat-guest-actions__stack--email-first"
              id="xchat-guest-access-panel"
            >
              <div className="xchat-guest-register-panel xchat-guest-register-panel--primary">
                <form className="xchat-guest-register-form" onSubmit={handleRegister}>
                  {!registerSuccess ? (
                    <>
                      <p className="xchat-guest-register-form__eyebrow">Welcome to your advisory workspace</p>
                      <h3 className="xchat-guest-register-form__title xchat-guest-register-form__title--hero">
                        Let&apos;s get started
                      </h3>
                      <div className="xchat-guest-register-form__grid">
                        <label className="xchat-guest-register-form__field">
                          <span>Username</span>
                          <span className="xchat-guest-register-form__field-hint">Letters and numbers only</span>
                          <input
                            autoComplete="username"
                            disabled={registerLoading}
                            maxLength={120}
                            name="username"
                            onChange={(event) => setRegisterName(event.target.value)}
                            placeholder="Username"
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
                            placeholder="Email address"
                            required
                            type="email"
                            value={registerEmail}
                          />
                        </label>
                        <label className="xchat-guest-register-form__field">
                          <span>Password</span>
                          <span className="xchat-guest-register-form__field-hint">At least 12 characters</span>
                          <div className="xchat-guest-register-form__password-row">
                            <input
                              autoComplete="new-password"
                              disabled={registerLoading}
                              maxLength={128}
                              name="password"
                              onChange={(event) => setRegisterPassword(event.target.value)}
                              placeholder="Password"
                              required
                              type={showRegisterPassword ? "text" : "password"}
                              value={registerPassword}
                            />
                            <button
                              className="xchat-guest-register-form__password-toggle"
                              type="button"
                              onClick={() => setShowRegisterPassword((v) => !v)}
                            >
                              {showRegisterPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </label>
                        <label className="xchat-guest-register-form__field xchat-guest-register-form__field--plan">
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
                        className="cta cta-primary xchat-guest-register-form__submit xchat-guest-actions__cta"
                        disabled={registerLoading}
                        type="submit"
                      >
                        {registerLoading ? "Submitting..." : "Sign up"}
                      </button>
                    </>
                  ) : null}
                  {registerError ? <p className="status-text status-error">{registerError}</p> : null}
                  {registerSuccess ? (
                    <div className="xchat-guest-register-success" role="status">
                      <p className="status-text">{registerSuccess}</p>
                      <p className="xchat-guest-register-success__hint">
                        We don&apos;t email a magic link for this step. You can sign in with <strong>X</strong>,{" "}
                        <strong>Google</strong>, or <strong>email + password</strong> (after setting a password from the
                        approval email) using <strong>the same email</strong> you submitted.
                      </p>
                      <div className="xchat-guest-register-success__actions">
                        {googleLoginHref ? (
                          <a
                            className="cta cta-oauth-google login-google-btn xchat-guest-actions__cta xchat-guest-register-success__cta"
                            href={googleLoginHref}
                          >
                            <GoogleGIcon size={20} />
                            Continue with Google
                          </a>
                        ) : (
                          <button
                            className="cta cta-secondary xchat-guest-actions__cta xchat-guest-actions__cta--disabled xchat-guest-register-success__cta"
                            disabled
                            type="button"
                          >
                            <GoogleGIcon size={20} />
                            Google unavailable
                          </button>
                        )}
                        <a
                          className="cta cta-secondary login-oauth-x xchat-guest-actions__cta xchat-guest-register-success__cta"
                          href={xOAuthLoginHref}
                        >
                          <XLogoIcon size={20} />
                          Continue with X
                        </a>
                        <a
                          className="cta cta-secondary xchat-guest-actions__cta xchat-guest-register-success__cta"
                          href={emailPasswordLoginHref}
                        >
                          Continue with email + password
                        </a>
                      </div>
                    </div>
                  ) : null}
                </form>
                {!registerSuccess ? (
                  <>
                    <p className="xchat-guest-divider">Or continue with</p>
                    <div className="xchat-guest-oauth-row">{oauthProviderStack}</div>
                  </>
                ) : null}
                <p className="xchat-guest-actions__hint xchat-guest-actions__hint--footer">
                  <a className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline" href={emailPasswordLoginHref}>
                    Already have an account? Sign in
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div
              className="xchat-guest-actions__stack xchat-guest-actions__stack--email-first"
              id="xchat-guest-access-panel"
            >
              {!pendingApproval ? (
                <a
                  className="cta cta-primary xchat-guest-actions__cta xchat-guest-actions__cta--email-primary"
                  href={emailPasswordLoginHref}
                >
                  Sign in with email + password
                </a>
              ) : null}
              {!pendingApproval && !registrationFirst ? (
                <button
                  aria-controls="xchat-guest-register-panel"
                  aria-expanded={registerOpen}
                  className="cta cta-secondary xchat-guest-actions__cta"
                  type="button"
                  onClick={() => setRegisterOpen((prev) => !prev)}
                >
                  Register for access
                </button>
              ) : null}
              {pendingApproval ? (
                <button className="cta cta-secondary xchat-guest-actions__cta xchat-guest-actions__cta--disabled" disabled type="button">
                  Register unavailable
                </button>
              ) : null}
              <p className="xchat-guest-divider xchat-guest-divider--secondary">Or continue with</p>
              <div className="xchat-guest-oauth-row xchat-guest-oauth-row--secondary">
                {oauthProviderStack}
              </div>
              {registrationFirst ? (
                <p className="xchat-guest-actions__hint" style={{ marginTop: "0.35rem" }}>
                  <a className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline" href={emailPasswordLoginHref}>
                    Already have an account? Sign in
                  </a>
                </p>
              ) : null}
            </div>
          )
        ) : null}
        {authError === "email_link_required" ? <LinkEmailForm xHandle={pendingXHandle} /> : null}
        {!pendingApproval && registerOpen && accessOpen && !registrationFirst ? (
          <div className="xchat-guest-register-panel" id="xchat-guest-register-panel">
            <button
              className="xchat-guest-register-panel__close"
              type="button"
              onClick={() => setRegisterOpen((prev) => !prev)}
            >
              Back
            </button>
            <form className="xchat-guest-register-form" onSubmit={handleRegister}>
              <h3 className="xchat-guest-register-form__title">Register for access</h3>
              <div className="xchat-guest-register-form__grid">
                <label className="xchat-guest-register-form__field">
                  <span>Username</span>
                  <span className="xchat-guest-register-form__field-hint">Letters and numbers only</span>
                  <input
                    autoComplete="username"
                    disabled={registerLoading}
                    maxLength={120}
                    name="username"
                    onChange={(event) => setRegisterName(event.target.value)}
                    placeholder="Username"
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
                  <span>Password</span>
                  <span className="xchat-guest-register-form__field-hint">At least 12 characters</span>
                  <div className="xchat-guest-register-form__password-row">
                    <input
                      autoComplete="new-password"
                      disabled={registerLoading}
                      maxLength={128}
                      name="password"
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="Password"
                      required
                      type={showRegisterPassword ? "text" : "password"}
                      value={registerPassword}
                    />
                    <button
                      className="xchat-guest-register-form__password-toggle"
                      type="button"
                      onClick={() => setShowRegisterPassword((v) => !v)}
                    >
                      {showRegisterPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <label className="xchat-guest-register-form__field xchat-guest-register-form__field--plan">
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
              {registerSuccess ? (
                <div className="xchat-guest-register-success" role="status">
                  <p className="status-text">{registerSuccess}</p>
                  <p className="xchat-guest-register-success__hint">
                    We don&apos;t email a magic link for this step. You can sign in with <strong>X</strong>,{" "}
                    <strong>Google</strong>, or <strong>email + password</strong> (after setting a password from the
                    approval email) using <strong>the same email</strong> you submitted.
                  </p>
                  <div className="xchat-guest-register-success__actions">
                    {googleLoginHref ? (
                      <a
                        className="cta cta-oauth-google login-google-btn xchat-guest-actions__cta xchat-guest-register-success__cta"
                        href={googleLoginHref}
                      >
                        <GoogleGIcon size={20} />
                        Continue with Google
                      </a>
                    ) : (
                      <button
                        className="cta cta-secondary xchat-guest-actions__cta xchat-guest-actions__cta--disabled xchat-guest-register-success__cta"
                        disabled
                        type="button"
                      >
                        <GoogleGIcon size={20} />
                        Google unavailable
                      </button>
                    )}
                    <a
                      className="cta cta-secondary login-oauth-x xchat-guest-actions__cta xchat-guest-register-success__cta"
                      href={xOAuthLoginHref}
                    >
                      <XLogoIcon size={20} />
                      Continue with X
                    </a>
                    <a
                      className="cta cta-secondary xchat-guest-actions__cta xchat-guest-register-success__cta"
                      href={emailPasswordLoginHref}
                    >
                      Continue with email + password
                    </a>
                  </div>
                </div>
              ) : null}
            </form>
          </div>
        ) : null}
      </section>

      {hideComposerPreview ? null : (
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
      )}
    </div>
  );
}
