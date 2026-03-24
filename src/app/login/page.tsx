import Link from "next/link";

import { isSafeOAuthReturnPath, readPendingXLinkCookie } from "@/lib/auth";

import { AtxFinanceLogo } from "../ui/atxfinance-logo";
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
    "OAuth cookies were not found. Start login from this page (same host as callback), clear cookies if needed, and retry.",
  invalid_oauth_state: "Invalid OAuth state. Please retry login.",
  token_exchange_failed: "X token exchange failed. Verify client credentials.",
  missing_access_token: "X OAuth did not return an access token.",
  userinfo_failed: "Could not load your X profile.",
  invalid_user_profile: "Your X profile payload is invalid.",
  not_authorized_admin: "Your X account is not authorized for core admin.",
  not_authorized_user: "Your account is not yet approved for atxFinance access.",
  access_request_pending:
    "Access request pending. An admin must approve your access before you can continue.",
  email_link_required:
    "X login succeeded but no email claim was returned. Link your email to continue.",
  not_seeded_email: "Your email is not seeded in core_users.",
  tenant_bootstrap_failed: "Could not attach your account to the default tenant.",
  bootstrap_failed:
    "Sign-in almost worked, but finishing your account (tenant, portfolio, or session) failed. Retry once; if it persists, check Cloud Run logs for [auth/x/callback] or MongoDB connectivity."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorCode = params.error;
  const errorDetails = params.details;
  const rawNext = typeof params.next === "string" ? params.next.trim() : "";
  const nextPath = rawNext && isSafeOAuthReturnPath(rawNext) ? rawNext : DEFAULT_POST_LOGIN;
  const xLoginHref = `/api/auth/x/login?next=${encodeURIComponent(nextPath)}`;

  const message = errorCode ? (errorCopy[errorCode] ?? "Login failed.") : null;

  const pendingXHandle =
    errorCode === "email_link_required" ? (await readPendingXLinkCookie())?.username : undefined;

  return (
    <main className="core-shell login-shell login-shell--xoptions">
      <div className="login-grid login-grid--single">
        <section className="hero-card xf-noise-overlay login-hero">
          <p className="login-powered-by">Powered by xAI</p>
          <p className="login-gains-tagline">No Atoms Moved — Just Gains Earned.</p>
          <AtxFinanceLogo size="lg" showSubtitle />
          <h1 className="hero-title">Register or sign in</h1>
          <p className="hero-copy">
            Authenticate with X to reach the atxFinance workspace. After sign-in, you&apos;ll return to{" "}
            <code className="login-code">{DEFAULT_POST_LOGIN}</code>
            {nextPath !== DEFAULT_POST_LOGIN ? (
              <>
                {" "}
                (this visit: <code className="login-code">{nextPath}</code>)
              </>
            ) : null}
            .
          </p>
          {message ? <p className="status-text status-error">{message}</p> : null}
          {errorDetails ? (
            <p className="status-text status-error">details: {errorDetails}</p>
          ) : null}

          <div className="login-auth-stack">
            <Link className="cta cta-secondary login-register-cta" href="/xchat">
              Register — explore xChat &amp; request access
            </Link>
            <p className="login-hint">
              New here? Start on xChat; sign in with X when you are ready for an approved session.
            </p>
          </div>

          <div className="cta-row login-oauth-row">
            <a className="cta cta-primary" href={xLoginHref}>
              Sign in with X
            </a>
            <button
              className="cta cta-secondary login-google-btn"
              disabled
              type="button"
              title="Google sign-in is not wired yet"
            >
              Google (soon)
            </button>
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
