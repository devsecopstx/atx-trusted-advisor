import { NextResponse } from "next/server";

import {
    clearOAuthFlowCookies,
    consumeOAuthReturnPathCookie,
    getSessionUser,
    isSafeOAuthReturnPath,
    readOAuthFlowCookies
} from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import {
    getAtxfinanceBackendOrigin,
    getEnv,
    getGoogleClientId,
    isAllowAnyXUserLoginEnabled,
    isGoogleOAuthConfigured
} from "@/lib/env";
import { googleLinkedId } from "@/lib/google-oauth-identity";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import { finalizeOAuthSessionAndRedirect } from "@/lib/oauth-complete-session";
import { isSeedAdminEmail } from "@/lib/seed-admin-email";
import { sendEmailVerificationEmail } from "@/lib/send-email-credential-messages";
import { isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import {
    createAccessRequest,
    getPendingAccessRequestByUserAndRole
} from "@/modules/core-admin/repository";
import { isCoreUserAccountAccessApproved } from "@/modules/identity/account-status";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { issueEmailVerificationForUser } from "@/modules/identity/email-credentials-repository";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import {
    ensureCoreUserByEmail,
    ensureSeededGlobalAdmin,
    getCoreUserByEmail,
    getCoreUserByGoogleSub,
    linkGoogleAccountToUser,
    unlinkGoogleIdentityFromUser
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

type GoogleTokenResponse = {
  access_token: string;
  token_type: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function googleUsernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const safe = local.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48);
  return safe || "google_user";
}

async function ensurePendingOperatorAccessRequestAfterGoogleOAuth(user: CoreUser): Promise<void> {
  const oid = user._id;
  if (!oid) {
    return;
  }
  const userId = oid.toHexString();
  const requestedRole = "operator" as const;
  const existingPending = await getPendingAccessRequestByUserAndRole({
    userId,
    requestedRole
  });
  if (existingPending) {
    return;
  }
  await createAccessRequest({
    userId,
    requestedRole,
    contactEmail: user.email,
    reason: "Auto-created from unapproved Google login attempt"
  });
}

function isSameUserId(
  left: { toHexString: () => string },
  right: { toHexString: () => string }
): boolean {
  return left.toHexString() === right.toHexString();
}

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
  }

  if (
    getAtxfinanceBackendOrigin() &&
    process.env.AUTH_CALLBACK_USE_SPRING === "true"
  ) {
    const proxied = await proxyRequestToBackend(request);
    if (proxied) {
      const headers = new Headers(proxied.headers);
      return new Response(proxied.body, { status: proxied.status, headers });
    }
  }

  const env = getEnv();
  const url = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);
  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(url.pathname + url.search, url.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }

  const configuredCallbackUrl = env.GOOGLE_OAUTH_CALLBACK_URL?.trim();
  if (env.NODE_ENV === "production" && configuredCallbackUrl) {
    try {
      const callbackHost = new URL(configuredCallbackUrl).host.toLowerCase();
      const currentHost = getPublicOriginFromRequest(request)
        .replace(/^https?:\/\//, "")
        .toLowerCase();
      if (callbackHost !== currentHost) {
        const canonical = new URL(url.pathname + url.search, configuredCallbackUrl);
        return NextResponse.redirect(canonical.toString());
      }
    } catch {
      // fall through
    }
  }

  const origin = getPublicOriginFromRequest(request);
  const loginMeta = extractClientLoginMeta(request);

  async function redirectWithLoginAudit(
    errorCode: string,
    fields?: {
      userId?: string;
      xUserId?: string;
      username?: string;
      email?: string;
    },
    extraParams?: Record<string, string>
  ): Promise<NextResponse> {
    await appendLoginAuditRecord({
      outcome: "failure",
      provider: "google_oauth",
      errorCode,
      clientIp: loginMeta.clientIp,
      country: loginMeta.country,
      userAgent: loginMeta.userAgent,
      ...fields
    });
    const target = new URL(`/xchat?error=${encodeURIComponent(errorCode)}`, origin);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        target.searchParams.set(k, v);
      }
    }
    return NextResponse.redirect(target.toString());
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const callbackUrl =
    env.NODE_ENV === "production"
      ? (env.GOOGLE_OAUTH_CALLBACK_URL ?? `${origin}/api/auth/google/callback`)
      : `${origin}/api/auth/google/callback`;

  if (!code || !state) {
    return redirectWithLoginAudit("missing_oauth_callback_params");
  }

  const flowCookies = await readOAuthFlowCookies();
  if (!flowCookies.state || !flowCookies.verifier) {
    const existingSession = await getSessionUser();
    if (existingSession) {
      const returnPath = await consumeOAuthReturnPathCookie();
      const fallback = await resolveSessionLandingPath(existingSession);
      const target =
        returnPath && isSafeOAuthReturnPath(returnPath) ? returnPath : fallback;
      return NextResponse.redirect(new URL(target, origin));
    }
    return redirectWithLoginAudit("missing_oauth_cookie_context");
  }
  if (state !== flowCookies.state) {
    await clearOAuthFlowCookies();
    return redirectWithLoginAudit("invalid_oauth_state");
  }
  await clearOAuthFlowCookies();

  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    return redirectWithLoginAudit("google_oauth_not_configured");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: getGoogleClientId(),
      client_secret: clientSecret,
      code_verifier: flowCookies.verifier
    }).toString()
  });

  if (!tokenResponse.ok) {
    return redirectWithLoginAudit("token_exchange_failed");
  }

  const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenJson.access_token) {
    return redirectWithLoginAudit("missing_access_token");
  }

  const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  if (!userInfoRes.ok) {
    return redirectWithLoginAudit("userinfo_failed");
  }

  const profile = (await userInfoRes.json()) as GoogleUserInfo;
  if (!profile.sub) {
    return redirectWithLoginAudit("invalid_user_profile");
  }
  if (!profile.email || !profile.email_verified) {
    return redirectWithLoginAudit("google_email_required");
  }

  const emailNormalized = profile.email.trim().toLowerCase();

  const linkingSession = await getSessionUser();
  if (
    linkingSession &&
    !isXIdentityPlaceholderEmail(linkingSession.email) &&
    linkingSession.email.trim().toLowerCase() !== emailNormalized
  ) {
    return redirectWithLoginAudit("google_link_email_mismatch", {
      userId: linkingSession.userId,
      email: emailNormalized
    });
  }

  const linkedId = googleLinkedId(profile.sub);
  const username = googleUsernameFromEmail(emailNormalized);
  const identity = {
    xUserId: linkedId,
    username,
    displayName: profile.name,
    avatarUrl: profile.picture
  };

  const seededAdmin =
    isSeedAdminEmail(emailNormalized, env.ADMIN_SEED_EMAIL)
      ? await ensureSeededGlobalAdmin(emailNormalized)
      : null;

  const userByEmail = seededAdmin?.user ?? (await getCoreUserByEmail(emailNormalized));
  const userByGoogle = await getCoreUserByGoogleSub(profile.sub);

  let user: CoreUser | null = null;

  // Google returns a verified email; `core_users.email` is the canonical registration identity.
  // Always attach `googleAccount.sub` to that row if it exists, even when roles are still empty
  // (pending access request). Otherwise sub stays on a stray row and approval never unlocks login.
  if (
    userByEmail?._id &&
    userByGoogle?._id &&
    !isSameUserId(userByEmail._id, userByGoogle._id)
  ) {
    await unlinkGoogleIdentityFromUser({ userId: userByGoogle._id });
    user = userByEmail;
  }

  if (!user) {
    if (userByGoogle?._id) {
      user = userByGoogle;
    } else if (userByEmail?._id) {
      user = userByEmail;
    }
  }

  if (!user?._id) {
    user = await ensureCoreUserByEmail({
      email: emailNormalized
    });
  }
  if (!user?._id) {
    return redirectWithLoginAudit("not_seeded_email", { email: emailNormalized });
  }

  user = await linkGoogleAccountToUser({
    userId: user._id,
    sub: profile.sub,
    username,
    displayName: profile.name,
    avatarUrl: profile.picture
  });

  if (!user?._id) {
    return redirectWithLoginAudit("access_request_pending", { email: emailNormalized });
  }

  const allowAnyLogin = isAllowAnyXUserLoginEnabled();
  const hasLoginRole = canUserLogin(user.roles);
  const shouldAllowFallbackLogin = Boolean(user._id) && !hasLoginRole && allowAnyLogin;

  if (!hasLoginRole && !shouldAllowFallbackLogin) {
    await ensurePendingOperatorAccessRequestAfterGoogleOAuth(user);
    return redirectWithLoginAudit("access_request_pending", {
      userId: user._id.toHexString(),
      xUserId: identity.xUserId,
      username: identity.username,
      email: user.email
    });
  }

  if (!isCoreUserAccountAccessApproved(user)) {
    if (user.accountStatus !== "rejected") {
      await ensurePendingOperatorAccessRequestAfterGoogleOAuth(user);
    }
    const err =
      user.accountStatus === "rejected" ? "account_rejected" : "account_pending_approval";
    return redirectWithLoginAudit(err, {
      userId: user._id.toHexString(),
      xUserId: identity.xUserId,
      username: identity.username,
      email: user.email
    });
  }

  if (!user.emailVerifiedAt && !isGlobalAdmin(user.roles)) {
    let verificationSent = false;
    try {
      const issued = await issueEmailVerificationForUser(user._id);
      if (issued?.rawToken) {
        verificationSent = await sendEmailVerificationEmail({
          request,
          to: user.email,
          rawToken: issued.rawToken
        });
      }
    } catch {
      verificationSent = false;
    }

    return redirectWithLoginAudit(
      "email_unverified",
      {
        userId: user._id.toHexString(),
        xUserId: identity.xUserId,
        username: identity.username,
        email: user.email
      },
      { verificationSent: verificationSent ? "1" : "0" }
    );
  }

  return finalizeOAuthSessionAndRedirect({
    origin,
    user,
    identity,
    usernameForAdminAllowlist: username,
    loginMeta,
    provider: "google_oauth"
  });
}
