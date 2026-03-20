import { redirect } from "next/navigation";

import { readPendingXLinkCookie } from "@/lib/auth";

import { AtxFinanceLogo } from "../ui/atxfinance-logo";
import { LinkEmailForm } from "./ui/link-email-form";
import { LoginProductPanel } from "./ui/login-product-panel";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; details?: string; next?: string }>;
};

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
  const hasReturnTo = typeof params.next === "string" && params.next.trim().length > 0;
  if (!errorCode && !errorDetails && !hasReturnTo) {
    redirect("/xchat");
  }
  const message = errorCode ? (errorCopy[errorCode] ?? "Login failed.") : null;

  const pendingXHandle =
    errorCode === "email_link_required" ? (await readPendingXLinkCookie())?.username : undefined;

  return (
    <main className="core-shell login-shell">
      <div className="login-grid">
        <section className="hero-card xf-noise-overlay login-hero">
          <AtxFinanceLogo size="lg" showSubtitle />
          <h1 className="hero-title">Sign In</h1>
          <p className="hero-copy">
            Authenticate with X to access the atxFinance control plane.
          </p>
          {message ? <p className="status-text status-error">{message}</p> : null}
          {errorDetails ? (
            <p className="status-text status-error">details: {errorDetails}</p>
          ) : null}
          <div className="cta-row">
            <a className="cta cta-primary" href="/api/auth/x/login">
              Login with X
            </a>
          </div>
          {errorCode === "email_link_required" ? (
            <LinkEmailForm xHandle={pendingXHandle} />
          ) : null}
        </section>
        <LoginProductPanel />
      </div>
    </main>
  );
}
