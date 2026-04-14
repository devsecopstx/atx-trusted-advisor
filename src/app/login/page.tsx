import Link from "next/link";

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
        <LoginOAuthSection googleLoginHref={googleLoginHref} xOAuthLoginHref={xOAuthLoginHref} />
        <LoginOAuthDivider />
        <EmailLoginPanel nextPath={nextPath} />
        <p className="text-xs leading-relaxed text-[var(--xf-text-muted)]">
          After an admin approves your access request, you may get an email to set your password. Links require{" "}
          <code className="rounded bg-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] px-1 py-0.5 text-[0.7rem]">
            PUBLIC_APP_BASE_URL
          </code>{" "}
          and desk SMTP when enabled.{" "}
          <Link href="/xchat" className="text-[var(--xf-gain-green)] underline underline-offset-2 hover:opacity-90">
            Open xChat
          </Link>
        </p>
      </div>
    </div>
  );
}
