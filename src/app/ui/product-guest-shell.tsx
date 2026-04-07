"use client";

import type { ReactNode } from "react";

import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestPanel } from "@/app/xchat/ui/xchat-guest-panel";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import type { SessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { canUserLogin } from "@/modules/identity/authorization";

export type ProductGuestShellProps = {
  /** OAuth return path after sign-in (must be allowlisted server-side). */
  nextPath: string;
  session: SessionUser | null;
  /** Shown above the standard guest / pending-access CTAs. */
  blurb: ReactNode;
  authError?: string;
  authDetails?: string;
  pendingXHandle?: string;
};

/**
 * Renders the public product shell at the real URL (no redirect to /xchat) for guests
 * or users pending platform access — same OAuth return pattern as xChat.
 */
export function ProductGuestShell({
  nextPath,
  session,
  blurb,
  authError,
  authDetails,
  pendingXHandle
}: ProductGuestShellProps) {
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(nextPath)}`
    : null;
  const xOAuthLoginHref = `/api/auth/x/login?next=${encodeURIComponent(nextPath)}`;
  const pendingApproval = session != null && !canUserLogin(session.roles);

  return (
    <div className="xchat-shell">
      <XchatGuestHeader />
      <div className="xchat-body">
        <XchatGuestReadonlyShell showAccessPanel={false} googleLoginHref={googleLoginHref}>
          <XchatGuestPanel
            authDetails={authDetails}
            authError={authError}
            content={blurb}
            googleLoginHref={googleLoginHref}
            pendingApproval={pendingApproval}
            pendingXHandle={pendingXHandle}
            userEmail={session?.email}
            xOAuthLoginHref={xOAuthLoginHref}
          />
        </XchatGuestReadonlyShell>
      </div>
    </div>
  );
}
