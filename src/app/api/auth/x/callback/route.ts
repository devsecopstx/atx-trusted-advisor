import { NextResponse } from "next/server";

import {
    clearOAuthFlowCookies,
    consumeOAuthReturnPathCookie,
    getSessionUser,
    isSafeOAuthReturnPath,
    readOAuthFlowCookies,
    setPendingXLinkCookie
} from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { extractClientLoginMeta } from "@/lib/client-request-meta";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";
import {
    getAtxfinanceBackendOrigin, getEnv,
    getXOauthClientId,
} from "@/lib/env";
import { getEffectiveHostname, getPublicOriginFromRequest } from "@/lib/http-origin";
import { tryMarketingPostingOAuthCallback } from "@/lib/marketing-posting-oauth-callback";
import { finalizeOAuthSessionAndRedirect } from "@/lib/oauth-complete-session";
import { isSeedAdminEmail } from "@/lib/seed-admin-email";
import { sendEmailVerificationEmail } from "@/lib/send-email-credential-messages";
import { buildXIdentityPlaceholderEmail, isXIdentityPlaceholderEmail } from "@/lib/x-identity-email";
import { resolveXOAuthRedirectUri } from "@/lib/x-oauth-redirect-uri";
import { createAccessRequest, getPendingAccessRequestByUserAndRole } from "@/modules/core-admin/repository";
import { isCoreUserAccountAccessApproved } from "@/modules/identity/account-status";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { issueEmailVerificationForUser } from "@/modules/identity/email-credentials-repository";
import { appendLoginAuditRecord } from "@/modules/identity/login-audit";
import {
    ensureCoreUserByEmail,
    ensureSeededGlobalAdmin,
    getCoreUserByEmail,
    getCoreUserByXOAuthIdentity,
    linkXAccountToUser,
    unlinkXAccountFromUser
} from "@/modules/identity/repository";
import type { CoreUser } from "@/modules/identity/types";

type XTokenResponse = {
  access_token: string;
  token_type: string;
};

type XUserResponse = {
  data?: {
    id: string;
    username: string;
    name?: string;
    profile_image_url?: string;
    email?: string;
  };
};

