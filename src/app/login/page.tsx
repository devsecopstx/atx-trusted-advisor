import { isSafeOAuthReturnPath } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";

import { EmailLoginPanel } from "./ui/email-login-panel";
import { LoginOAuthDivider, LoginOAuthSection } from "./ui/login-oauth-section";
import { LoginPageHeader } from "./ui/login-page-header";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next.trim() : Array.isArray(sp.next) ? sp.next[0]?.trim() ?? "" : "";
  const nextPath = rawNext && isSafeOAuthReturnPath(rawNext) ? rawNext : "/xchat";
  const errRaw = typeof sp.error === "string" ? sp.error.trim() : Array.isArray(sp.error) ? sp.error[0]?.trim() : "";

  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(nextPath)}`
    : null;
  const xOAuthLoginHref = `/api/auth/x/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <LoginPageHeader />
        {errRaw ? (
          <p className="status-text status-error text-sm" role="alert">
            {errRaw}
          </p>
        ) : null}
        <EmailLoginPanel nextPath={nextPath} />
        <LoginOAuthDivider label="or continue with" />
        <LoginOAuthSection googleLoginHref={googleLoginHref} xOAuthLoginHref={xOAuthLoginHref} />
      </div>
    </div>
  );
}
