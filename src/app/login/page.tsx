import { isSafeOAuthReturnPath } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";

import { AuthMarketingLayout } from "./ui/auth-marketing-layout";
import { LoginAuthSurfaceClient } from "./ui/login-auth-surface-client";

const LOGIN_QUERY_ERROR_COPY: Record<string, string> = {
  session_not_grounded: "Your session ended. Sign in again to continue."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next.trim() : Array.isArray(sp.next) ? sp.next[0]?.trim() ?? "" : "";
  const nextPath = rawNext && isSafeOAuthReturnPath(rawNext) ? rawNext : "/xchat";
  const errRaw = typeof sp.error === "string" ? sp.error.trim() : Array.isArray(sp.error) ? sp.error[0]?.trim() : "";
  const errorMessage = errRaw ? (LOGIN_QUERY_ERROR_COPY[errRaw] ?? errRaw) : null;

  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(nextPath)}`
    : null;
  const xOAuthLoginHref = `/api/auth/x/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthMarketingLayout>
      <LoginAuthSurfaceClient
        errorMessage={errorMessage}
        googleLoginHref={googleLoginHref}
        nextPath={nextPath}
        xOAuthLoginHref={xOAuthLoginHref}
      />
    </AuthMarketingLayout>
  );
}