async function ensurePendingOperatorAccessRequestAfterOAuth(user: CoreUser): Promise<void> {
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
    contactEmail: isXIdentityPlaceholderEmail(user.email) ? undefined : user.email,
    reason: isPlaceholderEmail(user.email)
      ? "Auto-created: X login without email on profile — user on link-email step (email_link_required)"
      : "Auto-created from unapproved X login attempt"
  });
}

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const effectiveHost = getEffectiveHostname(request);
  if (env.NODE_ENV !== "production" && effectiveHost === "localhost") {
    const devHostUrl = new URL(url.pathname + url.search, url.toString());
    devHostUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(devHostUrl.toString());
  }

  const configuredCallbackUrl = env.X_OAUTH_CALLBACK_URL?.trim();
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
      // invalid callback URL is handled later by normal auth failures
    }
  }

  const marketingPosting = await tryMarketingPostingOAuthCallback(request);
  if (marketingPosting) {
    return marketingPosting;
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
      provider: "x_oauth",
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
  const tokenUrl = env.X_OAUTH_TOKEN_URL ?? "https://api.x.com/2/oauth2/token";
  const callbackUrl = resolveXOAuthRedirectUri(request);

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

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${getXOauthClientId()}:${env.X_OAUTH_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      code_verifier: flowCookies.verifier
    }).toString()
  });

  if (!tokenResponse.ok) {
    return redirectWithLoginAudit("token_exchange_failed");
  }

  const tokenJson = (await tokenResponse.json()) as XTokenResponse;
  if (!tokenJson.access_token) {
    return redirectWithLoginAudit("missing_access_token");
  }

  const userInfoResult = await fetchXUserProfile(
    tokenJson.access_token,
    env.X_OAUTH_USERINFO_URL
  );
  if (!userInfoResult.ok) {
    return redirectWithLoginAudit(
      "userinfo_failed",
      undefined,
      userInfoResult.details ? { details: userInfoResult.details } : undefined
    );
  }
  const userInfoJson = userInfoResult.profile;
  if (!userInfoJson.data?.id || !userInfoJson.data?.username) {
    return redirectWithLoginAudit("invalid_user_profile");
  }

  const xIdentity = {
    xUserId: userInfoJson.data.id,
    username: userInfoJson.data.username,
    displayName: userInfoJson.data.name,
    avatarUrl: userInfoJson.data.profile_image_url
  };
  const emailFromProvider = userInfoJson.data.email?.trim().toLowerCase();
  const seededAdmin =
    emailFromProvider && isSeedAdminEmail(emailFromProvider, env.ADMIN_SEED_EMAIL)
      ? await ensureSeededGlobalAdmin(emailFromProvider)
      : null;

  let user = await getCoreUserByXOAuthIdentity(xIdentity);
  if (
    !user &&
    !emailFromProvider &&
    env.ADMIN_SEED_EMAIL &&
    adminXSeedMatchesOAuthIdentity({
      adminSeedXUserId: env.ADMIN_SEED_X_USER_ID,
      adminSeedXUsername: env.ADMIN_SEED_X_USERNAME,
      oauthXUserId: xIdentity.xUserId,
      oauthUsername: xIdentity.username
    })
  ) {
    const seeded = await ensureSeededGlobalAdmin(env.ADMIN_SEED_EMAIL);
    if (!seeded.user._id) {
      return redirectWithLoginAudit("bootstrap_failed", {
        xUserId: xIdentity.xUserId,
        username: xIdentity.username
      });
    }
    user = seeded.user;
  }
  // Prefer the canonical `core_users` row for this email (guest registration, admin approval, etc.)
  // whenever X returns an email claim — not only after that row has a login-eligible role. Otherwise
  // X stays on a placeholder/stale user while the approved access request applies to the email user.
  if (user?._id && emailFromProvider) {
    const userByEmail = seededAdmin?.user ?? (await getCoreUserByEmail(emailFromProvider));
    const emailUserId = userByEmail?._id;
    if (emailUserId !== undefined && !isSameUserId(user._id, emailUserId)) {
      await unlinkXAccountFromUser({ userId: user._id });
      user = await linkXAccountToUser({
        userId: emailUserId,
        ...xIdentity
      });
    }
  }
  if (!user) {
    if (!emailFromProvider) {
      const placeholderEmail = buildXIdentityPlaceholderEmail(xIdentity.xUserId);
      user = await ensureCoreUserByEmail({
        email: placeholderEmail
      });
      if (!user?._id) {
        await setPendingXLinkCookie(xIdentity);
        return redirectWithLoginAudit("email_link_required", {
          xUserId: xIdentity.xUserId,
          username: xIdentity.username
        });
      }
      user = await linkXAccountToUser({
        userId: user._id,
        ...xIdentity
      });
    } else {
      user = seededAdmin?.user ?? (await getCoreUserByEmail(emailFromProvider));
      if (!user?._id) {
        user = await ensureCoreUserByEmail({
          email: emailFromProvider
        });
      }
      if (!user?._id) {
        return redirectWithLoginAudit("not_seeded_email", {
          email: emailFromProvider
        });
      }
      user = await linkXAccountToUser({
        userId: user._id,
        ...xIdentity
      });
    }
  } else if (user._id) {
    user = await linkXAccountToUser({
      userId: user._id,
      ...xIdentity
    });
  }

  // Placeholder email only blocks OAuth completion until the user has a login-eligible *platform* role.
  // After an admin approves the access request (e.g. viewer), allow sign-in even without X email / real email.
  if (
    isXIdentityPlaceholderEmail(user.email) &&
    user._id &&
    !canUserLogin(user.roles)
  ) {
    await ensurePendingOperatorAccessRequestAfterOAuth(user);
    await setPendingXLinkCookie(xIdentity);
    return redirectWithLoginAudit("email_link_required", {
      userId: user._id.toHexString(),
      xUserId: xIdentity.xUserId,
      username: xIdentity.username,
      email: user.email
    });
  }

  const hasLoginRole = user?._id ? canUserLogin(user.roles) : false;

  if (!user?._id || !hasLoginRole) {
    if (user?._id) {
      await ensurePendingOperatorAccessRequestAfterOAuth(user);
    }
    return redirectWithLoginAudit("access_request_pending", {
      userId: user._id?.toHexString(),
      xUserId: xIdentity.xUserId,
      username: xIdentity.username,
      email: user.email
    });
  }
  if (!user._id) {
    return redirectWithLoginAudit("access_request_pending", {
      xUserId: xIdentity.xUserId,
      username: xIdentity.username,
      email: user.email
    });
  }

  if (!isCoreUserAccountAccessApproved(user)) {
    if (user.accountStatus !== "rejected") {
      await ensurePendingOperatorAccessRequestAfterOAuth(user);
    }
    const err =
      user.accountStatus === "rejected" ? "account_rejected" : "account_pending_approval";
    return redirectWithLoginAudit(err, {
      userId: user._id.toHexString(),
      xUserId: xIdentity.xUserId,
      username: xIdentity.username,
      email: user.email
    });
  }

  if (!user.emailVerifiedAt && !isGlobalAdmin(user.roles)) {
    if (isXIdentityPlaceholderEmail(user.email)) {
      await setPendingXLinkCookie(xIdentity);
      return redirectWithLoginAudit("email_link_required", {
        userId: user._id.toHexString(),
        xUserId: xIdentity.xUserId,
        username: xIdentity.username,
        email: user.email
      });
    }

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
        xUserId: xIdentity.xUserId,
        username: xIdentity.username,
        email: user.email
      },
      { verificationSent: verificationSent ? "1" : "0" }
    );
  }

  return finalizeOAuthSessionAndRedirect({
    origin,
    user,
    identity: xIdentity,
    usernameForAdminAllowlist: userInfoJson.data.username,
    loginMeta,
    provider: "x_oauth"
  });
}

