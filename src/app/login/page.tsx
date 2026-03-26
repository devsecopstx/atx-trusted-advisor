import Link from "next/link";

import { isSafeOAuthReturnPath, readPendingXLinkCookie } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";

import { AtxFinanceLogo } from "../ui/atxfinance-logo";
import { GoogleGIcon, XLogoIcon } from "../ui/oauth-provider-icons";
import { LinkEmailForm } from "./ui/link-email-form";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; details?: string; next?: string }>;
};

const DEFAULT_POST_LOGIN = "/xchat";

const errorCopy: Record<string, string> = {
  missing_oauth_context:
    "OAuth context is missing. Use the same host for app + callback and retry login.",
  missing_oauth_callback_params: "OAuth callback is missing code/state. Retry login from this page.",
  missing_oauth_cookie_context:
    "OAuth session cookies were not found (often from opening the login link in another app/tab, or a different host). Use Sign in below from this page, or start OAuth from the home page.",
  invalid_oauth_state: "Invalid OAuth state. Please retry login.",
  token_exchange_failed: "X token exchange failed. Verify client credentials.",
  missing_access_token: "X OAuth did not return an access token.",
  userinfo_failed: "Could not load your X profile.",
  invalid_user_profile: "Your X profile payload is invalid.",
  not_authorized_admin: "Your X account is not authorized for core admin.",
  not_authorized_user: "Your account is not yet approved for aTx Trusted Advisor access.",
  access_request_pending:
    "Access request pending. An admin must approve your access before you can continue.",
  email_link_required:
    "X login succeeded but no email claim was returned. Link your email to continue.",
  not_seeded_email: "Your email is not seeded in core_users.",
  tenant_bootstrap_failed: "Could not attach your account to the default tenant.",
  bootstrap_failed:
    "Sign-in almost worked, but finishing your account (tenant, portfolio, or session) failed. Retry once; if it persists, check Cloud Run logs for [auth/x/callback] or MongoDB connectivity.",
  google_email_required:
    "Google did not return a verified email. Add one to your Google account and retry, or use Sign in with X.",
  google_oauth_not_configured: "Google sign-in is not configured on this server (missing client id or secret)."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorCode = params.error;
  const errorDetails = params.details;
  const rawNext = typeof params.next === "string" ? params.next.trim() : "";
  const nextPath = rawNext && isSafeOAuthReturnPath(rawNext) ? rawNext : DEFAULT_POST_LOGIN;
  const xLoginHref = `/api/auth/x/login?next=${encodeURIComponent(nextPath)}`;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(nextPath)}`
    : null;

  const message = errorCode ? (errorCopy[errorCode] ?? "Login failed.") : null;

  const pendingXHandle =
    errorCode === "email_link_required" ? (await readPendingXLinkCookie())?.username : undefined;

  return (
    <main className="core-shell login-shell login-shell--xoptions">
      <div className="login-grid login-grid--single">
        <section className="hero-card xf-noise-overlay login-hero">
          <p className="login-powered-by">
            <span className="xf-powered-by-muted">Powered by </span>
            <span className="login-powered-by-brand">xAI</span>
          </p>
          <p className="login-gains-tagline">No Atoms Moved — Just Gains Earned.</p>
          <AtxFinanceLogo size="lg" showSubtitle={false} />
          <h1 className="hero-title">Register or sign in</h1>
          <p className="hero-copy">
            Authenticate with Google or X to reach the aTx Trusted Advisor workspace. After sign-in, you&apos;ll return to{" "}
            <code className="login-code">{DEFAULT_POST_LOGIN}</code>
            {nextPath !== DEFAULT_POST_LOGIN ? (
              <>
                {" "}
                (this visit: <code className="login-code">{nextPath}</code>)
              </>
            ) : null}
            .
          </p>

          <div className="login-auth-stack">
            <Link className="cta cta-secondary login-register-cta" href="/xchat">
              Register — explore xChat &amp; request access
            </Link>
            <p className="login-hint">
              New here? Start on xChat; sign in with Google or X when you are ready for an approved session.
            </p>
          </div>

          {message ? <p className="status-text status-error">{message}</p> : null}
          {errorCode === "missing_oauth_cookie_context" ? (
            <p className="login-hint login-hint--contact">
              Need access first?{" "}
              <Link className="login-xoptions-link" href="/#contact">
                Request a demo or onboarding details
              </Link>{" "}
              (Formspree on the home page).
            </p>
          ) : null}
          {errorDetails ? (
            <p className="status-text status-error">details: {errorDetails}</p>
          ) : null}

          <div className="cta-row login-oauth-row">
            {googleLoginHref ? (
              <a className="cta cta-primary login-google-btn" href={googleLoginHref}>
                <GoogleGIcon size={20} className="shrink-0" />
                Sign in with Google
              </a>
            ) : null}
            <a className={`cta ${googleLoginHref ? "cta-secondary" : "cta-primary"}`} href={xLoginHref}>
              <XLogoIcon size={20} className="shrink-0" />
              Sign in with X
            </a>
          </div>

          <p className="login-xoptions-bridge">
            <Link className="login-xoptions-link" href="/app_user/xoptions">
              xoptions pitch
            </Link>
            <span aria-hidden> · </span>
            same story: outcomes first, execution-grade tooling.
          </p>

          {errorCode === "email_link_required" ? (
            <LinkEmailForm xHandle={pendingXHandle} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