async function fetchXUserProfile(
  accessToken: string,
  customUrl?: string
): Promise<
  { ok: true; profile: XUserResponse } | { ok: false; details: string }
> {
  const candidateUrls = [
    customUrl,
    "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url,email",
    "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
    "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url,email",
    "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url"
  ].filter((value): value is string => Boolean(value));

  const attempted = new Set<string>();
  const attemptDetails: string[] = [];
  for (const userInfoUrl of candidateUrls) {
    if (attempted.has(userInfoUrl)) {
      continue;
    }
    attempted.add(userInfoUrl);

    try {
      const userInfoResponse = await fetch(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!userInfoResponse.ok) {
        attemptDetails.push(`${extractHost(userInfoUrl)}:${userInfoResponse.status}`);
        continue;
      }

      const userInfoJson = (await userInfoResponse.json()) as XUserResponse;
      if (!userInfoJson.data?.id || !userInfoJson.data?.username) {
        attemptDetails.push(`${extractHost(userInfoUrl)}:invalid_profile`);
        continue;
      }

      return {
        ok: true,
        profile: userInfoJson
      };
    } catch {
      attemptDetails.push(`${extractHost(userInfoUrl)}:network_error`);
      continue;
    }
  }

  return {
    ok: false,
    details: attemptDetails.join(",")
  };
}

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid_url";
  }
}

function isPlaceholderEmail(email: string): boolean {
  return isXIdentityPlaceholderEmail(email);
}

function isSameUserId(
  left: { toHexString: () => string },
  right: { toHexString: () => string }
): boolean {
  return left.toHexString() === right.toHexString();
}

/** Normalize X handle for comparison (`@AtxBogart` → `atxbogart`). */
function normalizeXHandle(raw: string): string {
  return raw.trim().replace(/^@+/u, "").toLowerCase();
}

/**
 * True when env seed identifies this X OAuth identity as the configured admin (no email on profile).
 * Accepts numeric `data.id` match, explicit handle in `ADMIN_SEED_X_USERNAME`, or a handle mistakenly
 * stored in `ADMIN_SEED_X_USER_ID` (common misconfig — X API id is never the @handle).
 */
function adminXSeedMatchesOAuthIdentity(input: {
  adminSeedXUserId: string | undefined;
  adminSeedXUsername: string | undefined;
  oauthXUserId: string;
  oauthUsername: string;
}): boolean {
  const idSeed = input.adminSeedXUserId?.trim();
  if (idSeed && idSeed === input.oauthXUserId) {
    return true;
  }
  const oauthHandle = normalizeXHandle(input.oauthUsername);
  if (!oauthHandle) {
    return false;
  }
  const fromUsernameEnv = input.adminSeedXUsername?.trim();
  if (fromUsernameEnv && normalizeXHandle(fromUsernameEnv) === oauthHandle) {
    return true;
  }
  // Handle stored in ADMIN_SEED_X_USER_ID by mistake (not the numeric X user id).
  if (idSeed && normalizeXHandle(idSeed) === oauthHandle) {
    return true;
  }
  return false;
}

